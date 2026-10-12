"""A registrant authentication provider may only be used for its own register.

The provider id arrives from the caller. Without this check an agent could
name another register's provider -- a mock or test IdP, say -- and obtain a
"successful" authentication for a record in this register.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from iam_core.services.auth_transaction_store import AuthTransactionStore

from openg2p_registry_core.errors import G2PRegistryErrorCodes, G2PRegistryException
from openg2p_registry_core.models import (
    G2PRegisterDefinition,
    G2PRegistrantAuthenticationProvider,
)
from openg2p_registry_core.services import g2p_registrant_authentication_service as svc_module
from openg2p_registry_core.services.g2p_registrant_authentication_service import (
    G2PRegistrantAuthenticationService,
)

THIS_REGISTER = "reg-farmer"
OTHER_REGISTER = "reg-other"


def _provider(register_id: str) -> SimpleNamespace:
    return SimpleNamespace(
        provider_id="prov-1",
        provider_name="eSignet",
        register_id=register_id,
        is_active=True,
        adapter_name="esignet",
        provider_config={},
        token_endpoint_auth_method="private_key_jwt",
        oauth_callback_url="https://registry/callback",
        server_metadata_url="https://idp/.well-known/openid-configuration",
        authorization_endpoint=None,
        token_endpoint=None,
        userinfo_endpoint=None,
        jwks_endpoint=None,
        client_id="client",
        client_secret=None,
        client_private_key=None,
    )


def _service(provider: SimpleNamespace):
    """The service with its DB session and IdP adapter stubbed out."""
    register = SimpleNamespace(register_id=THIS_REGISTER, requires_registrant_authentication=True)

    async def get(model, key):
        if model is G2PRegisterDefinition:
            return register if key == THIS_REGISTER else None
        if model is G2PRegistrantAuthenticationProvider:
            return provider if key == provider.provider_id else None
        return None

    session = MagicMock()
    session.get = AsyncMock(side_effect=get)
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session_cm = MagicMock()
    session_cm.__aenter__ = AsyncMock(return_value=session)
    session_cm.__aexit__ = AsyncMock(return_value=False)

    adapter = MagicMock()
    adapter.build_authorize_redirect = AsyncMock(return_value=("https://idp/authorize?x", "state"))

    service = G2PRegistrantAuthenticationService.__new__(G2PRegistrantAuthenticationService)
    service._auth_tx_store = AuthTransactionStore(ttl_seconds=300)
    service._adapters = MagicMock(resolve_for_provider=MagicMock(return_value=adapter))
    service._crypto = None
    return service, session, (lambda: session_cm)


async def _start(service, session_maker):
    with patch.object(svc_module, "get_async_session_maker", return_value=session_maker):
        return await service.start_authentication(
            register_id=THIS_REGISTER,
            internal_record_id="rec-1",
            provider_id="prov-1",
            initiated_by_staff_id="agent-1",
            foundational_id="FID-1",
        )


@pytest.mark.asyncio
async def test_provider_of_another_register_is_refused():
    service, session, session_maker = _service(_provider(OTHER_REGISTER))
    with pytest.raises(G2PRegistryException) as exc:
        await _start(service, session_maker)
    assert exc.value.code == G2PRegistryErrorCodes.REGISTRANT_AUTH_PROVIDER_NOT_FOUND.value[1]
    # Refused before anything was recorded: no pending authentication row.
    session.add.assert_not_called()


@pytest.mark.asyncio
async def test_provider_of_this_register_starts_authentication():
    service, session, session_maker = _service(_provider(THIS_REGISTER))
    state, url, provider_name = await _start(service, session_maker)
    assert url.startswith("https://idp/authorize")
    assert provider_name == "eSignet"
    session.add.assert_called_once()
