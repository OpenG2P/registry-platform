import logging

from fastapi import Depends, Request
from openg2p_fastapi_common.controller import BaseController
from openg2p_fastapi_common.schemas import G2PResponse

from openg2p_registry_core.controller_services import G2PRegisterChangerequestControllerService
from openg2p_registry_core.helpers.auth_token import bearer_from_request, requester_sub_from_request
from openg2p_registry_core.schemas.change_request import (
    ChangeRequestRequest, ChangeRequestResponse, ChangeRequestResponseBody, ChangeRequestResponsePayload,
    GetNumberOfPendingChangeRequestsRequest,
    GetNumberOfCrossRegisterChangesRequest,
    GetCrossRegisterChangesRequest,
    GetChangeRequestsRequest,
    GetChangeRequestRequest,
    CheckChangeRequestSequenceRequest,
    GetVerificationsRequest,
    AddVerificationRequest,
    GetChangeRequestSummaryDataRequest,
    NumberOfPendingChangeRequestsResponse, NumberOfPendingChangeRequestsResponseBody, NumberOfPendingChangeRequestsData,
    NumberOfCrossRegisterChangesResponse, NumberOfCrossRegisterChangesResponseBody, NumberOfCrossRegisterChangesData,
    CrossRegisterChangeRequestData, CrossRegisterChangesData, CrossRegisterChangesDataResponse, CrossRegisterChangesDataResponseBody,
    ChangeRequestDataResponse, ChangeRequestDataResponseBody,
    ChangeRequestSequenceCheckData,
    ChangeRequestSequenceCheckResponse, ChangeRequestSequenceCheckResponseBody, ChangeRequestData,
    ChangeRequestFlattenedDataResponse, ChangeRequestFlattenedDataResponseBody,
    VerificationsData, VerificationsDataResponse, VerificationsDataResponseBody,
    VerificationDataResponse, VerificationDataResponseBody, VerificationData,
    ChangeRequestSummaryDataResponse, ChangeRequestSummaryDataResponseBody, ChangeRequestSummaryData,
    SearchChangeRequestRequest, ChangeRequestSearchResultsResponse, ChangeRequestSearchResultsResponseBody
)
from iam_core.user_auth.decorators import require_permissions

