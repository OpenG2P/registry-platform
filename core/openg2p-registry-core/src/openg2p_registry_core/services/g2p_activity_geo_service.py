"""Where an activity happened, as named administrative levels (geo dimensions).

Every activity is snapshotted, when it is written, with its location as Master
Data's levels — ``{"region": {"code": "ET04", "name": "Oromia"}, "zone": {...},
"woreda": {...}}`` — so data can be rolled up at any level: sown area by region,
yield by woreda. The location is taken, in order, from:

1. the payload: a field with a GEO reference rule marked ``"location": true``,
   else the conventional ``geo_lowest_level_value_id`` field — where the activity
   says it happened (e.g. the plot's woreda);
2. the subject, when it is a record of this registry: that record's location,
   else its nearest ancestor's (a plot without one takes its owner's);
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
from ..helpers.master_data_client import master_data_read_mode
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

    async def dimensions(
        self, level_value_id: Optional[str], *, include_retired: bool = False
    ) -> Optional[dict[str, dict[str, str]]]:
        """Named levels for a Master Data geo value, from the top level down; None if unknown."""
        dims, _ = await self.located(level_value_id, include_retired=include_retired)
        return dims

    async def located(
        self, level_value_id: Optional[str], *, include_retired: bool = False, version: Optional[int] = None
    ) -> tuple[Optional[dict[str, dict[str, str]]], Optional[int]]:
        """(named levels, geography version they were read at) for a geo value.

        In ``api`` mode the unit is read at the geography version in effect (or
        ``version``), and must be in use (ACTIVE) unless ``include_retired`` —
        checking new data leaves retired units out, showing old data includes
        them. In ``db`` mode the current-state tables hold only units in use, and
        no version is known (None).
        """
        if not level_value_id:
            return None, None
        if master_data_read_mode() == "api":
            return await self._located_from_api(level_value_id, include_retired, version)
        return await self._dimensions_from_db(level_value_id), None

    @staticmethod
    async def _located_from_api(level_value_id: str, include_retired: bool, version: Optional[int]):
        from ..helpers.master_data_client import MasterDataError, get_master_data_client

        try:
            chain = await get_master_data_client().geo_unit(level_value_id, version=version)
        except MasterDataError as error:  # Master Data unreachable: no location, never a failed write
            _logger.warning("Geo lookup failed for %s: %s", level_value_id, error)
            return None, None
        if chain is None or (not include_retired and not chain.active):
            return None, chain.version_no if chain is not None else None
        dims = {unit.level_mnemonic: {"code": unit.unit_id, "name": unit.name} for unit in chain.units} or None
        return dims, chain.version_no

    async def _dimensions_from_db(self, level_value_id: str) -> Optional[dict[str, dict[str, str]]]:
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

    async def resolve(
        self, session, register, type_row, activity, payload: dict, context, versions=None
    ) -> Optional[dict]:
        """The activity's geo dimensions: from its payload, else its subject record, else its context.

        ``versions`` (a CatalogueVersions), when given, records the geography
        version the location was read at.
        """
        value = self._payload_location(type_row, payload)
        if value:
            dims, version_no = await self.located(value)
            if dims:
                _record_geo(versions, version_no)
                return dims
        dims = await self._subject_location(session, activity, versions)
        if dims:
            return dims
        if context is not None:
            return await self._context_location(session, register, context.context_id, versions)
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

    async def _subject_location(self, session, activity, versions=None) -> Optional[dict]:
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
            dims, version_no = await self.located(getattr(record, LOCATION_FIELD, None))
            if dims:
                _record_geo(versions, version_no)
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
    async def _context_location(session, register, context_id: str, versions=None) -> Optional[dict]:
        model = register.activity_model
        row = (
            await session.execute(
                select(model.geo_dimensions, model.catalogue_versions)
                # JSONB stores a missing location as JSON null, not SQL NULL.
                .where(
                    model.context_id == context_id,
                    func.jsonb_typeof(model.geo_dimensions) == "object",
                    active_filter(model),
                )
                .order_by(model.occurred_at.desc(), model.recorded_at.desc())
                .limit(1)
            )
        ).first()
        if row is None:
            return None
        # The location is that activity's snapshot: so is the geography version it was read at.
        recorded = row.catalogue_versions if isinstance(row.catalogue_versions, dict) else {}
        _record_geo(versions, recorded.get("geo"))
        return row.geo_dimensions


def _record_geo(versions, version_no: Optional[int]) -> None:
    if versions is not None and version_no is not None:
        versions.geo(version_no)


def common_dimensions(many: list[Optional[dict[str, Any]]]) -> Optional[dict]:
    """The levels every one of several locations shares, top down (e.g. a person's plots in one zone)."""
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
