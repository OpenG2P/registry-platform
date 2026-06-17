import logging

from fastapi import Request
from openg2p_fastapi_common.controller import BaseController
from openg2p_fastapi_common.schemas import G2PResponse

from openg2p_registry_core.controller_services import (
    G2PChangeRequestCoreControllerService,
)
from openg2p_registry_core.helpers.auth_token import bearer_from_request, requester_sub_from_request
from openg2p_registry_core.schemas import (
    ChangeRequestRequest,
    ChangeRequestResponse,
    ChangeRequestResponsePayload,
)
from iam_core.user_auth.decorators import require_permissions

from ..config import Settings
from ..helpers import RequestResponseHelper

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class G2PChangeRequestCoreController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.router.tags += ["/change-requests-core-data"]
        self.router.prefix = "/change-requests-core-data"
        self.g2p_change_request_core_controller_service = (
            G2PChangeRequestCoreControllerService.get_component()
        )
        self.helper = RequestResponseHelper.get_component()

        self.router.add_api_route(
            "/create_change_request_for_core_data",
            self.create_change_request_for_core_data,
            responses={200: {"model": ChangeRequestResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/approve_change_request_for_core_data",
            self.approve_change_request_for_core_data,
            responses={200: {"model": ChangeRequestResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/reject_change_request_for_core_data",
            self.reject_change_request_for_core_data,
            responses={200: {"model": ChangeRequestResponse}},
            methods=["POST"],
        )

    @require_permissions({"changeRequest:create"})
    async def create_change_request_for_core_data(
        self,
        request: Request,
        change_request_request: ChangeRequestRequest,
    ) -> ChangeRequestResponse:
        try:
            change_request_request.request_body.request_payload.created_by = getattr(
                request.state.auth, "name", "Unknown"
            )
            payload: ChangeRequestResponsePayload = await self.g2p_change_request_core_controller_service.create_change_request_for_core_data(
                change_request_request,
                bearer_token=bearer_from_request(request),
                requester_sub=requester_sub_from_request(request),
            )
            return self.helper.construct_change_request_success_response(
                change_request_response_payload=payload,
                g2p_request=change_request_request,
            )
        except Exception as error_exception:
            _logger.error(
                "Error in create_change_request_for_core_data: %s",
                str(error_exception),
            )
            error_response: G2PResponse = self.helper.construct_error_response(
                error_exception, change_request_request
            )
            return error_response

    @require_permissions({"changeRequest:approve"})
    async def approve_change_request_for_core_data(
        self, change_request_request: ChangeRequestRequest
    ) -> ChangeRequestResponse:
        try:
            payload: ChangeRequestResponsePayload = await self.g2p_change_request_core_controller_service.approve_change_request_for_core_data(
                change_request_request
            )
            return self.helper.construct_change_request_success_response(
                change_request_response_payload=payload,
                g2p_request=change_request_request,
            )
        except Exception as error_exception:
            _logger.error(
                "Error in approve_change_request_for_core_data: %s",
                str(error_exception),
            )
            error_response: G2PResponse = self.helper.construct_error_response(
                error_exception, change_request_request
            )
            return error_response

    @require_permissions({"changeRequest:approve"})
    async def reject_change_request_for_core_data(
        self, change_request_request: ChangeRequestRequest
    ) -> ChangeRequestResponse:
        try:
            payload: ChangeRequestResponsePayload = await self.g2p_change_request_core_controller_service.reject_change_request_for_core_data(
                change_request_request
            )
            return self.helper.construct_change_request_success_response(
                change_request_response_payload=payload,
                g2p_request=change_request_request,
            )
        except Exception as error_exception:
            _logger.error(
                "Error in reject_change_request_for_core_data: %s",
                str(error_exception),
            )
            error_response: G2PResponse = self.helper.construct_error_response(
                error_exception, change_request_request
            )
            return error_response
