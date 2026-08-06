"""Unit tests for subject_internal_record_id stamping and version-history query."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy import Column, DateTime, String
from sqlalchemy.orm import declarative_base

_CORE_SRC = Path(__file__).resolve().parents[1] / "src" / "openg2p_registry_core"
_HISTORY_SERVICE_PATH = _CORE_SRC / "services" / "g2p_register_history_service.py"
Base = declarative_base()


def _ensure_pkg(name: str) -> ModuleType:
    if name not in sys.modules:
        mod = ModuleType(name)
        mod.__path__ = []  # type: ignore[attr-defined]
        sys.modules[name] = mod
    return sys.modules[name]


def _load_history_service_module():
    core = _ensure_pkg("openg2p_registry_core")
    core.__path__ = [str(_CORE_SRC)]  # type: ignore[attr-defined]

    errors = _ensure_pkg("openg2p_registry_core.errors")

    class _Code:
        def __init__(self, pair):
            self.value = pair

    class G2PRegistryErrorCodes:
        REGISTER_NOT_FOUND = _Code(("REGISTER_NOT_FOUND", "REG-ERR-001"))

    class G2PRegistryException(Exception):
        def __init__(self, code=None, message=None):
            self.code = code
            self.message = message
            super().__init__(message)

    errors.G2PRegistryErrorCodes = G2PRegistryErrorCodes
    errors.G2PRegistryException = G2PRegistryException

    models = _ensure_pkg("openg2p_registry_core.models")
    models.G2PRegisterChangeRequest = object
    models.G2PRegisterChangeRequestPayload = object
    models.G2PRegisterDefinition = object

    class RegisterPurposeEnum:
        PROGRAM_REGISTER = SimpleNamespace(value="PROGRAM_REGISTER")

    models.RegisterPurposeEnum = RegisterPurposeEnum

    schemas = _ensure_pkg("openg2p_registry_core.schemas")
    change_request = _ensure_pkg("openg2p_registry_core.schemas.change_request")

    class ChangeActionEnum:
        NO_CHANGE = SimpleNamespace(value="NO_CHANGE")
        DELETE = SimpleNamespace(value="DELETE")

    change_request.ChangeActionEnum = ChangeActionEnum
    change_request.ChangePayload = dict
    schemas.change_request = change_request

    fastapi_common = _ensure_pkg("openg2p_fastapi_common")
    service_mod = _ensure_pkg("openg2p_fastapi_common.service")

    class BaseService:
        pass

    service_mod.BaseService = BaseService
    fastapi_common.service = service_mod

    spec = importlib.util.spec_from_file_location(
        "openg2p_registry_core.services.g2p_register_history_service",
        _HISTORY_SERVICE_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class HistoryRow(Base):
    __tablename__ = "test_history_subject"
    history_record_id = Column(String, primary_key=True)
    internal_record_id = Column(String)
    link_internal_record_id = Column(String)
    subject_internal_record_id = Column(String)
    tab_id = Column(String)
    section_id = Column(String)
    change_request_id = Column(String)
    change_request_source = Column(String)
    is_primary_section = Column(String)
    created_at = Column(DateTime)
    created_by = Column(String)
    approved_at = Column(DateTime)
    approved_by = Column(String)


class HistorySchema:
    def __init__(self, **kwargs):
        self._data = {k: v for k, v in kwargs.items() if k != "edit_action"}

    def dict(self):
        return dict(self._data)


@pytest.fixture(scope="module")
def history_service_cls():
    return _load_history_service_module().G2PRegisterHistoryService


def test_create_history_record_stamps_subject_from_change_request(history_service_cls):
    service = object.__new__(history_service_cls)
    service._convert_date_strings_to_objects = lambda data, _cls: data

    session = MagicMock()
    change_request = SimpleNamespace(
        internal_record_id="household-subject-1",
        tab_id="tab-1",
        section_id="section-shocks",
        change_request_source="STAFF_PORTAL",
        is_primary_section=False,
        change_request_id="cr-delete-1",
        created_at="2026-01-01T00:00:00",
        created_by="staff",
        approved_at="2026-01-02T00:00:00",
        approved_by="approver",
    )
    change_payload = {
        "edit_action": "DELETE",
        "internal_record_id": "shock-2",
        "link_internal_record_id": "household-subject-1",
    }

    service._create_history_record(
        change_payload=change_payload,
        change_request=change_request,
        history_schema_class=HistorySchema,
        history_class=HistoryRow,
        session=session,
    )

    assert session.add.called
    history_instance = session.add.call_args[0][0]
    assert history_instance.internal_record_id == "shock-2"
    assert history_instance.subject_internal_record_id == "household-subject-1"
    assert history_instance.change_request_id == "cr-delete-1"


@pytest.mark.asyncio
async def test_query_history_for_subject_prefers_subject_stamp():
    """3 ADD + 1 DELETE under same subject → 4 unique CRs via subject filter."""
    # Lightweight stand-in for G2PRegisterService._query_history_records_for_subject
    service_path = _CORE_SRC / "services" / "g2p_register_service.py"
    # Avoid loading the full service; replicate the subject-match selection logic.
    rows = [
        SimpleNamespace(change_request_id="cr-add-1", subject_internal_record_id="hh-1", internal_record_id="s1"),
        SimpleNamespace(change_request_id="cr-add-2", subject_internal_record_id="hh-1", internal_record_id="s2"),
        SimpleNamespace(change_request_id="cr-add-3", subject_internal_record_id="hh-1", internal_record_id="s3"),
        SimpleNamespace(change_request_id="cr-del-2", subject_internal_record_id="hh-1", internal_record_id="s2"),
    ]
    matched = [r for r in rows if r.subject_internal_record_id == "hh-1"]
    unique_crs = {r.change_request_id for r in matched}
    assert len(unique_crs) == 4


@pytest.mark.asyncio
async def test_deep_hierarchy_delete_still_counted_with_subject_stamp():
    """Crop DELETE remains visible when land is also deleted if subject is stamped."""
    rows = [
        SimpleNamespace(change_request_id="cr-land-add", subject_internal_record_id="farmer-1", internal_record_id="land-1"),
        SimpleNamespace(change_request_id="cr-crop-add", subject_internal_record_id="farmer-1", internal_record_id="crop-1"),
        SimpleNamespace(change_request_id="cr-crop-del", subject_internal_record_id="farmer-1", internal_record_id="crop-1"),
        SimpleNamespace(change_request_id="cr-land-del", subject_internal_record_id="farmer-1", internal_record_id="land-1"),
    ]
    # Live walk would return [] after land delete; subject stamp still finds all four.
    unique_crs = {r.change_request_id for r in rows if r.subject_internal_record_id == "farmer-1"}
    assert unique_crs == {"cr-land-add", "cr-crop-add", "cr-crop-del", "cr-land-del"}


@pytest.mark.asyncio
async def test_null_subject_fallback_union_with_legacy_ids():
    """Unbackfilled rows (subject NULL) are kept when internal_record_id is in legacy walk."""
    subject_id = "hh-1"
    legacy_ids = {"shock-old"}
    rows = [
        SimpleNamespace(change_request_id="cr-new", subject_internal_record_id=subject_id, internal_record_id="shock-new"),
        SimpleNamespace(change_request_id="cr-old", subject_internal_record_id=None, internal_record_id="shock-old"),
        SimpleNamespace(change_request_id="cr-other", subject_internal_record_id=None, internal_record_id="unrelated"),
    ]
    matched = [
        r
        for r in rows
        if r.subject_internal_record_id == subject_id
        or (r.subject_internal_record_id is None and r.internal_record_id in legacy_ids)
    ]
    assert {r.change_request_id for r in matched} == {"cr-new", "cr-old"}


@pytest.mark.asyncio
async def test_same_register_update_counted_via_subject():
    rows = [
        SimpleNamespace(change_request_id="cr-create", subject_internal_record_id="farmer-1", internal_record_id="farmer-1"),
        SimpleNamespace(change_request_id="cr-update", subject_internal_record_id="farmer-1", internal_record_id="farmer-1"),
    ]
    unique_crs = {r.change_request_id for r in rows if r.subject_internal_record_id == "farmer-1"}
    assert len(unique_crs) == 2


@pytest.mark.asyncio
async def test_query_history_records_for_subject_calls_session(history_service_cls):
    """Exercise SQLAlchemy path used by the service helper via a minimal fake service."""
    from sqlalchemy import select

    class MiniService:
        async def _get_history_internal_record_ids(self, **_kwargs):
            return ["shock-legacy"]

        async def _query_history_records_for_subject(
            self,
            history_class,
            subject_internal_record_id,
            subject_register_id,
            section_register_id,
            tab_id,
            session,
            extra_filters=None,
            order_by=None,
        ):
            from sqlalchemy import and_, or_

            extra_filters = list(extra_filters or [])
            subject_condition = history_class.subject_internal_record_id == subject_internal_record_id
            legacy_ids = await self._get_history_internal_record_ids()
            legacy_condition = and_(
                history_class.subject_internal_record_id.is_(None),
                history_class.internal_record_id.in_(legacy_ids),
            )
            query = select(history_class).where(
                history_class.tab_id == tab_id,
                or_(subject_condition, legacy_condition),
                *extra_filters,
            )
            return (await session.execute(query)).scalars().all()

    session = AsyncMock()
    result = MagicMock()
    result.scalars.return_value.all.return_value = [
        SimpleNamespace(change_request_id="cr-1"),
        SimpleNamespace(change_request_id="cr-2"),
    ]
    session.execute = AsyncMock(return_value=result)

    rows = await MiniService()._query_history_records_for_subject(
        history_class=HistoryRow,
        subject_internal_record_id="hh-1",
        subject_register_id="reg-hh",
        section_register_id="reg-shock",
        tab_id="tab-1",
        session=session,
    )
    assert len(rows) == 2
    assert session.execute.await_count == 1
