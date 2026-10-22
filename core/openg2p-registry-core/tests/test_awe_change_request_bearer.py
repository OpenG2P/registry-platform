"""AWE change-request start: token only when needed; missing token skips AWE."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_CORE_SRC = Path(__file__).resolve().parents[1] / "src" / "openg2p_registry_core"
_AWE_PATH = _CORE_SRC / "services" / "g2p_awe_integration_service.py"


def _ensure_pkg(name: str) -> ModuleType:
    if name not in sys.modules:
        mod = ModuleType(name)
        mod.__path__ = []  # type: ignore[attr-defined]
        sys.modules[name] = mod
    return sys.modules[name]


def _load_awe_module():
    core = _ensure_pkg("openg2p_registry_core")
    core.__path__ = [str(_CORE_SRC)]  # type: ignore[attr-defined]

    errors = _ensure_pkg("openg2p_registry_core.errors")

    class _Code:
        def __init__(self, pair):
            self.value = pair

    class G2PRegistryErrorCodes:
        AWE_BEARER_TOKEN_REQUIRED = _Code(("bearer required", "AWE-001"))
        AWE_REQUEST_FAILED = _Code(("request failed", "AWE-002"))

    class G2PRegistryException(Exception):
        def __init__(self, code=None, message=None):
            self.code = code
            self.message = message
            super().__init__(message)

    errors.G2PRegistryErrorCodes = G2PRegistryErrorCodes
    errors.G2PRegistryException = G2PRegistryException

    config = _ensure_pkg("openg2p_registry_core.config")

    class Settings:
        @staticmethod
        def get_config(strict=False):
            return SimpleNamespace(logging_default_logger_name="test")

    config.Settings = Settings

    helpers = _ensure_pkg("openg2p_registry_core.helpers")
    helpers.AWEClientError = type("AWEClientError", (Exception,), {"message": ""})
    helpers.AweHelper = type(
        "AweHelper",
        (),
        {"get_component": staticmethod(lambda: MagicMock())},
    )
    helpers.get_awe_settings = lambda: SimpleNamespace(awe_enabled=True)

    awe_summary = _ensure_pkg("openg2p_registry_core.helpers.awe_status_summary")
    awe_summary.format_awe_request_status_summary = lambda *a, **k: None

    models = _ensure_pkg("openg2p_registry_core.models")
    models.G2PIntakeFormDefinition = object
    models.G2PIntakeFormSubmission = object
    models.G2PRegisterChangeRequest = object
    models.G2PRegisterDefinition = object
    models.G2PRegisterSection = object

    policy_mod = _ensure_pkg(
        "openg2p_registry_core.services.g2p_awe_policy_configuration_service"
    )

    class G2PAwePolicyConfigurationService:
        @staticmethod
        def get_component():
            raise RuntimeError("override in test")

    policy_mod.G2PAwePolicyConfigurationService = G2PAwePolicyConfigurationService

    fastapi_common = _ensure_pkg("openg2p_fastapi_common")
    service_mod = _ensure_pkg("openg2p_fastapi_common.service")

    class BaseService:
        @classmethod
        def get_component(cls):
            return None

    service_mod.BaseService = BaseService
    fastapi_common.service = service_mod

    sa_asyncio = _ensure_pkg("sqlalchemy.ext.asyncio")
    sa_asyncio.AsyncSession = object

    spec = importlib.util.spec_from_file_location(
        "openg2p_registry_core.services.g2p_awe_integration_service",
        _AWE_PATH,
    )
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules["openg2p_registry_core.services.g2p_awe_integration_service"] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module")
def awe_mod():
    return _load_awe_module()


@pytest.mark.asyncio
async def test_resolve_bearer_prefers_caller_token(awe_mod):
    service = awe_mod.G2PAweIntegrationService.__new__(awe_mod.G2PAweIntegrationService)
    assert await service._resolve_change_request_bearer("  staff-jwt  ") == "staff-jwt"


@pytest.mark.asyncio
async def test_resolve_bearer_falls_back_to_master_data_client(awe_mod):
    service = awe_mod.G2PAweIntegrationService.__new__(awe_mod.G2PAweIntegrationService)
    fake_client = MagicMock()
    fake_client.get_staff_access_token = AsyncMock(return_value="svc-tok")

    class MasterDataClient:
        @staticmethod
        def get_component():
            return fake_client

    stub = ModuleType("openg2p_registry_core.helpers.master_data")
    stub.MasterDataClient = MasterDataClient
    with patch.dict(sys.modules, {"openg2p_registry_core.helpers.master_data": stub}):
        assert await service._resolve_change_request_bearer(None) == "svc-tok"
    fake_client.get_staff_access_token.assert_awaited_once()


@pytest.mark.asyncio
async def test_start_change_request_skips_awe_when_token_missing(awe_mod):
    service = awe_mod.G2PAweIntegrationService.__new__(awe_mod.G2PAweIntegrationService)
    service._awe_enabled = MagicMock(return_value=True)  # type: ignore[method-assign]
    service._resolve_change_request_bearer = AsyncMock(return_value=None)  # type: ignore[method-assign]

    policy_service = MagicMock()
    policy_service.find_effective_policy_configuration = AsyncMock(
        return_value=SimpleNamespace(policy_key="pk", context_field_names=[])
    )

    change_request = SimpleNamespace(
        change_request_id="cr-1",
        register_id="reg-1",
        section_id="sec-1",
        record_name="R1",
        awe_request_id=None,
    )
    awe_helper = MagicMock()
    awe_helper.create_request = AsyncMock()

    with (
        patch.object(
            awe_mod.G2PAwePolicyConfigurationService,
            "get_component",
            return_value=policy_service,
        ),
        patch.object(
            awe_mod.AweHelper,
            "get_component",
            return_value=awe_helper,
        ),
    ):
        await service.start_change_request_workflow(
            MagicMock(),
            change_request,
            [{"first_name": "A"}],
            bearer_token=None,
            requester="staff-1",
        )

    awe_helper.create_request.assert_not_called()
    assert change_request.awe_request_id is None
