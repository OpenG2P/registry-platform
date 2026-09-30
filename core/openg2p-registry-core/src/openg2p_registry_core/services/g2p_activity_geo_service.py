"""Where an activity happened, as named administrative levels (geo dimensions).

Every activity is snapshotted, when it is written, with its location as Master
Data's levels — ``{"region": {"code": "ET04", "name": "Oromia"}, "zone": {...},
"woreda": {...}}`` — so data can be rolled up at any level: sown area by region,
yield by woreda. The location is taken, in order, from:

1. the payload: a field with a GEO reference rule marked ``"location": true``,
   else the conventional ``geo_lowest_level_value_id`` field — where the activity
   says it happened (e.g. the plot's woreda);
2. the subject, when it is a record of this registry: that record's location,
   else its nearest ancestor's (a plot without one takes its farmer's);
3. the activity's context: the location of its latest activity that has one, so
   later stages of a crop season need not repeat the plot's location.

A snapshot, rather than resolving the subject's location when reporting, keeps
history stable when a record is later edited, and works when the subject lives
in another registry (only the activity's own location is then available).
"""

import importlib
import logging
import time
from typing import Any, Optional

from openg2p_fastapi_common.service import BaseService
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import async_sessionmaker

from ..config import Settings
from ..engine import get_engines
from ..models import G2PRegisterDefinition, ReferenceKindEnum
from .g2p_activity_rule_service import active_filter

_config = Settings.get_config(strict=False)
_logger = logging.getLogger("g2p-activity-geo-service")

LOCATION_FIELD = "geo_lowest_level_value_id"


class G2PActivityGeoService(BaseService):
    def __init__(self, name=""):
        super().__init__(name)
        self._cache: dict[str, tuple[float, Optional[dict]]] = {}
        self._ttl = int(getattr(_config, "activity_reference_cache_seconds", 600))

    # -------------------------------------------------------------- lookup

    async def dimensions(self, level_value_id: Optional[str]) -> Optional[dict[str, dict[str, str]]]:
        """Named levels for a Master Data geo value, from the top level down; None if unknown."""
        if not level_value_id:
            return None
        hit = self._cache.get(level_value_id)
        if hit is not None and hit[0] > time.monotonic():
            return hit[1]
        engine = get_engines().get("db_engine_master_data")
        if engine is None:
            return None
        chain: list[tuple[str, str, str]] = []
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                current = level_value_id
                while current and len(chain) < 12:
                    row = (
                        await session.execute(
                            text(
                                "SELECT lv.level_value_id, lv.level_value_mnemonic, lv.parent_level_value_id, "
                                "l.level_mnemonic FROM g2p_geo_level_values lv "
                                "JOIN g2p_geo_levels l ON l.level_id = lv.level_id "
                                "WHERE lv.level_value_id = :id"
                            ),
                            {"id": current},
                        )
                    ).first()
                    if row is None:
                        break
                    chain.append((row.level_mnemonic, row.level_value_id, row.level_value_mnemonic))
                    current = row.parent_level_value_id
        except Exception as error:  # Master Data unreachable: no location, never a failed write
            _logger.warning("Geo lookup failed for %s: %s", level_value_id, error)
            return None
        dims = {level: {"code": code, "name": name} for level, code, name in reversed(chain)} or None
        self._cache[level_value_id] = (time.monotonic() + self._ttl, dims)
        return dims

    # ------------------------------------------------------------ resolution

    async def resolve(self, session, register, type_row, activity, payload: dict, context) -> Optional[dict]:
        """The activity's geo dimensions: from its payload, else its subject record, else its context."""
        value = self._payload_location(type_row, payload)
        if value:
            dims = await self.dimensions(value)
            if dims:
                return dims
        dims = await self._subject_location(session, activity)
        if dims:
            return dims
        if context is not None:
            return await self._context_location(session, register, context.context_id)
        return None

    @staticmethod
    def _payload_location(type_row, payload: dict) -> Optional[str]:
        for field, rule in (type_row.reference_rules or {}).items():
            if (
                str(rule.get("kind") or "").upper() == ReferenceKindEnum.GEO.value
                and rule.get("location")
                and payload.get(field)
            ):
                return str(payload[field])
        value = payload.get(LOCATION_FIELD)
        return str(value) if value else None

    async def _subject_location(self, session, activity) -> Optional[dict]:
        """The subject record's location, else its nearest ancestor's (registers of this registry only)."""
        record_id, mnemonic = activity.subject_internal_record_id, activity.subject_register_mnemonic
        if not record_id or not mnemonic:
            return None
        try:
            models = importlib.import_module("openg2p_registry_extensions.register_domain.models")
        except ModuleNotFoundError:
            return None
        for _ in range(10):
            model = getattr(models, f"G2PRegister{mnemonic}", None)
            if model is None:
                return None
            record = (
                await session.execute(select(model).where(model.internal_record_id == record_id).limit(1))
            ).scalar()
            if record is None:
                return None
            dims = await self.dimensions(getattr(record, LOCATION_FIELD, None))
            if dims:
                return dims
            definition = (
                await session.execute(
                    select(G2PRegisterDefinition).where(G2PRegisterDefinition.register_mnemonic == mnemonic)
                )
            ).scalar()
            parent = (
                await session.get(G2PRegisterDefinition, definition.master_register_id)
                if definition is not None and definition.master_register_id
                else None
            )
            if parent is None or not record.link_internal_record_id:
                return None
            record_id, mnemonic = record.link_internal_record_id, parent.register_mnemonic
        return None

    @staticmethod
    async def _context_location(session, register, context_id: str) -> Optional[dict]:
        model = register.activity_model
        return (
            await session.execute(
                select(model.geo_dimensions)
                # JSONB stores a missing location as JSON null, not SQL NULL.
                .where(
                    model.context_id == context_id,
                    func.jsonb_typeof(model.geo_dimensions) == "object",
                    active_filter(model),
                )
                .order_by(model.occurred_at.desc(), model.recorded_at.desc())
                .limit(1)
            )
        ).scalar()


def common_dimensions(many: list[Optional[dict[str, Any]]]) -> Optional[dict]:
    """The levels every one of several locations shares, top down (e.g. a farmer's plots in one zone)."""
    present = [dims for dims in many if dims]
    if not present:
        return None
    shared: dict = {}
    for level, value in present[0].items():
        if all(dims.get(level) == value for dims in present[1:]):
            shared[level] = value
        else:
            break
    return shared or None
