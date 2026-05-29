import logging
from datetime import datetime

from openg2p_fastapi_common.controller import BaseController

from openg2p_registry_core.controller_services import G2PScoreControllerService
from openg2p_registry_core.schemas import (
    GetScoresRequest, GetScoresResponse, GetScoresResponseBody,
    GetScoreHistoryRequest, GetScoreHistoryResponse, GetScoreHistoryResponseBody,
    GetScoreDefinitionsRequest, GetScoreDefinitionsResponse, GetScoreDefinitionsResponseBody,
    CreateScoreDefinitionRequest, CreateScoreDefinitionResponse, CreateScoreDefinitionResponseBody,
    UpdateScoreDefinitionRequest, UpdateScoreDefinitionResponse, UpdateScoreDefinitionResponseBody,
)
from openg2p_fastapi_common.schemas import G2PResponseHeader, G2PResponseStatus
from iam_core.user_auth.helpers import require_permissions

from ..helpers import RequestResponseHelper
from ..config import Settings

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class G2PScoreController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.router.tags += ["/register-data"]
        self.g2p_score_controller_service = G2PScoreControllerService.get_component()
        self.helper = RequestResponseHelper.get_component()
        self.router.prefix = "/register-data"

        self.router.add_api_route(
            "/get_scores",
            self.get_scores,
            responses={200: {"model": GetScoresResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_score_history",
            self.get_score_history,
            responses={200: {"model": GetScoreHistoryResponse}},
            methods=["POST"],
        )

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

    @require_permissions({"register:view"})
    async def get_scores(self, get_scores_request: GetScoresRequest) -> GetScoresResponse:
        try:
            scores_payload = await self.g2p_score_controller_service.get_scores_for_record(
                get_scores_request
            )
            response_body = GetScoresResponseBody(response_payload=scores_payload)
            g2p_response_header = G2PResponseHeader(
                request_id=get_scores_request.request_header.request_id,
                response_status=G2PResponseStatus.SUCCESS,
                response_error_code="",
                response_error_message="",
                response_timestamp=datetime.now(),
            )
            return GetScoresResponse(
                response_header=g2p_response_header,
                response_body=response_body,
            )
        except Exception as error_exception:
            _logger.error(f"Error in get_scores: {str(error_exception)}")
            return self.helper.construct_error_response(
                error_exception, get_scores_request
            )

    @require_permissions({"registerHistory:view"})
    async def get_score_history(self, get_score_history_request: GetScoreHistoryRequest) -> GetScoreHistoryResponse:
        try:
            history_payload = await self.g2p_score_controller_service.get_score_history(
                get_score_history_request
            )
            response_body = GetScoreHistoryResponseBody(
                response_payload=history_payload
            )
            g2p_response_header = G2PResponseHeader(
                request_id=get_score_history_request.request_header.request_id,
                response_status=G2PResponseStatus.SUCCESS,
                response_error_code="",
                response_error_message="",
                response_timestamp=datetime.now(),
            )
            return GetScoreHistoryResponse(
                response_header=g2p_response_header,
                response_body=response_body,
            )
        except Exception as error_exception:
            _logger.error(
                f"Error in get_score_history: {str(error_exception)}"
            )
            return self.helper.construct_error_response(
                error_exception, get_score_history_request
            )

    @require_permissions({"registerScore:view"})
    async def get_score_definitions(self, get_score_definitions_request: GetScoreDefinitionsRequest) -> GetScoreDefinitionsResponse:
        try:
            definitions_payload = await self.g2p_score_controller_service.get_score_definitions(
                get_score_definitions_request
            )
            response_body = GetScoreDefinitionsResponseBody(
                response_payload=definitions_payload
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
    async def create_score_definition(self, create_score_definition_request: CreateScoreDefinitionRequest) -> CreateScoreDefinitionResponse:
        try:
            score_definition_payload = await self.g2p_score_controller_service.create_score_definition(
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
    async def update_score_definition(self, update_score_definition_request: UpdateScoreDefinitionRequest) -> UpdateScoreDefinitionResponse:
        try:
            score_definition_payload = await self.g2p_score_controller_service.update_score_definition(
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
