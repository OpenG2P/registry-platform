import logging
from datetime import datetime

from openg2p_fastapi_common.controller import BaseController
from openg2p_fastapi_common.schemas import G2PResponseHeader, G2PResponseStatus
from iam_core.user_auth.decorators import require_permissions

from openg2p_registry_core.controller_services import G2PDataPolicyControllerService
from openg2p_registry_core.schemas import (
    AddPolicyRequest,
    AddPolicyResponse,
    AddPolicyResponseBody,
    GetPoliciesRequest,
    GetPoliciesResponse,
    GetPoliciesResponseBody,
    RemovePolicyRequest,
    RemovePolicyResponse,
    RemovePolicyResponseBody,
)

from ..config import Settings
from ..helpers import RequestResponseHelper

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class G2PDataPolicyController(BaseController):
    """HTTP surface for registry record-level data policies."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.router.tags += ["/data-policy"]
        self.controller_service = G2PDataPolicyControllerService.get_component()
        self.helper = RequestResponseHelper.get_component()
        self.router.prefix = "/data-policy"

        self.router.add_api_route(
            "/get_policies",
            self.get_policies,
            responses={200: {"model": GetPoliciesResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/add_policy",
            self.add_policy,
            responses={200: {"model": AddPolicyResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/remove_policy",
            self.remove_policy,
            responses={200: {"model": RemovePolicyResponse}},
            methods=["POST"],
        )

    @require_permissions({"registerDefinition:view"})
    async def get_policies(
        self, get_policies_request: GetPoliciesRequest
    ) -> GetPoliciesResponse:
        try:
            policies_payload = await self.controller_service.get_policies(get_policies_request)
            response_body = GetPoliciesResponseBody(response_payload=policies_payload)
            g2p_response_header = G2PResponseHeader(
                request_id=get_policies_request.request_header.request_id,
                response_status=G2PResponseStatus.SUCCESS,
                response_error_code="",
                response_error_message="",
                response_timestamp=datetime.now(),
            )
            return GetPoliciesResponse(
                response_header=g2p_response_header,
                response_body=response_body,
            )
        except Exception as error_exception:
            _logger.error("Error in get_policies: %s", error_exception)
            return self.helper.construct_error_response(error_exception, get_policies_request)

    @require_permissions({"registerDefinition:create"})
    async def add_policy(self, add_policy_request: AddPolicyRequest) -> AddPolicyResponse:
        try:
            policy_payload = await self.controller_service.add_policy(add_policy_request)
            response_body = AddPolicyResponseBody(response_payload=policy_payload)
            g2p_response_header = G2PResponseHeader(
                request_id=add_policy_request.request_header.request_id,
                response_status=G2PResponseStatus.SUCCESS,
                response_error_code="",
                response_error_message="",
                response_timestamp=datetime.now(),
            )
            return AddPolicyResponse(
                response_header=g2p_response_header,
                response_body=response_body,
            )
        except Exception as error_exception:
            _logger.error("Error in add_policy: %s", error_exception)
            return self.helper.construct_error_response(error_exception, add_policy_request)

    @require_permissions({"registerDefinition:delete"})
    async def remove_policy(
        self, remove_policy_request: RemovePolicyRequest
    ) -> RemovePolicyResponse:
        try:
            payload = await self.controller_service.remove_policy(remove_policy_request)
            response_body = RemovePolicyResponseBody(response_payload=payload)
            g2p_response_header = G2PResponseHeader(
                request_id=remove_policy_request.request_header.request_id,
                response_status=G2PResponseStatus.SUCCESS,
                response_error_code="",
                response_error_message="",
                response_timestamp=datetime.now(),
            )
            return RemovePolicyResponse(
                response_header=g2p_response_header,
                response_body=response_body,
            )
        except Exception as error_exception:
            _logger.error("Error in remove_policy: %s", error_exception)
            return self.helper.construct_error_response(error_exception, remove_policy_request)
