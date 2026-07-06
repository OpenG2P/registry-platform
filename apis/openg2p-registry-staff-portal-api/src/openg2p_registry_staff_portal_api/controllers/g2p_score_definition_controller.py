import logging
from datetime import datetime

from openg2p_fastapi_common.controller import BaseController
from openg2p_fastapi_common.schemas import G2PResponseHeader, G2PResponseStatus
from iam_core.user_auth.decorators import require_permissions

from openg2p_registry_core.controller_services import G2PScoreDefinitionControllerService
from openg2p_registry_core.schemas import (
    CreateScoreDefinitionRequest,
    CreateScoreDefinitionResponse,
    CreateScoreDefinitionResponseBody,
    DeleteScoreDefinitionRequest,
    DeleteScoreDefinitionResponse,
    DeleteScoreDefinitionResponseBody,
    GetScoreDefinitionsRequest,
    GetScoreDefinitionsResponse,
    GetScoreDefinitionsResponseBody,
    UpdateScoreDefinitionRequest,
    UpdateScoreDefinitionResponse,
    UpdateScoreDefinitionResponseBody,
)

from ..config import Settings
from ..helpers import RequestResponseHelper

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class G2PScoreDefinitionController(BaseController):
    """HTTP surface for score definition headers only (not contributing-attribute rows)."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.router.tags += ["/computation-score"]
        self.controller_service = G2PScoreDefinitionControllerService.get_component()
        self.helper = RequestResponseHelper.get_component()
        self.router.prefix = "/computation-score"

        self.router.add_api_route(
            "/get_score_definitions",
            self.get_score_definitions,
            responses={200: {"model": GetScoreDefinitionsResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/create_score_definition",
            self.create_score_definition,
            responses={200: {"model": CreateScoreDefinitionResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/update_score_definition",
            self.update_score_definition,
            responses={200: {"model": UpdateScoreDefinitionResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/delete_score_definition",
            self.delete_score_definition,
            responses={200: {"model": DeleteScoreDefinitionResponse}},
            methods=["POST"],
        )

    @require_permissions({"registerScore:view"})
    async def get_score_definitions(
        self, get_score_definitions_request: GetScoreDefinitionsRequest
    ) -> GetScoreDefinitionsResponse:
        try:
            definitions_payload, pagination = await self.controller_service.get_score_definitions(
                get_score_definitions_request
            )
            response_body = GetScoreDefinitionsResponseBody(
                pagination_response=pagination,
                response_payload=definitions_payload,
            )
            g2p_response_header = G2PResponseHeader(
                request_id=get_score_definitions_request.request_header.request_id,
                response_status=G2PResponseStatus.SUCCESS,
                response_error_code="",
                response_error_message="",
                response_timestamp=datetime.now(),
            )
            return GetScoreDefinitionsResponse(
                response_header=g2p_response_header,
                response_body=response_body,
            )
        except Exception as error_exception:
            _logger.error(
                f"Error in get_score_definitions: {str(error_exception)}"
            )
            return self.helper.construct_error_response(
                error_exception, get_score_definitions_request
            )

    @require_permissions({"registerScore:create"})
    async def create_score_definition(
        self, create_score_definition_request: CreateScoreDefinitionRequest
    ) -> CreateScoreDefinitionResponse:
        try:
            score_definition_payload = await self.controller_service.create_score_definition(
                create_score_definition_request
            )
            response_body = CreateScoreDefinitionResponseBody(
                response_payload=score_definition_payload
            )
            g2p_response_header = G2PResponseHeader(
                request_id=create_score_definition_request.request_header.request_id,
                response_status=G2PResponseStatus.SUCCESS,
                response_error_code="",
                response_error_message="",
                response_timestamp=datetime.now(),
            )
            return CreateScoreDefinitionResponse(
                response_header=g2p_response_header,
                response_body=response_body,
            )
        except Exception as error_exception:
            _logger.error(
                f"Error in create_score_definition: {str(error_exception)}"
            )
            return self.helper.construct_error_response(
                error_exception, create_score_definition_request
            )

    @require_permissions({"registerScore:edit"})
    async def update_score_definition(
        self, update_score_definition_request: UpdateScoreDefinitionRequest
    ) -> UpdateScoreDefinitionResponse:
        try:
            score_definition_payload = await self.controller_service.update_score_definition(
                update_score_definition_request
            )
            response_body = UpdateScoreDefinitionResponseBody(
                response_payload=score_definition_payload
            )
            g2p_response_header = G2PResponseHeader(
                request_id=update_score_definition_request.request_header.request_id,
                response_status=G2PResponseStatus.SUCCESS,
                response_error_code="",
                response_error_message="",
                response_timestamp=datetime.now(),
            )
            return UpdateScoreDefinitionResponse(
                response_header=g2p_response_header,
                response_body=response_body,
            )
        except Exception as error_exception:
            _logger.error(
                f"Error in update_score_definition: {str(error_exception)}"
            )
            return self.helper.construct_error_response(
                error_exception, update_score_definition_request
            )

    @require_permissions({"registerScore:edit"})
    async def delete_score_definition(
        self, delete_score_definition_request: DeleteScoreDefinitionRequest
    ) -> DeleteScoreDefinitionResponse:
        try:
            payload = await self.controller_service.delete_score_definition(
                delete_score_definition_request
            )
            response_body = DeleteScoreDefinitionResponseBody(response_payload=payload)
            g2p_response_header = G2PResponseHeader(
                request_id=delete_score_definition_request.request_header.request_id,
                response_status=G2PResponseStatus.SUCCESS,
                response_error_code="",
                response_error_message="",
                response_timestamp=datetime.now(),
            )
            return DeleteScoreDefinitionResponse(
                response_header=g2p_response_header,
                response_body=response_body,
            )
        except Exception as error_exception:
            _logger.error(
                f"Error in delete_score_definition: {str(error_exception)}"
            )
            return self.helper.construct_error_response(
                error_exception, delete_score_definition_request
            )
