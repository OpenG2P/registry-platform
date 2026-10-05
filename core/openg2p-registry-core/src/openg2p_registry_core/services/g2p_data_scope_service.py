"""The data scope catalogue: loading, publishing, listing and resolving.

Where scopes come from
----------------------
* **Default scopes** — one per register section: ``<controller>.<section_mnemonic>``
  with fields ``["section:<section_mnemonic>"]``.
* **The extension's catalogue** — every ``*.json`` under
  ``<extension package>/meta_data/data-scopes/`` (setting
  ``data_scopes_catalogue_path`` overrides the directory). Each file::

      {
        "exclude_section_scopes": ["fr_docs", "fr_farmer_header"],   // or true: no default scopes
        "field_renames": {"Farmer.phone": "Farmer.phone_number"},
        "scopes": [
          {"name": "contact", "label": "Contact details", "description": "...",
           "fields": ["Farmer.phone_number", "Farmer.email"]},
          {"name": "fr_farmer_land", "label": "Land"}                  // relabel a section scope
        ]
      }

  A scope named like a section replaces that section's default scope (its
  fields default to the section). Field references are checked against the
  extension's models and the register sections; an unknown one refuses the
  whole catalogue with every problem listed (the previously published
  catalogue stays in force).

When it is published
--------------------
The extension package (with its ``meta_data``) is installed in every service
image, so the services publish it themselves — no seed step:

* at start-up, inside the migration advisory lock (``migrate_database``);
* again whenever a running service notices that the register sections or the
  catalogue changed (checked at most every ``data_scopes_sync_check_seconds``
  when scopes are read) — on a first install db-seed loads the sections after
  the services started.

Publishing (``sync``) is idempotent and serialised by an advisory lock:

* a new scope → version 1, effective now;
* a scope whose field list changed → a new version, effective now (versions are
  immutable: a database trigger rejects UPDATE/DELETE on them);
* an identical field list → nothing;
* a scope no longer offered → RETIRED (its versions stay; never deleted).
"""

import hashlib
import importlib
import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Optional

from openg2p_fastapi_common.context import dbengine
from openg2p_fastapi_common.service import BaseService
from sqlalchemy import select, text
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.ext.asyncio import async_sessionmaker

from ..config import Settings
from ..models import (
    DataScopeSourceEnum,
    DataScopeStatusEnum,
    G2PActivityAggregate,
    G2PDataScope,
    G2PDataScopeVersion,
    G2PRegisterDefinition,
    G2PRegisterSection,
    RegisterPurposeEnum,
)
from .g2p_data_scope_fields import (
    ALL,
    RECORD_EXTRA_FIELDS,
    SECTION_PREFIX,
    AllowedFields,
    DataScopeCatalogueError,
    ScopeVersionView,
    resolve_scope_grant,
    scope_id_of,
    section_refs,
    snake_case,
    split_scope_id,
    union,
    valid_scope_name,
    validate_ref,
)

_logger = logging.getLogger("g2p-data-scope-service")

_SYNC_LOCK_KEY = "data-scopes:sync"
_EXTENSIONS_PACKAGE = "openg2p_registry_extensions"
_MODELS_MODULE = "openg2p_registry_extensions.register_domain.models"

_VERSION_GUARD_FUNCTION = """
CREATE OR REPLACE FUNCTION g2p_data_scope_version_guard() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Data scope versions are immutable: % is not allowed on %', TG_OP, TG_TABLE_NAME
        USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;
"""

