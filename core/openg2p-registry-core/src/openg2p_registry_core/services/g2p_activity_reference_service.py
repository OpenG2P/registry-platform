"""Reference checks for activity payloads, and display labels when reading them.

Each activity type declares ``reference_rules`` per payload field::

    {"crop":     {"kind": "ATTRIBUTE", "attribute": "CROP_COMMODITY", "mode": "STRICT"},
     "woreda":   {"kind": "GEO", "mode": "STRICT"},
     "cluster_id": {"kind": "LOCAL_RECORD", "register": "Cluster", "match": "functional_record_id"},
     "plot_id":  {"kind": "EXTERNAL", "system": "farmer-registry.land", "mode": "LENIENT",
                  "pattern": "^[A-Z0-9-]+$", "temporary_prefix": "TMP-", "lookup": false}}

An EXTERNAL rule with ``"lookup": false`` checks the format only and never asks
the other system (status FORMAT_CHECKED, no warning).

Two options apply to LOCAL_RECORD rules, for an activity register that sits in
the same registry as the records it is about (e.g. crop seasons inside the
Farmer Registry):

* ``"subject": true`` — the referenced record is the activity's subject; the
  platform fills the subject fields, including the record's ancestors, so the
  record's profile (and its parents' profiles) list the activity;
* ``"belongs_to": "<field>"`` — the referenced record must be a child of the
  record in ``<field>`` (e.g. the plot must belong to the farmer). STRICT
  rejects a mismatch, LENIENT warns.

Modes: STRICT rejects an unresolved value, LENIENT accepts it with a warning,
NONE skips the check. A value starting with ``temporary_prefix`` is an ID
created offline; it is recorded, replaced by its resolution once one exists,
and never rejected.
"""

import importlib
import logging
import re
import time
from typing import Any, Awaitable, Callable, Optional

from openg2p_fastapi_common.service import BaseService
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import async_sessionmaker

from ..config import Settings
from ..engine import get_engines
from ..errors import G2PRegistryErrorCodes, G2PRegistryException
from ..models import (
    G2PActivityTemporaryReference,
    G2PRegisterDefinition,
    ReferenceKindEnum,
    ReferenceValidationModeEnum,
)
from .g2p_activity_domain_service import G2PActivityDomainService

_config = Settings.get_config(strict=False)
_logger = logging.getLogger("g2p-activity-reference-service")

RESOLVED = "RESOLVED"
UNRESOLVED = "UNRESOLVED"
UNVERIFIED = "UNVERIFIED"  # the other system could not be asked
FORMAT_CHECKED = "FORMAT_CHECKED"  # "lookup": false — only the format was checked
TEMPORARY = "TEMPORARY"
SKIPPED = "SKIPPED"


class _TtlCache:
    def __init__(self, ttl_seconds: int):
        self._ttl = ttl_seconds
        self._values: dict[Any, tuple[float, Any]] = {}

    def get(self, key):
        hit = self._values.get(key)
        if hit and hit[0] > time.monotonic():
            return hit[1]
        return None

    def put(self, key, value):
        self._values[key] = (time.monotonic() + self._ttl, value)
        return value


