import logging
from datetime import datetime

from openg2p_fastapi_common.controller import BaseController
from openg2p_fastapi_common.schemas import G2PResponseHeader, G2PResponseStatus

from openg2p_registry_core.controller_services import (
    G2PCompletionScoreControllerService,
)
from openg2p_registry_core.schemas import (
    GetIdealCompletionScoreForRegisterRequest,
    GetIdealCompletionScoreForSectionRequest,
    GetComputedCompletionScoreForSectionRequest,
    GetComputedCompletionScoreForRecordRequest,
    IdealRegisterScoreResponse,
    IdealRegisterScoreResponseBody,
    IdealSectionScoreResponse,
    IdealSectionScoreResponseBody,
    SectionCompletionScoreResponse,
    SectionCompletionScoreResponseBody,
    RecordCompletionScoreResponse,
    RecordCompletionScoreResponseBody,
)
from iam_core.user_auth.decorators import require_permissions

from ..helpers import RequestResponseHelper
from ..config import Settings

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


def _success_header(request_id: str) -> G2PResponseHeader:
    return G2PResponseHeader(
        request_id=request_id,
        response_status=G2PResponseStatus.SUCCESS,
        response_error_code="",
        response_error_message="",
        response_timestamp=datetime.now(),
    )


class G2PCompletionScoreController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.router.tags += ["/completion-score"]
        self.controller_service = G2PCompletionScoreControllerService.get_component()
        self.helper = RequestResponseHelper.get_component()
        self.router.prefix = "/completion-score"

        self.router.add_api_route(
            "/get_ideal_completion_score_for_register",
            self.get_ideal_completion_score_for_register,
            responses={200: {"model": IdealRegisterScoreResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/get_ideal_completion_score_for_section",
            self.get_ideal_completion_score_for_section,
            responses={200: {"model": IdealSectionScoreResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/get_computed_completion_score_for_section",
            self.get_computed_completion_score_for_section,
            responses={200: {"model": SectionCompletionScoreResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/get_computed_completion_score_for_record",
            self.get_computed_completion_score_for_record,
            responses={200: {"model": RecordCompletionScoreResponse}},
            methods=["POST"],
        )

    @require_permissions({"register:view"})
    async def get_ideal_completion_score_for_register(
        self, request: GetIdealCompletionScoreForRegisterRequest
    ) -> IdealRegisterScoreResponse:
        try:
            data = await self.controller_service.get_ideal_completion_score_for_register(request)
            return IdealRegisterScoreResponse(
                response_header=_success_header(request.request_header.request_id),
                response_body=IdealRegisterScoreResponseBody(response_payload=data),
            )
        except Exception as e:
            _logger.error(f"Error in get_ideal_completion_score_for_register: {e}")
            return self.helper.construct_error_response(e, request)

    @require_permissions({"register:view"})
    async def get_ideal_completion_score_for_section(
        self, request: GetIdealCompletionScoreForSectionRequest
    ) -> IdealSectionScoreResponse:
        try:
            data = await self.controller_service.get_ideal_completion_score_for_section(request)
            return IdealSectionScoreResponse(
                response_header=_success_header(request.request_header.request_id),
                response_body=IdealSectionScoreResponseBody(response_payload=data),
            )
        except Exception as e:
            _logger.error(f"Error in get_ideal_completion_score_for_section: {e}")
            return self.helper.construct_error_response(e, request)

    @require_permissions({"register:view"})
    async def get_computed_completion_score_for_section(
        self, request: GetComputedCompletionScoreForSectionRequest
    ) -> SectionCompletionScoreResponse:
        try:
            data = await self.controller_service.get_computed_completion_score_for_section(request)
            return SectionCompletionScoreResponse(
                response_header=_success_header(request.request_header.request_id),
                response_body=SectionCompletionScoreResponseBody(response_payload=data),
            )
        except Exception as e:
            _logger.error(f"Error in get_computed_completion_score_for_section: {e}")
            return self.helper.construct_error_response(e, request)

    @require_permissions({"register:view"})
    async def get_computed_completion_score_for_record(
        self, request: GetComputedCompletionScoreForRecordRequest
    ) -> RecordCompletionScoreResponse:
        try:
            data = await self.controller_service.get_computed_completion_score_for_record(request)
            return RecordCompletionScoreResponse(
                response_header=_success_header(request.request_header.request_id),
                response_body=RecordCompletionScoreResponseBody(response_payload=data),
            )
        except Exception as e:
            _logger.error(f"Error in get_computed_completion_score_for_record: {e}")
            return self.helper.construct_error_response(e, request)
