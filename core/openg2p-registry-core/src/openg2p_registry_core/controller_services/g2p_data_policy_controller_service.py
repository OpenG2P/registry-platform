import logging

from sqlalchemy.ext.asyncio import async_sessionmaker

from openg2p_fastapi_common.context import dbengine
from openg2p_fastapi_common.service import BaseService

from ..schemas import (
    AddPolicyRequest,
    AddPolicyResponsePayload,
    GetPoliciesRequest,
    GetPoliciesResponsePayload,
    RemovePolicyRequest,
    RemovePolicyResponsePayload,
)
from ..errors import G2PRegistryErrorCodes, G2PRegistryException
from ..helpers.data_policy_keycloak_helper import DataPolicyKeycloakHelper
from ..services import G2PDataPolicyService, G2PRegisterService

_logger = logging.getLogger("g2p-data-policy-controller-service")


class G2PDataPolicyControllerService(BaseService):
    async def get_policies(
        self, get_policies_request: GetPoliciesRequest
    ) -> GetPoliciesResponsePayload:
        register_id = get_policies_request.request_body.request_payload.register_id
        _logger.info("Getting data policies for register_id=%s", register_id)

        data_policy_service = G2PDataPolicyService.get_component()
        session_maker = async_sessionmaker(dbengine.get(), expire_on_commit=False)
        async with session_maker() as session:
            policies = await data_policy_service.get_policies_for_register(
                register_id=register_id,
                session=session,
            )
        return GetPoliciesResponsePayload(policies=policies)

    async def add_policy(self, add_policy_request: AddPolicyRequest) -> AddPolicyResponsePayload:
        payload = add_policy_request.request_body.request_payload
        _logger.info(
            "Adding data policy mnemonic=%s for register_id=%s",
            payload.policy_mnemonic,
            payload.register_id,
        )

        register_service = G2PRegisterService.get_component()
        data_policy_service = G2PDataPolicyService.get_component()
        keycloak_helper = DataPolicyKeycloakHelper()
        session_maker = async_sessionmaker(dbengine.get(), expire_on_commit=False)
        async with session_maker() as session:
            await register_service.validate_register_definition(payload.register_id, session)
            policy = await data_policy_service.add_policy(
                policy_mnemonic=payload.policy_mnemonic,
                policy_description=payload.policy_description,
                register_id=payload.register_id,
                policy_filter_expression=payload.policy_filter_expression,
                session=session,
                policy_type=payload.policy_type,
            )
            try:
                await keycloak_helper.create_data_policy_role(
                    policy.policy_mnemonic,
                    policy_description=policy.policy_description,
                )
            except G2PRegistryException as exc:
                _logger.error(
                    "Keycloak sync failed for policy mnemonic=%s: %s",
                    policy.policy_mnemonic,
                    exc,
                )
                raise G2PRegistryException(
                    code=G2PRegistryErrorCodes.KEYCLOAK_SYNC_ERROR.value[1],
                    message=f"Failed to publish data policy role to Keycloak: {exc}",
                ) from exc
            await session.commit()
        return AddPolicyResponsePayload(policy=policy)

    async def remove_policy(
        self, remove_policy_request: RemovePolicyRequest
    ) -> RemovePolicyResponsePayload:
        policy_id = remove_policy_request.request_body.request_payload.policy_id
        _logger.info("Removing data policy policy_id=%s", policy_id)

        data_policy_service = G2PDataPolicyService.get_component()
        keycloak_helper = DataPolicyKeycloakHelper()
        session_maker = async_sessionmaker(dbengine.get(), expire_on_commit=False)
        async with session_maker() as session:
            deleted_id, policy_mnemonic = await data_policy_service.remove_policy(
                policy_id=policy_id,
                session=session,
            )
            try:
                await keycloak_helper.delete_data_policy_role(policy_mnemonic)
            except G2PRegistryException as exc:
                _logger.error(
                    "Keycloak role delete failed for policy mnemonic=%s: %s",
                    policy_mnemonic,
                    exc,
                )
                raise G2PRegistryException(
                    code=G2PRegistryErrorCodes.KEYCLOAK_SYNC_ERROR.value[1],
                    message=f"Failed to remove data policy role from Keycloak: {exc}",
                ) from exc
            await session.commit()
        return RemovePolicyResponsePayload(policy_id=deleted_id)
