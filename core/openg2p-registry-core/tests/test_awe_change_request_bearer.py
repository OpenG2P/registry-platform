"""AWE change-request start: token only when needed; missing token skips AWE."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from openg2p_registry_core.helpers import AweHelper
from openg2p_registry_core.helpers.master_data import MasterDataClient
from openg2p_registry_core.services.g2p_awe_integration_service import (
    G2PAweIntegrationService,
)
from openg2p_registry_core.services.g2p_awe_policy_configuration_service import (
    G2PAwePolicyConfigurationService,
)


@pytest.mark.asyncio
async def test_resolve_bearer_prefers_caller_token():
    service = G2PAweIntegrationService.__new__(G2PAweIntegrationService)
    assert await service._resolve_change_request_bearer("  staff-jwt  ") == "staff-jwt"


@pytest.mark.asyncio
async def test_resolve_bearer_falls_back_to_master_data_client():
    service = G2PAweIntegrationService.__new__(G2PAweIntegrationService)
    fake_client = MagicMock()
    fake_client.get_staff_access_token = AsyncMock(return_value="svc-tok")

    with patch.object(MasterDataClient, "get_component", return_value=fake_client):
        assert await service._resolve_change_request_bearer(None) == "svc-tok"
    fake_client.get_staff_access_token.assert_awaited_once()


@pytest.mark.asyncio
async def test_start_change_request_skips_awe_when_token_missing():
    service = G2PAweIntegrationService.__new__(G2PAweIntegrationService)
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
        )

    awe_helper.create_request.assert_not_called()
    assert change_request.awe_request_id is None
