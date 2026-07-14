import logging
from datetime import datetime
from typing import Dict, Optional

from fastapi import Request, Response
from fastapi.responses import JSONResponse

from openg2p_fastapi_common.controller import BaseController
from openg2p_fastapi_common.schemas import (
    G2PResponseHeader,
    G2PResponseStatus,
)
from openg2p_registry_core.controller_services import G2PIngestControllerService
from openg2p_registry_core.schemas import (
    IngestDataRequest,
    IngestDataResponse,
    IngestDataResponseBody,
    EnqueueImportFileRequest,
    EnqueueImportFileResponse,
    EnqueueImportFileData,
    EnqueueImportFileResponseBody,
)
from openg2p_registry_core.services import InputMechanismDataService
from iam_core.user_auth.decorators import require_permissions

from ..config import Settings
from ..helpers import RequestResponseHelper

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)

class InputMechanismDataController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.router.tags += ["/input-mechanism-data"]
        self.router.prefix = "/input-mechanism-data"

        self.ingest_controller_service = G2PIngestControllerService.get_component()
        self.input_mechanism_data_service = InputMechanismDataService.get_component()
        self.helper = RequestResponseHelper.get_component()

        self.router.add_api_route(
            "/enqueue_import_file",
            self.enqueue_import_file,
            responses={200: {"model": EnqueueImportFileResponse}},
            methods=["POST"],
        )

        # Staff API exposure of partner ingest
        self.router.add_api_route(
            "/ingest-data",
            self.ingest_data,
            responses={200: {"model": IngestDataResponse}},
            methods=["POST"],
        )

    @require_permissions({"intakeSubmission:edit"})
    async def enqueue_import_file(
        self,
        request: Request,
        enqueue_import_file_request: EnqueueImportFileRequest,
    ) -> EnqueueImportFileResponse:
        enqueue_import_file_request.request_body.request_payload.queued_by = getattr(
            request.state.auth, "name", "Unknown"
        )
        payload = enqueue_import_file_request.request_body.request_payload
        import_file_process_queue = await self.input_mechanism_data_service.enqueue_import_file(
            document_id=payload.document_id,
            data_model_id=payload.data_model_id,
            register_id=payload.register_id,
            intake_form_id=payload.intake_form_id,
            queued_by=payload.queued_by or "Unknown",
        )
        response = EnqueueImportFileResponse(
            response_header=G2PResponseHeader(
                request_id=enqueue_import_file_request.request_header.request_id,
                response_status=G2PResponseStatus.SUCCESS,
                response_error_code="",
                response_error_message="",
                response_timestamp=datetime.now(),
            ),
            response_body=EnqueueImportFileResponseBody(
                response_payload=EnqueueImportFileData(import_file_id=import_file_process_queue.import_file_id)
            ),
        )
        return response

    @require_permissions({"intakeSubmission:edit"})
    async def ingest_data(
        self,
        ingest_data_request: IngestDataRequest,
        data_model: Optional[str] = None,
        register_id: Optional[str] = None,
        intake_form_id: Optional[str] = None,
    ) -> Response:
        response_template_store_id: str | None = None
        try:
            body: Dict = await ingest_data_request.json()
            headers: Dict = dict(ingest_data_request.headers)
            ingest_data: Dict = {"headers": headers, "body": body}

            ingest_data_payload, response_template_store_id = await self.ingest_controller_service.ingest_data(
                data_model,
                ingest_data,
                register_id=register_id,
                intake_form_id=intake_form_id,
            )

            g2p_response_header = G2PResponseHeader(
                request_id="",
                response_status=G2PResponseStatus.SUCCESS,
                response_error_code="",
                response_error_message="",
                response_timestamp=datetime.now(),
            )
            response_body = IngestDataResponseBody(response_payload=ingest_data_payload)
            response = IngestDataResponse(
                response_header=g2p_response_header,
                response_body=response_body,
            )
            return JSONResponse(content=response.model_dump(mode="json"))
        except Exception as error_exception:
            _logger.error("Error in ingest_data: %s", str(error_exception), exc_info=True)
            error_response = self.helper.construct_error_response(error_exception)
            return JSONResponse(content=error_response.model_dump(mode="json"))