from ..dependencies import get_data_policy_mnemonics
from ..helpers import RequestResponseHelper
from ..config import Settings

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class G2PRegisterChangerequestController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.router.tags += ["/change-requests"]
        self.g2p_register_change_request_controller_service = G2PRegisterChangerequestControllerService.get_component()
        self.helper = RequestResponseHelper.get_component()
        self.router.prefix = "/change-requests"

        self.router.add_api_route(
            "/create_change_request",
            self.create_change_request,
            responses={200: {"model": ChangeRequestResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/approve_change_request",
            self.approve_change_request,
            responses={200: {"model": ChangeRequestResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/reject_change_request",
            self.reject_change_request,
            responses={200: {"model": ChangeRequestResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_number_of_pending_change_requests",
            self.get_number_of_pending_change_requests,
            responses={200: {"model": NumberOfPendingChangeRequestsResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_number_of_cross_register_changes",
            self.get_number_of_cross_register_changes,
            responses={200: {"model": NumberOfCrossRegisterChangesResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_cross_register_changes",
            self.get_cross_register_changes,
            responses={200: {"model": CrossRegisterChangesDataResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_change_requests",
            self.get_change_requests,
            responses={200: {"model": ChangeRequestFlattenedDataResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_change_request",
            self.get_change_request,
            responses={200: {"model": ChangeRequestDataResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/check_change_request_sequence",
            self.check_change_request_sequence,
            responses={200: {"model": ChangeRequestSequenceCheckResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_verifications_for_change_request",
            self.get_verifications_for_change_request,
            responses={200: {"model": VerificationsDataResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/add_verification_for_change_request",
            self.add_verification_for_change_request,
            responses={200: {"model": VerificationDataResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_register_change_request_summary_data",
            self.get_register_change_request_summary_data,
            responses={200: {"model": ChangeRequestSummaryDataResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/search_in_change_request",
            self.search_in_change_request,
            responses={200: {"model": ChangeRequestSearchResultsResponse}},
            methods=["POST"],
        )

    @require_permissions({"changeRequest:create"})
    async def create_change_request(self, request: Request, change_request_request: ChangeRequestRequest) -> ChangeRequestResponse:
        try:
            change_request_request.request_body.request_payload.created_by = getattr(request.state.auth, "name", "Unknown")
            change_request_response_payload: ChangeRequestResponsePayload = await self.g2p_register_change_request_controller_service.create_change_request(
                change_request_request,
                bearer_token=bearer_from_request(request),
                requester_sub=requester_sub_from_request(request),
            )
            response_body = ChangeRequestResponseBody(response_payload=change_request_response_payload)
            return self.helper.construct_success_response(response_body, change_request_request)
        except Exception as error_exception:
            _logger.error(f"Error in create_change_request: {str(error_exception)}")
            error_response: G2PResponse = self.helper.construct_error_response(error_exception, change_request_request)
            return error_response

    @require_permissions({"changeRequest:approve"})
    async def approve_change_request(self, request: Request, change_request_request: ChangeRequestRequest) -> ChangeRequestResponse:
        try:
            change_request_request.request_body.request_payload.approved_by = getattr(request.state.auth, "name", "Unknown")
            change_request_response_payload: ChangeRequestResponsePayload = await self.g2p_register_change_request_controller_service.approve_change_request(change_request_request)
            response_body = ChangeRequestResponseBody(response_payload=change_request_response_payload)
            return self.helper.construct_success_response(response_body, change_request_request)
        except Exception as error_exception:
            _logger.error(f"Error in approve_change_request: {str(error_exception)}")
            error_response: G2PResponse = self.helper.construct_error_response(error_exception, change_request_request)
            return error_response

    @require_permissions({"changeRequest:approve"})
    async def reject_change_request(self, request: Request, change_request_request: ChangeRequestRequest) -> ChangeRequestResponse:
        try:
            change_request_request.request_body.request_payload.approved_by = getattr(request.state.auth, "name", "Unknown")
            change_request_response_payload: ChangeRequestResponsePayload = await self.g2p_register_change_request_controller_service.reject_change_request(change_request_request)
            response_body = ChangeRequestResponseBody(response_payload=change_request_response_payload)
            return self.helper.construct_success_response(response_body, change_request_request)
        except Exception as error_exception:
            _logger.error(f"Error in reject_change_request: {str(error_exception)}")
            error_response: G2PResponse = self.helper.construct_error_response(error_exception, change_request_request)
            return error_response

    @require_permissions({"changeRequest:view"})
    async def get_number_of_pending_change_requests(self, get_number_of_pending_change_requests_request: GetNumberOfPendingChangeRequestsRequest) -> NumberOfPendingChangeRequestsResponse:
        try:
            number_of_pending_change_requests_data: NumberOfPendingChangeRequestsData = await self.g2p_register_change_request_controller_service.get_number_of_pending_change_requests(get_number_of_pending_change_requests_request)
            response_body = NumberOfPendingChangeRequestsResponseBody(response_payload=number_of_pending_change_requests_data)
            return self.helper.construct_success_response(response_body, get_number_of_pending_change_requests_request)
        except Exception as error_exception:
            _logger.error(f"Error in get_number_of_pending_change_requests: {str(error_exception)}")
            error_response: NumberOfPendingChangeRequestsResponse = self.helper.construct_error_response(error_exception, get_number_of_pending_change_requests_request)
            return error_response

    @require_permissions({"changeRequest:view"})
    async def get_number_of_cross_register_changes(self, get_number_of_cross_register_changes_request: GetNumberOfCrossRegisterChangesRequest) -> NumberOfCrossRegisterChangesResponse:
        try:
            number_of_cross_register_changes_data: NumberOfCrossRegisterChangesData = await self.g2p_register_change_request_controller_service.get_number_of_cross_register_changes(get_number_of_cross_register_changes_request)
            response_body = NumberOfCrossRegisterChangesResponseBody(response_payload=number_of_cross_register_changes_data)
            return self.helper.construct_success_response(response_body, get_number_of_cross_register_changes_request)
        except Exception as error_exception:
            _logger.error(f"Error in get_number_of_cross_register_changes: {str(error_exception)}")
            error_response: NumberOfCrossRegisterChangesResponse = self.helper.construct_error_response(error_exception, get_number_of_cross_register_changes_request)
            return error_response

    @require_permissions({"changeRequest:view"})
    async def get_cross_register_changes(self, get_cross_register_changes_request: GetCrossRegisterChangesRequest) -> CrossRegisterChangesDataResponse:
        try:
            cross_register_changes: list[CrossRegisterChangeRequestData] = await self.g2p_register_change_request_controller_service.get_cross_register_changes(get_cross_register_changes_request)
            response_body = CrossRegisterChangesDataResponseBody(
                response_payload=CrossRegisterChangesData(cross_register_changes=cross_register_changes)
            )
            return self.helper.construct_success_response(response_body, get_cross_register_changes_request)
        except Exception as error_exception:
            _logger.error(f"Error in get_cross_register_changes: {str(error_exception)}")
            error_response: CrossRegisterChangesDataResponse = self.helper.construct_error_response(error_exception, get_cross_register_changes_request)
            return error_response

    @require_permissions({"changeRequest:view"})
    async def get_change_requests(self, get_change_requests_request: GetChangeRequestsRequest) -> ChangeRequestFlattenedDataResponse:
        try:
            change_requests_list, pagination_response = await self.g2p_register_change_request_controller_service.get_change_requests(get_change_requests_request)
            response_body = ChangeRequestFlattenedDataResponseBody(response_payload=change_requests_list)
            return self.helper.construct_success_response(
                response_body,
                get_change_requests_request,
                pagination_response=pagination_response,
            )
        except Exception as error_exception:
            _logger.error(f"Error in get_change_requests: {str(error_exception)}")
            error_response: ChangeRequestFlattenedDataResponse = self.helper.construct_error_response(error_exception, get_change_requests_request)
            return error_response

    @require_permissions({"changeRequest:view"})
    async def get_change_request(
        self,
        get_change_request_request: GetChangeRequestRequest,
        data_policy_mnemonics: list[str] = Depends(get_data_policy_mnemonics),
    ) -> ChangeRequestDataResponse:
        try:
            change_request_data: ChangeRequestData = await self.g2p_register_change_request_controller_service.get_change_request(
                get_change_request_request,
                data_policy_mnemonics=data_policy_mnemonics,
            )
            response_body = ChangeRequestDataResponseBody(response_payload=change_request_data)
            return self.helper.construct_success_response(response_body, get_change_request_request)
        except Exception as error_exception:
            _logger.error(f"Error in get_change_request: {str(error_exception)}")
            error_response: ChangeRequestDataResponse = self.helper.construct_error_response(error_exception, get_change_request_request)
            return error_response

    @require_permissions({"changeRequest:view"})
    async def check_change_request_sequence(
        self, check_change_request_sequence_request: CheckChangeRequestSequenceRequest
    ) -> ChangeRequestSequenceCheckResponse:
        try:
            sequence_check_data: ChangeRequestSequenceCheckData = (
                await self.g2p_register_change_request_controller_service.check_change_request_sequence(
                    check_change_request_sequence_request
                )
            )
            response_body = ChangeRequestSequenceCheckResponseBody(response_payload=sequence_check_data)
            return self.helper.construct_success_response(
                response_body, check_change_request_sequence_request
            )
        except Exception as error_exception:
            _logger.error("Error in check_change_request_sequence: %s", error_exception)
            error_response: ChangeRequestSequenceCheckResponse = self.helper.construct_error_response(
                error_exception, check_change_request_sequence_request
            )
            return error_response

    @require_permissions({"verificationChangeRequest:view"})
    async def get_verifications_for_change_request(self, get_verifications_request: GetVerificationsRequest) -> VerificationsDataResponse:
        try:
            verifications_list, pagination_response = await self.g2p_register_change_request_controller_service.get_verifications_for_change_request(get_verifications_request)
            response_body = VerificationsDataResponseBody(
                response_payload=VerificationsData(verifications=verifications_list)
            )
            return self.helper.construct_success_response(
                response_body,
                get_verifications_request,
                pagination_response=pagination_response,
            )
        except Exception as error_exception:
            _logger.error(f"Error in get_verifications_for_change_request: {str(error_exception)}")
            error_response: VerificationsDataResponse = self.helper.construct_error_response(error_exception, get_verifications_request)
            return error_response

    @require_permissions({"verificationChangeRequest:create"})
    async def add_verification_for_change_request(self, request: Request, add_verification_request: AddVerificationRequest) -> VerificationDataResponse:
        try:
            add_verification_request.request_body.request_payload.verified_by = getattr(request.state.auth, "name", "Unknown")
            verification_data: VerificationData = await self.g2p_register_change_request_controller_service.add_verification_for_change_request(add_verification_request)
            response_body = VerificationDataResponseBody(response_payload=verification_data)
            return self.helper.construct_success_response(response_body, add_verification_request)
        except Exception as error_exception:
            _logger.error(f"Error in add_verification_for_change_request: {str(error_exception)}")
            error_response: VerificationDataResponse = self.helper.construct_error_response(error_exception, add_verification_request)
            return error_response

    @require_permissions({})
    async def get_register_change_request_summary_data(self, get_change_request_summary_data_request: GetChangeRequestSummaryDataRequest) -> ChangeRequestSummaryDataResponse:
        try:
            change_request_summary_data: ChangeRequestSummaryData = await self.g2p_register_change_request_controller_service.get_change_request_summary_data(get_change_request_summary_data_request)
            response_body = ChangeRequestSummaryDataResponseBody(response_payload=change_request_summary_data)
            return self.helper.construct_success_response(response_body, get_change_request_summary_data_request)
        except Exception as error_exception:
            _logger.error(f"Error in get_register_change_request_summary_data: {str(error_exception)}")
            error_response: ChangeRequestSummaryDataResponse = self.helper.construct_error_response(error_exception, get_change_request_summary_data_request)
            return error_response
    
    @require_permissions({"changeRequest:view"})
    async def search_in_change_request(self, search_change_request_request: SearchChangeRequestRequest) -> ChangeRequestSearchResultsResponse:
        try:
            search_results_list, pagination_response = await self.g2p_register_change_request_controller_service.search_in_change_request(search_change_request_request)
            response_body = ChangeRequestSearchResultsResponseBody(response_payload=search_results_list)
            return self.helper.construct_success_response(
                response_body,
                search_change_request_request,
                pagination_response=pagination_response,
            )
        except Exception as error_exception:
            _logger.error(f"Error in search_in_change_request: {str(error_exception)}")
            error_response: ChangeRequestSearchResultsResponse = self.helper.construct_error_response(error_exception, search_change_request_request)
            return error_response
