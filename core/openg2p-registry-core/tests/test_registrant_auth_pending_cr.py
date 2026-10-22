"""Unit tests: pending UPDATE CRs from userinfo use provider_config mapping."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_CORE_SRC = Path(__file__).resolve().parents[1] / "src" / "openg2p_registry_core"
_AUTH_SERVICE_PATH = _CORE_SRC / "services" / "g2p_registrant_authentication_service.py"
_MAPPER_PATH = _CORE_SRC / "services" / "registrant_auth_userinfo_mapper.py"

NSR_STYLE_PROVIDER_CONFIG = {
    "userinfo_change_request": {
        "tab_keys": ["individual_info_tab", "individual_info"],
        "claims": {
            "given_name": {"field": "first_name"},
            "family_name": {"field": "last_name"},
            "name": {
                "field": "full_name",
                "split_into": ["first_name", "middle_name", "last_name"],
            },
            "gender": {"field": "gender", "normalize": "gender"},
            "birthdate": {"field": "birth_date", "normalize": "birth_date"},
            "phone_number": {"field": "primary_phone"},
            "address": {"field": "address_descriptor", "normalize": "address"},
        },
        "sections": [
            {
                "section_keys": [
                    "individual_demographic_section",
                    "individual_demographic_details",
                ],
                "fields": [
                    "full_name",
                    "first_name",
                    "middle_name",
                    "last_name",
                    "gender",
                    "birth_date",
                ],
            },
            {
                "section_keys": [
                    "individual_contact_section",
                    "individual_contact_details",
                ],
                "fields": ["primary_phone", "address_descriptor"],
            },
        ],
    }
}


def _ensure_pkg(name: str) -> ModuleType:
    if name not in sys.modules:
        mod = ModuleType(name)
        mod.__path__ = []  # type: ignore[attr-defined]
        sys.modules[name] = mod
    return sys.modules[name]


def _load_auth_service_module():
    core = _ensure_pkg("openg2p_registry_core")
    core.__path__ = [str(_CORE_SRC)]  # type: ignore[attr-defined]

    errors = _ensure_pkg("openg2p_registry_core.errors")

    class _Code:
        def __init__(self, pair):
            self.value = pair

    class G2PRegistryErrorCodes:
        REGISTRANT_AUTH_SESSION_INVALID_OR_EXPIRED = _Code(("x", "REG-AUTH-001"))
        REGISTRANT_AUTH_RECORD_NOT_FOUND = _Code(("x", "REG-AUTH-002"))
        REGISTRANT_AUTH_PROVIDER_MISCONFIGURED = _Code(("x", "REG-AUTH-003"))

    class G2PRegistryException(Exception):
        def __init__(self, code=None, message=None):
            self.code = code
            self.message = message
            super().__init__(message)

    errors.G2PRegistryErrorCodes = G2PRegistryErrorCodes
    errors.G2PRegistryException = G2PRegistryException

    models = _ensure_pkg("openg2p_registry_core.models")

    class AuthenticationStatusEnum:
        success = SimpleNamespace(value="SUCCESS")
        failure = SimpleNamespace(value="FAILURE")
        pending = SimpleNamespace(value="PENDING")

    class ChangeActionEnum:
        UPDATE = SimpleNamespace(value="UPDATE")
        ADD = SimpleNamespace(value="ADD")

    class ChangeRequestSourceEnum:
        STAFF_PORTAL = SimpleNamespace(value="STAFF_PORTAL")

    models.AuthenticationStatusEnum = AuthenticationStatusEnum
    models.ChangeActionEnum = ChangeActionEnum
    models.ChangeRequestSourceEnum = ChangeRequestSourceEnum
    models.G2PRegistrantAuthentication = object
    models.G2PRegistrantAuthenticationProvider = object
    models.G2PRegister = object
    models.G2PRegisterDefinition = object
    models.G2PRegisterSection = object
    models.G2PRegisterUITab = object

    schemas = _ensure_pkg("openg2p_registry_core.schemas")

    class ChangePayload:
        def __init__(self, **kwargs):
            self.__dict__.update(kwargs)
            self._kwargs = kwargs

    class ChangeRequestRequestPayload:
        def __init__(self, **kwargs):
            self.__dict__.update(kwargs)
            self._kwargs = kwargs

    schemas.ChangePayload = ChangePayload
    schemas.ChangeRequestRequestPayload = ChangeRequestRequestPayload

    config = _ensure_pkg("openg2p_registry_core.config")

    class Settings:
        @staticmethod
        def get_config():
            return SimpleNamespace(registrant_auth_claims_encryption_key=None)

    config.Settings = Settings

    fastapi_common = _ensure_pkg("openg2p_fastapi_common")
    service_mod = _ensure_pkg("openg2p_fastapi_common.service")

    class BaseService:
        @classmethod
        def get_component(cls):
            return cls()

    service_mod.BaseService = BaseService
    fastapi_common.service = service_mod

    context_mod = _ensure_pkg("openg2p_fastapi_common.context")

    class _DbEngine:
        def get(self):
            return MagicMock()

    context_mod.dbengine = _DbEngine()
    context_mod.get_async_session_maker = MagicMock()
    crypto_helper = _ensure_pkg("openg2p_fastapi_common.crypto")

    class CryptoFactory:
        @staticmethod
        def get():
            return None

    crypto_helper.CryptoFactory = CryptoFactory

    _ensure_pkg("iam_core")
    iam_models = _ensure_pkg("iam_core.models")
    iam_models.LoginProvider = object
    iam_schemas = _ensure_pkg("iam_core.schemas")

    class TokenEndpointAuthMethod:
        private_key_jwt_keymanager = "private_key_jwt_keymanager"

        def __init__(self, value):
            self.value = value

    iam_schemas.TokenEndpointAuthMethod = TokenEndpointAuthMethod
    iam_schemas.AuthTransaction = object
    iam_tx = _ensure_pkg("iam_core.services.auth_transaction_store")
    iam_tx.AuthTransactionStore = object
    iam_redis = _ensure_pkg("iam_core.services.redis_auth_transaction_store")
    iam_redis.RedisAuthTransactionStore = object
    iam_adapters = _ensure_pkg("iam_core.user_auth.adapters")

    class AdapterFactory:
        @staticmethod
        def get_component():
            return MagicMock()

    iam_adapters.AdapterFactory = AdapterFactory

    fernet_mod = _ensure_pkg("cryptography.fernet")

    class Fernet:
        def __init__(self, *a, **k):
            pass

        def encrypt(self, raw):
            return raw

    fernet_mod.Fernet = Fernet

    services_pkg = _ensure_pkg("openg2p_registry_core.services")
    services_pkg.__path__ = [str(_CORE_SRC / "services")]  # type: ignore[attr-defined]

    mapper_spec = importlib.util.spec_from_file_location(
        "openg2p_registry_core.services.registrant_auth_userinfo_mapper",
        _MAPPER_PATH,
    )
    mapper_mod = importlib.util.module_from_spec(mapper_spec)
    assert mapper_spec.loader is not None
    sys.modules["openg2p_registry_core.services.registrant_auth_userinfo_mapper"] = mapper_mod
    mapper_spec.loader.exec_module(mapper_mod)

    cr_svc_mod = _ensure_pkg(
        "openg2p_registry_core.services.g2p_register_change_request_service"
    )

    class G2PRegisterChangeRequestService:
        @staticmethod
        def get_component():
            raise RuntimeError("override in test")

    cr_svc_mod.G2PRegisterChangeRequestService = G2PRegisterChangeRequestService

    sa = _ensure_pkg("sqlalchemy")
    sa.desc = lambda x: x
    sa.select = MagicMock()
    sa.or_ = MagicMock()
    sa_asyncio = _ensure_pkg("sqlalchemy.ext.asyncio")
    sa_asyncio.async_sessionmaker = MagicMock()

    spec = importlib.util.spec_from_file_location(
        "openg2p_registry_core.services.g2p_registrant_authentication_service",
        _AUTH_SERVICE_PATH,
    )
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules[
        "openg2p_registry_core.services.g2p_registrant_authentication_service"
    ] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module")
def auth_mod():
    return _load_auth_service_module()


@pytest.mark.asyncio
async def test_create_pending_crs_from_userinfo_creates_update_crs(auth_mod):
    service = auth_mod.G2PRegistrantAuthenticationService.__new__(
        auth_mod.G2PRegistrantAuthenticationService
    )

    demographic_section = SimpleNamespace(
        section_id="individual_demographic_section",
        section_register_id="a1a4d25a-1cd4-4356-abac-985a0b3c6bcd",
        section_mnemonic="individual_demographic_details",
    )
    contact_section = SimpleNamespace(
        section_id="individual_contact_section",
        section_register_id="a1a4d25a-1cd4-4356-abac-985a0b3c6bcd",
        section_mnemonic="individual_contact_details",
    )

    async def find_section(_session, _register_id, section_mapping):
        keys = set(section_mapping.section_keys)
        if "individual_demographic_section" in keys:
            return demographic_section
        if "individual_contact_section" in keys:
            return contact_section
        return None

    service._find_register_section = find_section  # type: ignore[method-assign]
    service._find_tab_id = AsyncMock(return_value="individual_info_tab")  # type: ignore[method-assign]

    created_payloads = []

    class FakeCR:
        def __init__(self, change_request_id):
            self.change_request_id = change_request_id

    class FakeCRService:
        async def create_change_request(self, **kwargs):
            created_payloads.append(kwargs)
            return FakeCR(f"cr-{len(created_payloads)}")

    with patch.object(
        auth_mod.G2PRegisterChangeRequestService,
        "get_component",
        return_value=FakeCRService(),
    ):
        ids = await service._create_pending_crs_from_userinfo(
            session=MagicMock(),
            register_id="a1a4d25a-1cd4-4356-abac-985a0b3c6bcd",
            internal_record_id="rec-1",
            created_by="staff-42",
            user_claims={
                "name": "Abebe Bekele Tessema",
                "gender": "Male",
                "birthdate": "1990-01-02",
                "phone_number": "+251911223344",
                "address": "Addis Ababa",
                "individual_id": "FAN-1",
            },
            provider_config=NSR_STYLE_PROVIDER_CONFIG,
        )

    assert ids == ["cr-1", "cr-2"]
    assert len(created_payloads) == 2
    for call in created_payloads:
        assert call["change_request_source"] == "STAFF_PORTAL"
        assert call["change_request_request_payload"].change_payload[0].edit_action == "UPDATE"
        # Token is resolved inside AWE start only when enabled + policy applies.
        assert call["bearer_token"] is None


@pytest.mark.asyncio
async def test_skips_when_provider_has_no_change_request_config(auth_mod):
    service = auth_mod.G2PRegistrantAuthenticationService.__new__(
        auth_mod.G2PRegistrantAuthenticationService
    )
    cr_mock = MagicMock()
    cr_mock.create_change_request = AsyncMock()

    with patch.object(
        auth_mod.G2PRegisterChangeRequestService,
        "get_component",
        return_value=cr_mock,
    ):
        ids = await service._create_pending_crs_from_userinfo(
            session=MagicMock(),
            register_id="reg-1",
            internal_record_id="rec-1",
            created_by="staff-42",
            user_claims={"name": "Someone"},
            provider_config={"scope": "openid"},
        )

    assert ids == []
    cr_mock.create_change_request.assert_not_called()


@pytest.mark.asyncio
async def test_skips_when_no_mappable_claims(auth_mod):
    service = auth_mod.G2PRegistrantAuthenticationService.__new__(
        auth_mod.G2PRegistrantAuthenticationService
    )
    service._find_tab_id = AsyncMock(return_value="individual_info_tab")  # type: ignore[method-assign]
    cr_mock = MagicMock()
    cr_mock.create_change_request = AsyncMock()

    with patch.object(
        auth_mod.G2PRegisterChangeRequestService,
        "get_component",
        return_value=cr_mock,
    ):
        ids = await service._create_pending_crs_from_userinfo(
            session=MagicMock(),
            register_id="reg-1",
            internal_record_id="rec-1",
            created_by="staff-42",
            user_claims={"individual_id": "FAN-1", "sub": "x"},
            provider_config=NSR_STYLE_PROVIDER_CONFIG,
        )

    assert ids == []
    cr_mock.create_change_request.assert_not_called()
