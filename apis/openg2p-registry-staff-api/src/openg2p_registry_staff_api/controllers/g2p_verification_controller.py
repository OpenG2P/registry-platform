import logging

from fastapi import Request
from openg2p_fastapi_common.controller import BaseController

from openg2p_registry_core.controller_services import G2PVerificationControllerService
from openg2p_registry_core.schemas import (
    GetVerificationsRequest,
    AddVerificationRequest,
    VerificationsDataResponse,
    VerificationDataResponse, VerificationData
)
from iam_core.user_auth.decorators import require_permissions

from ..helpers import RequestResponseHelper
from ..config import Settings

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class G2PVerificationController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.router.tags += ["/verifications"]
        self.g2p_verification_controller_service = G2PVerificationControllerService.get_component()
        self.helper = RequestResponseHelper.get_component()
        self.router.prefix = "/verifications"


        self.router.add_api_route(
            "/get_verifications",
            self.get_verifications,
            responses={200: {"model": VerificationsDataResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/add_verification",
            self.add_verification,
            responses={200: {"model": VerificationDataResponse}},
            methods=["POST"],
        )

    @require_permissions({"verificationIntakeForm:view"})
    async def get_verifications(self, get_verifications_request: GetVerificationsRequest) -> VerificationsDataResponse:
        try:
            verifications_list, total_items, number_of_pages = await self.g2p_verification_controller_service.get_verifications(get_verifications_request)
            verifications_response: VerificationsDataResponse = self.helper.construct_verifications_success_response(
                verifications_list=verifications_list, g2p_request=get_verifications_request,
                number_of_items=total_items, number_of_pages=number_of_pages
            )
            return verifications_response
        except Exception as error_exception:
            _logger.error(f"Error in get_verifications: {str(error_exception)}")
            error_response: VerificationsDataResponse = self.helper.construct_error_response(error_exception, get_verifications_request)
            return error_response

    @require_permissions({"verificationIntakeForm:create"})
    async def add_verification(self, request: Request, add_verification_request: AddVerificationRequest) -> VerificationDataResponse:
        try:
            add_verification_request.request_body.request_payload.verified_by = getattr(request.state.auth, "name", "Unknown")
            verification_data: VerificationData = await self.g2p_verification_controller_service.add_verification(add_verification_request)
            verification_response: VerificationDataResponse = self.helper.construct_verification_success_response(
                verification_data=verification_data, g2p_request=add_verification_request
            )
            return verification_response
        except Exception as error_exception:
            _logger.error(f"Error in add_verification: {str(error_exception)}")
            error_response: VerificationDataResponse = self.helper.construct_error_response(error_exception, add_verification_request)
            return error_response