class G2PActivityReferenceService(BaseService):
    def __init__(self, name="", geo_lookup: Optional[Callable[[str], Awaitable[Optional[dict]]]] = None):
        super().__init__(name)
        self._geo_lookup = geo_lookup
        self._cache = _TtlCache(int(_config.activity_reference_cache_seconds))

    # ------------------------------------------------------------------ write

    async def check_references(
        self,
        session,
        register_id: str,
        activity_type_row,
        payload: dict[str, Any],
        domain_service: G2PActivityDomainService,
    ) -> tuple[dict[str, Any], dict[str, dict], list[str]]:
        """Check every rule; return (payload with temporary IDs resolved, checks, warnings).

        Raises ACTIVITY_REFERENCE_UNRESOLVED for an unresolved STRICT reference.
        """
        rules: dict = activity_type_row.reference_rules or {}
        checks: dict[str, dict] = {}
        warnings: list[str] = []
        payload = dict(payload)

        for field, rule in rules.items():
            if "." in field:
                # A rule on rows of a list, e.g. "fertilizers.fertilizer_type".
                warnings += await self._check_rows(session, register_id, field, rule, payload, checks, domain_service)
                continue
            if field not in payload or payload[field] in (None, "", []):
                continue
            mode = str(rule.get("mode") or ReferenceValidationModeEnum.STRICT.value).upper()
            kind = str(rule.get("kind") or "").upper()
            if mode == ReferenceValidationModeEnum.NONE.value:
                checks[field] = {"kind": kind, "mode": mode, "status": SKIPPED}
                continue

            values = payload[field] if isinstance(payload[field], list) else [payload[field]]
            resolved_values = []
            statuses = []
            messages = []
            for value in values:
                value, status, message = await self._check_one(
                    session, register_id, field, rule, kind, str(value), domain_service
                )
                resolved_values.append(value)
                statuses.append(status)
                if message:
                    messages.append(message)
            payload[field] = resolved_values if isinstance(payload[field], list) else resolved_values[0]

            overall = self._worst(statuses)
            checks[field] = {"kind": kind, "mode": mode, "status": overall}
            if messages:
                checks[field]["message"] = "; ".join(messages)

            if overall in (UNRESOLVED, UNVERIFIED):
                text = f"{field}: {checks[field].get('message') or overall.lower()}"
                if mode == ReferenceValidationModeEnum.STRICT.value:
                    raise G2PRegistryException(
                        code=G2PRegistryErrorCodes.ACTIVITY_REFERENCE_UNRESOLVED.value[1],
                        message=text,
                    )
                warnings.append(text)
            elif overall == TEMPORARY:
                warnings.append(f"{field}: temporary identifier awaiting resolution")

        warnings += await self._check_ownership(session, rules, payload, checks)
        return payload, checks, warnings

    async def _check_ownership(self, session, rules: dict, payload: dict, checks: dict) -> list[str]:
        """``belongs_to``: a referenced record must be a child of another referenced record."""
        warnings = []
        for field, rule in rules.items():
            parent_field = rule.get("belongs_to")
            if not parent_field or str(rule.get("kind") or "").upper() != ReferenceKindEnum.LOCAL_RECORD.value:
                continue
            if checks.get(field, {}).get("status") != RESOLVED or checks.get(parent_field, {}).get("status") != RESOLVED:
                continue
            child = await self._local_record(session, rule, str(payload[field]))
            parent = await self._local_record(session, rules.get(parent_field) or {}, str(payload[parent_field]))
            if child is None or parent is None:
                continue
            if getattr(child, "link_internal_record_id", None) == parent.internal_record_id:
                continue
            text = f"{field}: '{payload[field]}' does not belong to {parent_field} '{payload[parent_field]}'"
            checks[field]["status"] = UNRESOLVED
            checks[field]["message"] = text
            mode = str(rule.get("mode") or ReferenceValidationModeEnum.STRICT.value).upper()
            if mode == ReferenceValidationModeEnum.STRICT.value:
                raise G2PRegistryException(
                    code=G2PRegistryErrorCodes.ACTIVITY_REFERENCE_UNRESOLVED.value[1], message=text
                )
            warnings.append(text)
        return warnings

    async def subject_from_rules(self, session, activity_type_row, payload: dict) -> Optional[dict]:
        """The subject named by a LOCAL_RECORD rule marked ``"subject": true``, if the payload has one."""
        for field, rule in (activity_type_row.reference_rules or {}).items():
            if not rule.get("subject") or str(rule.get("kind") or "").upper() != ReferenceKindEnum.LOCAL_RECORD.value:
                continue
            value = payload.get(field)
            if value in (None, ""):
                continue
            record = await self._local_record(session, rule, str(value))
            if record is None:
                continue
            return {
                "subject_type": ReferenceKindEnum.LOCAL_RECORD.value,
                "subject_id": str(value),
                "subject_internal_record_id": record.internal_record_id,
                "subject_register_mnemonic": rule.get("register"),
            }
        return None

    async def ancestor_record_ids(self, session, register_mnemonic: Optional[str], internal_record_id: str) -> list:
        """The internal_record_ids of a record's parents, nearest first (a plot's farmer, and so on)."""
        if not register_mnemonic or not internal_record_id:
            return []
        try:
            models = importlib.import_module("openg2p_registry_extensions.register_domain.models")
        except ModuleNotFoundError:
            return []
        ancestors: list[str] = []
        mnemonic, record_id = register_mnemonic, internal_record_id
        for _ in range(10):  # registers nest a few levels at most; never loop on bad data
            definition = (
                await session.execute(
                    select(G2PRegisterDefinition).where(G2PRegisterDefinition.register_mnemonic == mnemonic)
                )
            ).scalar()
            model = getattr(models, f"G2PRegister{mnemonic}", None)
            if definition is None or model is None or not definition.master_register_id:
                break
            record = (
                await session.execute(select(model).where(model.internal_record_id == record_id).limit(1))
            ).scalar()
            parent_id = getattr(record, "link_internal_record_id", None) if record is not None else None
            parent = await session.get(G2PRegisterDefinition, definition.master_register_id)
            if not parent_id or parent is None or parent_id in ancestors:
                break
            ancestors.append(parent_id)
            mnemonic, record_id = parent.register_mnemonic, parent_id
        return ancestors

    async def _check_rows(self, session, register_id, field, rule, payload, checks, domain_service) -> list[str]:
        list_field, key = field.split(".", 1)
        rows = payload.get(list_field)
        if not isinstance(rows, list):
            return []
        mode = str(rule.get("mode") or ReferenceValidationModeEnum.STRICT.value).upper()
        kind = str(rule.get("kind") or "").upper()
        if mode == ReferenceValidationModeEnum.NONE.value:
            return []
        statuses, messages = [], []
        for row in rows:
            if isinstance(row, dict) and row.get(key) not in (None, ""):
                _, status, message = await self._check_one(
                    session, register_id, field, rule, kind, str(row[key]), domain_service
                )
                statuses.append(status)
                if message:
                    messages.append(message)
        if not statuses:
            return []
        overall = self._worst(statuses)
        checks[field] = {"kind": kind, "mode": mode, "status": overall}
        if messages:
            checks[field]["message"] = "; ".join(messages)
        if overall in (UNRESOLVED, UNVERIFIED):
            text = f"{field}: {checks[field].get('message') or overall.lower()}"
            if mode == ReferenceValidationModeEnum.STRICT.value:
                raise G2PRegistryException(
                    code=G2PRegistryErrorCodes.ACTIVITY_REFERENCE_UNRESOLVED.value[1], message=text
                )
            return [text]
        return []

    @staticmethod
    def _worst(statuses: list[str]) -> str:
        for status in (UNRESOLVED, UNVERIFIED, TEMPORARY, SKIPPED, FORMAT_CHECKED):
            if status in statuses:
                return status
        return RESOLVED

    async def _check_one(self, session, register_id, field, rule, kind, value, domain_service):
        prefix = rule.get("temporary_prefix")
        if prefix and value.startswith(prefix):
            resolved = await self._temporary(session, register_id, field, value)
            if resolved is None:
                return value, TEMPORARY, None
            value = resolved

        if kind == ReferenceKindEnum.ATTRIBUTE.value:
            found = await self._attribute_value_exists(session, rule.get("attribute"), value)
            return value, (RESOLVED if found else UNRESOLVED), (None if found else f"'{value}' is not a known code")

        if kind == ReferenceKindEnum.GEO.value:
            hierarchy = await self._geo(value)
            if hierarchy is None:
                return value, UNRESOLVED, f"'{value}' is not a known location"
            level = rule.get("level")
            if level and (hierarchy.get("hierarchy") or [{}])[-1].get("level_mnemonic") != level:
                return value, UNRESOLVED, f"'{value}' is not a {level}"
            return value, RESOLVED, None

        if kind == ReferenceKindEnum.LOCAL_RECORD.value:
            record = await self._local_record(session, rule, value)
            return value, (RESOLVED if record is not None else UNRESOLVED), (
                None if record is not None else f"no {rule.get('register')} record '{value}'"
            )

        if kind == ReferenceKindEnum.EXTERNAL.value:
            pattern = rule.get("pattern")
            if pattern and not re.match(pattern, value):
                return value, UNRESOLVED, f"'{value}' does not match the expected format"
            if rule.get("lookup") is False:
                return value, FORMAT_CHECKED, None
            try:
                result = await domain_service.resolve_external_reference(rule, value)
            except Exception as error:  # the other system is down: never block on it
                _logger.warning("External reference lookup failed for %s=%s: %s", field, value, error)
                result = None
            if result is None:
                return value, UNVERIFIED, f"'{value}' could not be verified with {rule.get('system', 'the source')}"
            return value, (RESOLVED if result.get("found") else UNRESOLVED), (
                None if result.get("found") else f"'{value}' not found in {rule.get('system', 'the source')}"
            )

        return value, SKIPPED, None

    async def _attribute_value_exists(self, session, attribute_code: Optional[str], value: str) -> bool:
        if not attribute_code:
            return False
        return value in await self._attribute_labels(session, attribute_code)

    async def _attribute_labels(self, session, attribute_code: str) -> dict[str, str]:
        cached = self._cache.get(("attr", attribute_code))
        if cached is not None:
            return cached
        # Code lists live in Master Data, not in this registry's database — the
        # registry no longer keeps a copy. Read them there, the way
        # G2PAttributeValueValidator does; `session` is the registry's and is
        # not used for this.
        master_data_engine = get_engines().get("db_engine_master_data")
        if master_data_engine is None:
            raise RuntimeError("Master Data database engine is not configured")
        async with async_sessionmaker(master_data_engine, expire_on_commit=False)() as md_session:
            rows = (
                await md_session.execute(
                    text(
                        "SELECT v.value_code, v.value_display "
                        "FROM g2p_attribute_values v "
                        "JOIN g2p_attributes a ON a.attribute_id = v.attribute_id "
                        "WHERE a.attribute_code = :attribute_code"
                    ),
                    {"attribute_code": attribute_code},
                )
            ).all()
        return self._cache.put(("attr", attribute_code), {row[0]: row[1] for row in rows})

    async def _geo(self, value: str) -> Optional[dict]:
        cached = self._cache.get(("geo", value))
        if cached is not None:
            return cached
        lookup = self._geo_lookup or _hierarchy_from_master_data
        try:
            hierarchy = await lookup(value)
        except Exception as error:
            _logger.warning("Geo lookup failed for %s: %s", value, error)
            return None
        if hierarchy is not None:
            self._cache.put(("geo", value), hierarchy)
        return hierarchy

    async def _local_record(self, session, rule: dict, value: str):
        register = rule.get("register")
        if not register:
            return None
        models = importlib.import_module("openg2p_registry_extensions.register_domain.models")
        model = getattr(models, f"G2PRegister{register}", None)
        if model is None:
            return None
        column = getattr(model, rule.get("match") or "functional_record_id", None)
        if column is None:
            return None
        return (await session.execute(select(model).where(column == value).limit(1))).scalar()

    async def _temporary(self, session, register_id: str, field: str, temporary_id: str) -> Optional[str]:
        row = (
            await session.execute(
                select(G2PActivityTemporaryReference).where(
                    G2PActivityTemporaryReference.register_id == register_id,
                    G2PActivityTemporaryReference.reference_field == field,
                    G2PActivityTemporaryReference.temporary_id == temporary_id,
                )
            )
        ).scalar()
        if row is None:
            session.add(
                G2PActivityTemporaryReference(
                    register_id=register_id, reference_field=field, temporary_id=temporary_id
                )
            )
            await session.flush()
            return None
        return row.resolved_id

    # ------------------------------------------------------------------- read

    async def display_labels(
        self,
        session,
        activity_type_row,
        payload: dict[str, Any],
        domain_service: G2PActivityDomainService,
    ) -> dict[str, Any]:
        """Labels for referenced values, resolved now (never stored on the activity)."""
        labels: dict[str, Any] = {}
        for field, rule in (activity_type_row.reference_rules or {}).items():
            value = payload.get(field)
            if value in (None, "", []):
                continue
            kind = str(rule.get("kind") or "").upper()
            values = value if isinstance(value, list) else [value]
            resolved = [await self._label(session, kind, rule, field, str(v), domain_service) for v in values]
            if any(label is not None for label in resolved):
                labels[field] = resolved if isinstance(value, list) else resolved[0]
        return labels

    async def _label(self, session, kind, rule, field, value, domain_service) -> Optional[str]:
        if kind == ReferenceKindEnum.ATTRIBUTE.value and rule.get("attribute"):
            return (await self._attribute_labels(session, rule["attribute"])).get(value)
        if kind == ReferenceKindEnum.GEO.value:
            hierarchy = await self._geo(value)
            if hierarchy and hierarchy.get("hierarchy"):
                return hierarchy["hierarchy"][-1].get("level_value_mnemonic")
            return None
        if kind == ReferenceKindEnum.LOCAL_RECORD.value:
            record = await self._local_record(session, rule, value)
            return getattr(record, "record_name", None) if record is not None else None
        return domain_service.reference_display(field, value)


async def _hierarchy_from_master_data(value: str) -> Optional[dict]:
    """The value's chain from Master Data, top level first, in the hierarchy service's shape.

    Read directly (not through G2PGeoHierarchyService, whose response cache needs
    the web app's cache backend), so it works the same in APIs, workers and tests.
    """
    from .g2p_activity_geo_service import G2PActivityGeoService

    service = G2PActivityGeoService.get_component() or G2PActivityGeoService()
    dims = await service.dimensions(value)
    if not dims:
        return None
    return {
        "hierarchy": [
            {"level_mnemonic": level, "level_value_mnemonic": entry["name"], "level_value_id": entry["code"]}
            for level, entry in dims.items()
        ]
    }
