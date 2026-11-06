"""AWE change-request start: soft-skip missing token only when opted in."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest



def _imports():
    """Imported when a test runs, not at collection: other test modules put
    stand-ins into sys.modules while they are collected."""
    from openg2p_registry_core.errors import G2PRegistryException
    from openg2p_registry_core.helpers import AweHelper, master_data_client
    from openg2p_registry_core.services.g2p_awe_integration_service import G2PAweIntegrationService
    from openg2p_registry_core.services.g2p_awe_policy_configuration_service import (
        G2PAwePolicyConfigurationService,
    )

    return (G2PRegistryException, AweHelper, master_data_client, G2PAweIntegrationService,
            G2PAwePolicyConfigurationService)


@pytest.mark.asyncio
async def test_resolve_service_bearer_uses_master_data_client():
    (G2PRegistryException, AweHelper, master_data_client, G2PAweIntegrationService,
     G2PAwePolicyConfigurationService) = _imports()
    service = G2PAweIntegrationService.__new__(G2PAweIntegrationService)
    fake_client = MagicMock()
    fake_client.get_staff_access_token = AsyncMock(return_value="svc-tok")

    with patch.object(master_data_client, "get_master_data_client", return_value=fake_client):
        assert await service._resolve_service_bearer_token() == "svc-tok"
    fake_client.get_staff_access_token.assert_awaited_once()


@pytest.mark.asyncio
async def test_start_change_request_skips_awe_when_flag_and_token_missing():
    (G2PRegistryException, AweHelper, master_data_client, G2PAweIntegrationService,
     G2PAwePolicyConfigurationService) = _imports()
    service = G2PAweIntegrationService.__new__(G2PAweIntegrationService)
    service._awe_enabled = MagicMock(return_value=True)  # type: ignore[method-assign]
    service._resolve_service_bearer_token = AsyncMock(return_value=None)  # type: ignore[method-assign]

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
            G2PAwePolicyConfigurationService,
            "get_component",
            return_value=policy_service,
        ),
        patch.object(
            AweHelper,
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
            skip_awe_when_token_missing=True,
        )

    awe_helper.create_request.assert_not_called()
    assert change_request.awe_request_id is None


@pytest.mark.asyncio
async def test_start_change_request_raises_when_token_missing_by_default():
    (G2PRegistryException, AweHelper, master_data_client, G2PAweIntegrationService,
     G2PAwePolicyConfigurationService) = _imports()
    service = G2PAweIntegrationService.__new__(G2PAweIntegrationService)
    service._awe_enabled = MagicMock(return_value=True)  # type: ignore[method-assign]

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
            G2PAwePolicyConfigurationService,
            "get_component",
            return_value=policy_service,
        ),
        patch.object(
            AweHelper,
            "get_component",
            return_value=awe_helper,
        ),
        pytest.raises(G2PRegistryException),
    ):
        await service.start_change_request_workflow(
            MagicMock(),
            change_request,
            [{"first_name": "A"}],
            bearer_token=None,
            requester="staff-1",
        )

    awe_helper.create_request.assert_not_called()