_SCOPE_GUARD_FUNCTION = """
CREATE OR REPLACE FUNCTION g2p_data_scope_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Data scopes are never deleted (retire them instead)'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF NEW.scope_name IS DISTINCT FROM OLD.scope_name THEN
        RAISE EXCEPTION 'A data scope''s name never changes'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""


def _utcnow() -> datetime:
    return datetime.utcnow()


def _naive_utc(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def _config():
    return Settings.get_config(strict=False)


class G2PDataScopeService(BaseService):
    def __init__(self, name=""):
        super().__init__(name)
        self._checked_at = 0.0
        self._fingerprint: Optional[str] = None
        self._nested_keys: Optional[dict[str, str]] = None

    # ------------------------------------------------------------ settings

    @staticmethod
    def controller_id() -> str:
        return (getattr(_config(), "consent_data_controller", "") or "").strip()

    @staticmethod
    def _session_maker():
        return async_sessionmaker(dbengine.get(), expire_on_commit=False)

    # ------------------------------------------------------------ DDL

    async def ensure_guards(self) -> None:
        """Immutability triggers: versions never change or go; scopes are never deleted or renamed."""
        async with dbengine.get().begin() as conn:
            await conn.execute(text(_VERSION_GUARD_FUNCTION))
            await conn.execute(text(_SCOPE_GUARD_FUNCTION))
            await conn.execute(text('DROP TRIGGER IF EXISTS "trg_data_scope_versions_immutable" '
                                    "ON g2p_data_scope_versions"))
            await conn.execute(
                text('CREATE TRIGGER "trg_data_scope_versions_immutable" BEFORE UPDATE OR DELETE '
                     "ON g2p_data_scope_versions FOR EACH ROW EXECUTE FUNCTION g2p_data_scope_version_guard()")
            )
            await conn.execute(text('DROP TRIGGER IF EXISTS "trg_data_scopes_guard" ON g2p_data_scopes'))
            await conn.execute(
                text('CREATE TRIGGER "trg_data_scopes_guard" BEFORE UPDATE OR DELETE '
                     "ON g2p_data_scopes FOR EACH ROW EXECUTE FUNCTION g2p_data_scope_guard()")
            )

    # ------------------------------------------------------------ catalogue file

    @staticmethod
    def catalogue_dir() -> Optional[Path]:
        configured = (getattr(_config(), "data_scopes_catalogue_path", "") or "").strip()
        if configured:
            return Path(configured)
        try:
            package = importlib.import_module(_EXTENSIONS_PACKAGE)
        except ModuleNotFoundError:
            return None
        package_file = getattr(package, "__file__", None)
        if not package_file:
            return None
        return Path(package_file).parent / "meta_data" / "data-scopes"

    def load_catalogue(self) -> tuple[dict, str]:
        """The extension's catalogue files merged, and a digest of their contents."""
        directory = self.catalogue_dir()
        merged: dict[str, Any] = {"exclude_section_scopes": [], "field_renames": {}, "scopes": []}
        digest = hashlib.sha256()
        if directory is None or not directory.is_dir():
            return merged, digest.hexdigest()
        problems: list[str] = []
        for path in sorted(directory.glob("*.json")):
            raw = path.read_bytes()
            digest.update(path.name.encode() + b"\0" + raw)
            try:
                content = json.loads(raw)
            except ValueError as error:
                problems.append(f"{path.name}: not valid JSON ({error})")
                continue
            if not isinstance(content, dict):
                problems.append(f"{path.name}: expected an object with 'scopes'")
                continue
            exclude = content.get("exclude_section_scopes")
            if exclude is True:
                merged["exclude_section_scopes"] = True
            elif isinstance(exclude, list) and merged["exclude_section_scopes"] is not True:
                merged["exclude_section_scopes"].extend(str(e) for e in exclude)
            elif exclude not in (None, False):
                problems.append(f"{path.name}: exclude_section_scopes must be a list of section mnemonics or true")
            renames = content.get("field_renames") or {}
            if not isinstance(renames, dict):
                problems.append(f"{path.name}: field_renames must be an object of old → new reference")
            else:
                merged["field_renames"].update({str(k): str(v) for k, v in renames.items()})
            scopes = content.get("scopes") or []
            if not isinstance(scopes, list):
                problems.append(f"{path.name}: scopes must be a list")
                continue
            for scope in scopes:
                if isinstance(scope, dict):
                    merged["scopes"].append({**scope, "_file": path.name})
                else:
                    problems.append(f"{path.name}: each scope must be an object")
        if problems:
            raise DataScopeCatalogueError(problems)
        return merged, digest.hexdigest()

    # ------------------------------------------------------------ registry metadata

    @staticmethod
    async def _registry_metadata(session) -> tuple[list, list]:
        registers = (await session.execute(select(G2PRegisterDefinition))).scalars().all()
        sections = (
            await session.execute(select(G2PRegisterSection).order_by(G2PRegisterSection.section_mnemonic))
        ).scalars().all()
        return list(registers), list(sections)

    @staticmethod
    def field_targets(registers: Iterable) -> dict[str, frozenset]:
        """Every target a reference may name → its fields, from the loaded extension's models."""
        try:
            models = importlib.import_module(_MODELS_MODULE)
        except ModuleNotFoundError:
            models = None
        core_models = importlib.import_module("openg2p_registry_core.models")
        targets: dict[str, frozenset] = {}

        def columns(model, exclude=()) -> frozenset:
            return frozenset(c.name for c in sa_inspect(model).columns if c.name not in exclude)

        aggregate_fields = columns(G2PActivityAggregate)
        for register in registers:
            mnemonic = register.register_mnemonic
            if register.register_purpose == RegisterPurposeEnum.ACTIVITY.value:
                activity = getattr(models, f"G2PActivity{mnemonic}", None) if models else None
                projection = getattr(models, f"G2PActivityProjection{mnemonic}", None) if models else None
                if activity is not None:
                    targets[f"{mnemonic}.activity"] = columns(activity, exclude=("search_text",)) | {"occurred_on_ec"}
                if projection is not None:
                    targets[f"{mnemonic}.context"] = columns(projection)
                targets[f"{mnemonic}.aggregate"] = aggregate_fields
                continue
            module = core_models if register.register_purpose == RegisterPurposeEnum.CORE_TABLE.value else models
            model = getattr(module, f"G2PRegister{mnemonic}", None) if module else None
            if model is not None:
                targets[mnemonic] = columns(model) | RECORD_EXTRA_FIELDS
        return targets

    def build_catalogue(self, catalogue: dict, registers: list, sections: list) -> dict[str, dict]:
        """name → {label, description, source, fields, resolved_fields}. Raises DataScopeCatalogueError."""
        registers_by_id = {r.register_id: r.register_mnemonic for r in registers}
        targets = self.field_targets(registers)
        sections_by_mnemonic = {s.section_mnemonic: s for s in sections}
        problems: list[str] = []

        def expand_section(mnemonic: str) -> list[str]:
            section = sections_by_mnemonic[mnemonic]
            refs, _unknown = section_refs(section.section_ui_schema, section.section_register_id, registers_by_id)
            valid = [ref for ref in refs if validate_ref(ref, targets) is None]
            skipped = sorted(set(refs) - set(valid))
            if skipped:
                _logger.debug("Section %s: references outside the models left out of its scope: %s",
                              mnemonic, skipped)
            return valid

        desired: dict[str, dict] = {}
        exclude = catalogue.get("exclude_section_scopes") or []
        if exclude is not True:
            for mnemonic in exclude:
                if mnemonic not in sections_by_mnemonic:
                    problems.append(f"exclude_section_scopes: no section '{mnemonic}'")
            for mnemonic, section in sections_by_mnemonic.items():
                if mnemonic in exclude:
                    continue
                if not valid_scope_name(mnemonic):
                    _logger.warning("Section %s: not usable as a scope name; no default scope", mnemonic)
                    continue
                resolved = expand_section(mnemonic)
                if not resolved:
                    continue  # nothing shareable (headers, score displays, …)
                desired[mnemonic] = {
                    "label": section.section_description or mnemonic,
                    "description": section.section_description,
                    "source": DataScopeSourceEnum.SECTION.value,
                    "fields": [f"{SECTION_PREFIX}{mnemonic}"],
                    "resolved_fields": resolved,
                }

        seen: set[str] = set()
        for entry in catalogue.get("scopes") or []:
            where = entry.get("_file", "catalogue")
            name = str(entry.get("name") or "").strip()
            if not valid_scope_name(name):
                problems.append(f"{where}: scope name '{name}' must be letters, digits, '_' or '-'")
                continue
            if name in seen:
                problems.append(f"{where}: scope '{name}' is defined twice")
                continue
            seen.add(name)
            fields = entry.get("fields")
            if fields is None and name in sections_by_mnemonic:
                fields = [f"{SECTION_PREFIX}{name}"]
            if not isinstance(fields, list) or not fields:
                problems.append(f"{where}: scope '{name}' needs a non-empty list of fields")
                continue
            resolved: set[str] = set()
            for ref in fields:
                ref = str(ref).strip()
                if ref.startswith(SECTION_PREFIX):
                    mnemonic = ref[len(SECTION_PREFIX):]
                    if mnemonic not in sections_by_mnemonic:
                        problems.append(f"{where}: scope '{name}': no section '{mnemonic}'")
                        continue
                    resolved.update(expand_section(mnemonic))
                    continue
                problem = validate_ref(ref, targets)
                if problem:
                    problems.append(f"{where}: scope '{name}': {problem}")
                    continue
                resolved.add(ref)
            desired[name] = {
                "label": entry.get("label") or name,
                "description": entry.get("description"),
                "source": DataScopeSourceEnum.EXTENSION.value,
                "fields": [str(ref).strip() for ref in fields],
                "resolved_fields": sorted(resolved),
            }

        for old, new in (catalogue.get("field_renames") or {}).items():
            problem = validate_ref(new, targets)
            if problem:
                problems.append(f"field_renames: '{old}' → {problem}")

        if problems:
            raise DataScopeCatalogueError(problems)
        return desired

    # ------------------------------------------------------------ publishing

    async def sync(self, strict: bool = True) -> Optional[dict[str, str]]:
        """Publish the catalogue. Returns {scope name: what happened}, or None when skipped.

        Not strict (start-up, background re-checks): a refused catalogue is
        logged and the published one stays in force.
        """
        try:
            return await self._sync()
        except DataScopeCatalogueError as error:
            if strict:
                raise
            _logger.error("%s", error)
            return None

    async def _sync(self) -> Optional[dict[str, str]]:
        catalogue, digest = self.load_catalogue()
        async with self._session_maker()() as session:
            async with session.begin():
                await session.execute(text("SELECT pg_advisory_xact_lock(hashtext(:key))"), {"key": _SYNC_LOCK_KEY})
                registers, sections = await self._registry_metadata(session)
                if not registers:
                    # db-seed loads the registers after the services start on a first install.
                    _logger.info("Data scopes: no registers loaded yet; nothing to publish")
                    return None
                desired = self.build_catalogue(catalogue, registers, sections)
                outcome = await self._publish(session, desired, catalogue.get("field_renames") or {})
        self._fingerprint = self._fingerprint_of(digest, registers, sections)
        self._nested_keys = None
        changed = {name: what for name, what in outcome.items() if what != "unchanged"}
        if changed:
            _logger.info("Data scopes published: %s", changed)
        return outcome

    async def _publish(self, session, desired: dict[str, dict], renames: dict[str, str]) -> dict[str, str]:
        now = _utcnow()
        existing = {s.scope_name: s for s in (await session.execute(select(G2PDataScope))).scalars().all()}
        versions = {}
        if existing:
            rows = (await session.execute(select(G2PDataScopeVersion))).scalars().all()
            for row in rows:
                current = versions.get(row.scope_name)
                if current is None or row.version > current.version:
                    versions[row.scope_name] = row
        outcome: dict[str, str] = {}
        for name, spec in sorted(desired.items()):
            scope = existing.get(name)
            if scope is None:
                session.add(G2PDataScope(
                    scope_name=name, label=spec["label"], description=spec["description"],
                    status=DataScopeStatusEnum.ACTIVE.value, source=spec["source"], current_version=1,
                    created_at=now, updated_at=now,
                ))
                session.add(G2PDataScopeVersion(
                    scope_name=name, version=1, fields=spec["fields"], resolved_fields=spec["resolved_fields"],
                    renamed_fields=None, effective_from=now, created_at=now,
                ))
                outcome[name] = "created"
                continue
            if scope.status == DataScopeStatusEnum.RETIRED.value:
                message = f"scope '{name}' was retired; scope IDs are never reused — give it a new name"
                if spec["source"] == DataScopeSourceEnum.EXTENSION.value:
                    raise DataScopeCatalogueError([message])
                _logger.warning("Data scopes: %s (section scope left retired)", message)
                outcome[name] = "retired"
                continue
            what = "unchanged"
            for attribute in ("label", "description", "source"):
                if getattr(scope, attribute) != spec[attribute]:
                    setattr(scope, attribute, spec[attribute])
                    what = "updated"
            current = versions.get(name)
            if current is None or list(current.fields) != spec["fields"] or \
                    sorted(current.resolved_fields) != spec["resolved_fields"]:
                number = (current.version if current else 0) + 1
                previous = set(current.resolved_fields) if current else set()
                renamed = {old: new for old, new in renames.items()
                           if old in previous and new in spec["resolved_fields"]}
                session.add(G2PDataScopeVersion(
                    scope_name=name, version=number, fields=spec["fields"],
                    resolved_fields=spec["resolved_fields"], renamed_fields=renamed or None,
                    effective_from=now, created_at=now,
                ))
                scope.current_version = number
                what = f"version {number}"
            if what != "unchanged":
                scope.updated_at = now
            outcome[name] = what
        for name, scope in existing.items():
            if name not in desired and scope.status != DataScopeStatusEnum.RETIRED.value:
                scope.status = DataScopeStatusEnum.RETIRED.value
                scope.retired_at = now
                scope.updated_at = now
                outcome[name] = "retired"
        return outcome

    # ------------------------------------------------------------ keeping current

    @staticmethod
    def _fingerprint_of(digest: str, registers: list, sections: list) -> str:
        h = hashlib.sha256(digest.encode())
        for r in sorted(registers, key=lambda r: r.register_id):
            h.update(f"{r.register_id}|{r.register_mnemonic}|{r.register_purpose}\n".encode())
        for s in sections:
            schema = json.dumps(s.section_ui_schema, sort_keys=True, default=str)
            h.update(f"{s.section_mnemonic}|{s.section_register_id}|{s.section_description}|{schema}\n".encode())
        return h.hexdigest()

    async def ensure_current(self) -> None:
        """Re-publish when sections or the catalogue changed since this process last published.

        Checked at most every ``data_scopes_sync_check_seconds``; never raises
        (a failure is logged and the published catalogue stays in force).
        """
        interval = max(0, int(getattr(_config(), "data_scopes_sync_check_seconds", 60) or 0))
        if self._fingerprint is not None and time.monotonic() - self._checked_at < interval:
            return
        self._checked_at = time.monotonic()
        try:
            _, digest = self.load_catalogue()
            async with self._session_maker()() as session:
                registers, sections = await self._registry_metadata(session)
            fingerprint = self._fingerprint_of(digest, registers, sections)
            if fingerprint == self._fingerprint:
                return
            await self.sync(strict=False)
            # A refused catalogue is not retried until something changes.
            self._fingerprint = fingerprint
        except Exception:
            _logger.exception("Data scopes: could not check the catalogue")

    # ------------------------------------------------------------ reading

    async def list_scopes(self) -> list[dict]:
        """Every scope with its versions (field references, not values)."""
        await self.ensure_current()
        controller = self.controller_id()
        async with self._session_maker()() as session:
            scopes = (await session.execute(select(G2PDataScope).order_by(G2PDataScope.scope_name))).scalars().all()
            rows = (
                await session.execute(
                    select(G2PDataScopeVersion).order_by(G2PDataScopeVersion.scope_name, G2PDataScopeVersion.version)
                )
            ).scalars().all()
        versions: dict[str, list] = {}
        for row in rows:
            versions.setdefault(row.scope_name, []).append({
                "version": row.version,
                "effective_from": row.effective_from.isoformat() if row.effective_from else None,
                "fields": list(row.fields or []),
                "resolved_fields": list(row.resolved_fields or []),
                "renamed_fields": dict(row.renamed_fields) if row.renamed_fields else None,
            })
        return [
            {
                "scope_id": scope_id_of(scope.scope_name, controller),
                "name": scope.scope_name,
                "data_controller": controller or None,
                "label": scope.label,
                "description": scope.description,
                "status": scope.status,
                "source": scope.source,
                "current_version": scope.current_version,
                "retired_at": scope.retired_at.isoformat() if scope.retired_at else None,
                "versions": versions.get(scope.scope_name, []),
            }
            for scope in scopes
        ]

    async def resolve(self, scope_ids: Iterable[str], issued_at: Optional[datetime]) -> AllowedFields:
        """The fields a consent for ``scope_ids`` issued at ``issued_at`` allows.

        Scopes of another controller, unknown scopes and malformed IDs grant
        nothing. ``issued_at`` None (no issue time on the consent) reads each
        scope's first version — the narrowest reading.
        """
        await self.ensure_current()
        controller = self.controller_id()
        names = {name for name in (split_scope_id(s, controller) for s in scope_ids or []) if name}
        if not names:
            return AllowedFields({})
        issued_at = _naive_utc(issued_at)
        async with self._session_maker()() as session:
            known = (
                await session.execute(select(G2PDataScope.scope_name).where(G2PDataScope.scope_name.in_(names)))
            ).scalars().all()
            rows = (
                await session.execute(select(G2PDataScopeVersion).where(G2PDataScopeVersion.scope_name.in_(known)))
            ).scalars().all() if known else []
        by_scope: dict[str, list[ScopeVersionView]] = {}
        for row in rows:
            by_scope.setdefault(row.scope_name, []).append(
                ScopeVersionView(row.version, row.effective_from, list(row.resolved_fields or []),
                                 dict(row.renamed_fields) if row.renamed_fields else None)
            )
        grant: dict = {}
        for views in by_scope.values():
            grant = union(grant, resolve_scope_grant(views, issued_at))
        ignored = sorted(names - set(by_scope))
        if ignored:
            _logger.info("Data scopes not in this registry's catalogue (grant nothing): %s", ignored)
        return AllowedFields(grant)

    async def nested_keys(self) -> dict[str, str]:
        """Key of a linked register's records in an enriched record → that register's mnemonic."""
        if self._nested_keys is None:
            async with self._session_maker()() as session:
                mnemonics = (await session.execute(select(G2PRegisterDefinition.register_mnemonic))).scalars().all()
            self._nested_keys = {snake_case(m): m for m in mnemonics if m}
        return self._nested_keys


__all__ = ["G2PDataScopeService", "DataScopeCatalogueError", "AllowedFields", "ALL"]
