"""Unit tests for G2PIntakeFormLinkService parent-linking rules."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import Column, String
from sqlalchemy.orm import declarative_base

# Load the service module without importing openg2p_registry_core.services.__init__
# (that package pulls in heavy optional deps not needed for these unit tests).
_CORE_SRC = Path(__file__).resolve().parents[1] / "src" / "openg2p_registry_core"
_SERVICE_PATH = _CORE_SRC / "services" / "g2p_intake_form_link_service.py"


def _ensure_pkg(name: str) -> ModuleType:
    if name not in sys.modules:
        mod = ModuleType(name)
        mod.__path__ = []  # type: ignore[attr-defined]
        sys.modules[name] = mod
    return sys.modules[name]


def _load_link_service_module():
    # Minimal package stubs so relative imports in the service file resolve.
    core = _ensure_pkg("openg2p_registry_core")
    core.__path__ = [str(_CORE_SRC)]  # type: ignore[attr-defined]

    errors = _ensure_pkg("openg2p_registry_core.errors")

    class _Code:
        def __init__(self, pair):
            self.value = pair

    class G2PRegistryErrorCodes:
        INVALID_REQUEST = _Code(("INVALID_REQUEST", "REQ-VAL-000"))
        REGISTER_NOT_FOUND = _Code(("REGISTER_NOT_FOUND", "REG-ERR-001"))

    class G2PRegistryException(Exception):
        def __init__(self, code=None, message=None):
            self.code = code
            self.message = message
            super().__init__(message)

    errors.G2PRegistryErrorCodes = G2PRegistryErrorCodes
    errors.G2PRegistryException = G2PRegistryException

    models = _ensure_pkg("openg2p_registry_core.models")

    class RegisterPurposeEnum:
        CORE_TABLE = SimpleNamespace(value="CORE_TABLE")
        TABLE = SimpleNamespace(value="TABLE")
        REGISTER = SimpleNamespace(value="REGISTER")

    models.G2PRegisterDefinition = object
    models.RegisterPurposeEnum = RegisterPurposeEnum

    schemas = _ensure_pkg("openg2p_registry_core.schemas")

    class AllowedParentRecordData:
        def __init__(self, internal_record_id, record_name=None):
            self.internal_record_id = internal_record_id
            self.record_name = record_name

    class IntakeAllowedParentsData:
        def __init__(
            self,
            parent_register_id=None,
            parent_register_mnemonic=None,
            requires_selection=False,
            allowed_parents=None,
            link_required=False,
            allow_live_parent=False,
        ):
            self.parent_register_id = parent_register_id
            self.parent_register_mnemonic = parent_register_mnemonic
            self.requires_selection = requires_selection
            self.allowed_parents = allowed_parents or []
            self.link_required = link_required
            self.allow_live_parent = allow_live_parent

    schemas.AllowedParentRecordData = AllowedParentRecordData
    schemas.IntakeAllowedParentsData = IntakeAllowedParentsData

    services_pkg = _ensure_pkg("openg2p_registry_core.services")
    services_pkg.__path__ = [str(_CORE_SRC / "services")]  # type: ignore[attr-defined]

    fastapi_service = _ensure_pkg("openg2p_fastapi_common.service")

    class BaseService:
        def __init__(self, name=""):
            self.name = name

    fastapi_service.BaseService = BaseService

    spec = importlib.util.spec_from_file_location(
        "openg2p_registry_core.services.g2p_intake_form_link_service",
        _SERVICE_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


_mod = _load_link_service_module()
G2PIntakeFormLinkService = _mod.G2PIntakeFormLinkService
G2PRegistryException = sys.modules["openg2p_registry_core.errors"].G2PRegistryException

FakeBase = declarative_base()


class FakeIntakeModel(FakeBase):
    __tablename__ = "fake_intake_for_link_tests"

    submission_id = Column(String, primary_key=True)
    internal_record_id = Column(String, primary_key=True)
    link_internal_record_id = Column(String, nullable=True)
    record_name = Column(String, nullable=True)


def _register(
    register_id: str,
    mnemonic: str,
    master_register_id: str | None = None,
    purpose: str = "REGISTER",
):
    return SimpleNamespace(
        register_id=register_id,
        register_mnemonic=mnemonic,
        master_register_id=master_register_id,
        register_purpose=purpose,
    )


@pytest.fixture
def link_service():
    return G2PIntakeFormLinkService()


@pytest.fixture
def session():
    return AsyncMock()


def test_is_parent_link_required_root_and_subject(link_service):
    root = _register("hh", "Household", None)
    child = _register("ind", "Individual", "hh")
    assert link_service.is_parent_link_required(root, "hh", "hh") is False
    assert link_service.is_parent_link_required(child, "ind", "ind") is False
    assert link_service.is_parent_link_required(child, "hh", "ind") is True


def test_is_optional_subject_parent_link(link_service):
    child = _register("ind", "Individual", "hh")
    assert link_service.is_optional_subject_parent_link(child, "ind", "ind") is True
    assert link_service.is_optional_subject_parent_link(child, "hh", "ind") is False


@pytest.mark.asyncio
async def test_resolve_zero_parents_required_raises(link_service, session):
    section = _register("asset", "HouseholdAsset", "hh", purpose="TABLE")
    with patch.object(link_service, "_get_register_definition", AsyncMock(return_value=section)):
        with patch.object(
            link_service,
            "list_intake_parent_candidates",
            AsyncMock(return_value=SimpleNamespace(allowed_parents=[], requires_selection=False)),
        ):
            with pytest.raises(G2PRegistryException):
                await link_service.resolve_link_internal_record_id(
                    submission_id="sub",
                    form_register_id="hh",
                    section_register_id="asset",
                    record={},
                    session=session,
                )


@pytest.mark.asyncio
async def test_resolve_zero_parents_optional_subject_returns_none(link_service, session):
    section = _register("ind", "Individual", "hh")
    with patch.object(link_service, "_get_register_definition", AsyncMock(return_value=section)):
        with patch.object(
            link_service,
            "list_intake_parent_candidates",
            AsyncMock(return_value=SimpleNamespace(allowed_parents=[], requires_selection=False)),
        ):
            result = await link_service.resolve_link_internal_record_id(
                submission_id="sub",
                form_register_id="ind",
                section_register_id="ind",
                record={},
                session=session,
            )
            assert result is None


@pytest.mark.asyncio
async def test_resolve_one_parent_auto_links(link_service, session):
    section = _register("asset", "HouseholdAsset", "hh", purpose="TABLE")
    parent = SimpleNamespace(internal_record_id="p1", record_name="HH1")
    with patch.object(link_service, "_get_register_definition", AsyncMock(return_value=section)):
        with patch.object(
            link_service,
            "list_intake_parent_candidates",
            AsyncMock(
                return_value=SimpleNamespace(allowed_parents=[parent], requires_selection=False)
            ),
        ):
            result = await link_service.resolve_link_internal_record_id(
                submission_id="sub",
                form_register_id="hh",
                section_register_id="asset",
                record={},
                session=session,
            )
            assert result == "p1"


@pytest.mark.asyncio
async def test_resolve_many_parents_without_payload_raises(link_service, session):
    section = _register("asset", "HouseholdAsset", "hh", purpose="TABLE")
    parents = [
        SimpleNamespace(internal_record_id="p1", record_name="A"),
        SimpleNamespace(internal_record_id="p2", record_name="B"),
    ]
    with patch.object(link_service, "_get_register_definition", AsyncMock(return_value=section)):
        with patch.object(
            link_service,
            "list_intake_parent_candidates",
            AsyncMock(
                return_value=SimpleNamespace(allowed_parents=parents, requires_selection=True)
            ),
        ):
            with pytest.raises(G2PRegistryException):
                await link_service.resolve_link_internal_record_id(
                    submission_id="sub",
                    form_register_id="hh",
                    section_register_id="asset",
                    record={},
                    session=session,
                )


@pytest.mark.asyncio
async def test_resolve_many_parents_with_valid_payload(link_service, session):
    section = _register("asset", "HouseholdAsset", "hh", purpose="TABLE")
    parents = [
        SimpleNamespace(internal_record_id="p1", record_name="A"),
        SimpleNamespace(internal_record_id="p2", record_name="B"),
    ]
    with patch.object(link_service, "_get_register_definition", AsyncMock(return_value=section)):
        with patch.object(
            link_service,
            "list_intake_parent_candidates",
            AsyncMock(
                return_value=SimpleNamespace(allowed_parents=parents, requires_selection=True)
            ),
        ):
            result = await link_service.resolve_link_internal_record_id(
                submission_id="sub",
                form_register_id="hh",
                section_register_id="asset",
                record={"link_internal_record_id": "p2"},
                session=session,
                payload_specifies_link=True,
            )
            assert result == "p2"


@pytest.mark.asyncio
async def test_resolve_invalid_payload_raises(link_service, session):
    section = _register("asset", "HouseholdAsset", "hh", purpose="TABLE")
    parents = [SimpleNamespace(internal_record_id="p1", record_name="A")]
    with patch.object(link_service, "_get_register_definition", AsyncMock(return_value=section)):
        with patch.object(
            link_service,
            "list_intake_parent_candidates",
            AsyncMock(
                return_value=SimpleNamespace(allowed_parents=parents, requires_selection=False)
            ),
        ):
            with pytest.raises(G2PRegistryException):
                await link_service.resolve_link_internal_record_id(
                    submission_id="sub",
                    form_register_id="hh",
                    section_register_id="asset",
                    record={"link_internal_record_id": "not-a-parent"},
                    session=session,
                    payload_specifies_link=True,
                )


@pytest.mark.asyncio
async def test_resolve_optional_subject_validates_live_parent(link_service, session):
    section = _register("ind", "Individual", "hh")
    with patch.object(link_service, "_get_register_definition", AsyncMock(return_value=section)):
        with patch.object(
            link_service,
            "list_intake_parent_candidates",
            AsyncMock(return_value=SimpleNamespace(allowed_parents=[], requires_selection=False)),
        ):
            with patch.object(
                link_service, "validate_live_parent_link", AsyncMock()
            ) as validate_live:
                result = await link_service.resolve_link_internal_record_id(
                    submission_id="sub",
                    form_register_id="ind",
                    section_register_id="ind",
                    record={"link_internal_record_id": "live-hh"},
                    session=session,
                    payload_specifies_link=True,
                )
                assert result == "live-hh"
                validate_live.assert_awaited_once()


@pytest.mark.asyncio
async def test_resolve_preserves_existing_link_when_payload_omits_key(link_service, session):
    section = _register("asset", "HouseholdAsset", "hh", purpose="TABLE")
    with patch.object(link_service, "_get_register_definition", AsyncMock(return_value=section)):
        result = await link_service.resolve_link_internal_record_id(
            submission_id="sub",
            form_register_id="hh",
            section_register_id="asset",
            record={"first_name": "x"},
            session=session,
            existing_link="existing-parent",
            payload_specifies_link=False,
        )
        assert result == "existing-parent"


@pytest.mark.asyncio
async def test_null_child_links_for_deleted_parents(link_service, session):
    with patch.object(
        link_service,
        "null_child_links_for_deleted_parents",
        wraps=None,
    ):
        # Exercise the early-return and the update path with FakeIntakeModel via
        # a focused reimplementation of the loop body.
        deleted = {"deleted-parent"}
        await G2PIntakeFormLinkService.null_child_links_for_deleted_parents(
            link_service, "sub", set(), session
        )
        session.execute.assert_not_called()

        register_defs = [_register("asset", "HouseholdAsset", "hh", purpose="TABLE")]

        class Scalars:
            def all(self):
                return register_defs

        class Result:
            def scalars(self):
                return Scalars()

        session.execute = AsyncMock(return_value=Result())

        with patch.object(
            _mod, "select", side_effect=lambda *a, **k: MagicMock(name="select")
        ):
            with patch.object(link_service, "get_intake_model_class", return_value=FakeIntakeModel):
                with patch.object(link_service, "intake_model_has_link_column", return_value=True):
                    with patch.object(_mod, "update", return_value=MagicMock()) as update_mock:
                        update_mock.return_value.where.return_value.values.return_value = MagicMock()
                        await G2PIntakeFormLinkService.null_child_links_for_deleted_parents(
                            link_service, "sub", deleted, session
                        )
                        assert session.execute.await_count >= 1


@pytest.mark.asyncio
async def test_list_intake_parent_candidates_shape(link_service, session):
    section = _register("asset", "HouseholdAsset", "hh", purpose="TABLE")
    parent_reg = _register("hh", "Household", None)
    row = SimpleNamespace(internal_record_id="p1", record_name="Alpha")

    class Scalars:
        def all(self):
            return [row]

    class Result:
        def scalars(self):
            return Scalars()

    session.execute = AsyncMock(return_value=Result())
    session.get = AsyncMock(side_effect=[section, parent_reg])

    with patch.object(link_service, "get_intake_model_class", return_value=FakeIntakeModel):
        data = await link_service.list_intake_parent_candidates("sub", "asset", session)

    assert data.parent_register_id == "hh"
    assert data.parent_register_mnemonic == "Household"
    assert data.requires_selection is False
    assert len(data.allowed_parents) == 1
    assert data.allowed_parents[0].internal_record_id == "p1"
    assert data.allowed_parents[0].record_name == "Alpha"
