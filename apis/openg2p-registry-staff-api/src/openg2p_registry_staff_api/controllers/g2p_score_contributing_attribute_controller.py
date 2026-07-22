import logging
from datetime import datetime

from openg2p_fastapi_common.controller import BaseController
from openg2p_fastapi_common.schemas import G2PResponseHeader, G2PResponseStatus
from iam_core.user_auth.decorators import require_permissions

from openg2p_registry_core.controller_services import G2PScoreContributingAttributeControllerService
from openg2p_registry_core.schemas import (
    CreateScoreContributingAttributeRequest,
    CreateScoreContributingAttributeResponse,
    CreateScoreContributingAttributeResponseBody,
    DeleteScoreContributingAttributeRequest,
    DeleteScoreContributingAttributeResponse,
    DeleteScoreContributingAttributeResponseBody,
    GetAllScoreContributingAttributesRequest,
    GetAllScoreContributingAttributesResponse,
    GetAllScoreContributingAttributesResponseBody,
    UpdateScoreContributingAttributeRequest,
    UpdateScoreContributingAttributeResponse,
    UpdateScoreContributingAttributeResponseBody,
)

from ..config import Settings
from ..helpers import RequestResponseHelper

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class G2PScoreContributingAttributeController(BaseController):
    """HTTP surface for score contributing-attribute rows (CRUD)."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.router.tags += ["/computation-score"]
        self.controller_service = G2PScoreContributingAttributeControllerService.get_component()
        self.helper = RequestResponseHelper.get_component()
        self.router.prefix = "/computation-score"

        self.router.add_api_route(
            "/get_score_contributing_attributes",
            self.get_score_contributing_attributes,
            responses={200: {"model": GetAllScoreContributingAttributesResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/create_score_contributing_attribute",
            self.create_score_contributing_attribute,
            responses={200: {"model": CreateScoreContributingAttributeResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/update_score_contributing_attribute",
            self.update_score_contributing_attribute,
            responses={200: {"model": UpdateScoreContributingAttributeResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/delete_score_contributing_attribute",
            self.delete_score_contributing_attribute,
            responses={200: {"model": DeleteScoreContributingAttributeResponse}},
            methods=["POST"],
        )

    @require_permissions({"registerScore:view"})
    async def get_score_contributing_attributes(
        self, request: GetAllScoreContributingAttributesRequest
    ) -> GetAllScoreContributingAttributesResponse:
        try:
            payload, pagination = await self.controller_service.get_score_contributing_attributes(request)
            response_body = GetAllScoreContributingAttributesResponseBody(
                pagination_response=pagination,
                response_payload=payload,
            )
            g2p_response_header = G2PResponseHeader(
                request_id=request.request_header.request_id,
                response_status=G2PResponseStatus.SUCCESS,
                response_error_code="",
                response_error_message="",
                response_timestamp=datetime.now(),
            )
            return GetAllScoreContributingAttributesResponse(
                response_header=g2p_response_header,
                response_body=response_body,
            )
        except Exception as error_exception:
            _logger.error(
                f"Error in get_score_contributing_attributes: {str(error_exception)}"
            )
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"registerScore:create"})
    async def create_score_contributing_attribute(
        self, request: CreateScoreContributingAttributeRequest
    ) -> CreateScoreContributingAttributeResponse:
        try:
            payload = await self.controller_service.create_score_contributing_attribute(request)
            response_body = CreateScoreContributingAttributeResponseBody(response_payload=payload)
            g2p_response_header = G2PResponseHeader(
                request_id=request.request_header.request_id,
                response_status=G2PResponseStatus.SUCCESS,
                response_error_code="",
                response_error_message="",
                response_timestamp=datetime.now(),
            )
            return CreateScoreContributingAttributeResponse(
                response_header=g2p_response_header,
                response_body=response_body,
            )
        except Exception as error_exception:
            _logger.error(
                f"Error in create_score_contributing_attribute: {str(error_exception)}"
            )
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"registerScore:edit"})
    async def update_score_contributing_attribute(
        self, request: UpdateScoreContributingAttributeRequest
    ) -> UpdateScoreContributingAttributeResponse:
        try:
            payload = await self.controller_service.update_score_contributing_attribute(request)
            response_body = UpdateScoreContributingAttributeResponseBody(response_payload=payload)
            g2p_response_header = G2PResponseHeader(
                request_id=request.request_header.request_id,
                response_status=G2PResponseStatus.SUCCESS,
                response_error_code="",
                response_error_message="",
                response_timestamp=datetime.now(),
            )
            return UpdateScoreContributingAttributeResponse(
                response_header=g2p_response_header,
                response_body=response_body,
            )
        except Exception as error_exception:
            _logger.error(
                f"Error in update_score_contributing_attribute: {str(error_exception)}"
            )
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"registerScore:edit"})
    async def delete_score_contributing_attribute(
        self, request: DeleteScoreContributingAttributeRequest
    ) -> DeleteScoreContributingAttributeResponse:
        try:
            payload = await self.controller_service.delete_score_contributing_attribute(request)
            response_body = DeleteScoreContributingAttributeResponseBody(response_payload=payload)
            g2p_response_header = G2PResponseHeader(
                request_id=request.request_header.request_id,
                response_status=G2PResponseStatus.SUCCESS,
                response_error_code="",
                response_error_message="",
                response_timestamp=datetime.now(),
            )
            return DeleteScoreContributingAttributeResponse(
                response_header=g2p_response_header,
                response_body=response_body,
            )
        except Exception as error_exception:
            _logger.error(
                f"Error in delete_score_contributing_attribute: {str(error_exception)}"
            )
            return self.helper.construct_error_response(error_exception, request)
