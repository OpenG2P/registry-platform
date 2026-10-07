import logging
from typing import Dict, Optional
from fastapi import Response
from openg2p_fastapi_common.controller import BaseController

from openg2p_registry_core.controller_services import G2PIngestControllerService
from openg2p_registry_core.schemas import IngestDataPayload, IngestDataRequest, IngestDataResponse
from openg2p_fastapi_common.schemas import G2PResponse

from ..helpers import RequestResponseHelper
from ...audit_context import set_audit_actor, set_audit_outcome
from ...config import Settings
from ...search.dci.helpers import DciKeymanagerHelper

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class G2PIngestController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.router.tags += ["/partner"]
        self.g2p_ingest_controller_service = G2PIngestControllerService.get_component()
        self.request_response_helper = RequestResponseHelper.get_component()
        self.keymanager_helper = DciKeymanagerHelper()
        self.router.prefix = "/partner"

        self.router.add_api_route(
            "/ingest_data",
            self.ingest_data,
            responses={200: {"model": IngestDataResponse}},
            methods=["POST"],
        )

    async def _verify_signature(self, partner_id: str, signature: str, signature_payload) -> None:
        """Detached JWS over the configured signature payload, against the partner's PM key."""
        await self.keymanager_helper.validate_detached_signature(signature, signature_payload, partner_id)

    async def ingest_data(
        self,
        ingest_data_request: IngestDataRequest,
        data_model: Optional[str] = None,
        register_id: Optional[str] = None,
        intake_form_id: Optional[str] = None,
    ) -> Response:
        response_template_store_id: str | None = None
        try:
            _logger.info(f"Data ingestion request received for data_model: {data_model if data_model else 'No data_model detected in query params...'}")

            ingest_data: Dict = await self.request_response_helper.construct_http_request(ingest_data_request)
            if not _config.signature_validation_enabled:
                _logger.warning(
                    "signature_validation_enabled=false — accepting an unverified partner ingest message"
                )

            ingest_data_payload, response_template_store_id = await self.g2p_ingest_controller_service.ingest_data(
                data_model,
                ingest_data,
                register_id=register_id,
                intake_form_id=intake_form_id,
                # The sender must be an active Partner Management partner, and
                # (switch on) its detached JWS at the data model's signature key
                # path must verify over the signature payload key path with that
                # partner's key. on_partner runs only after both checks.
                verify_signature=_config.signature_validation_enabled,
                signature_verifier=self._verify_signature,
                on_partner=lambda partner_id: set_audit_actor(
                    ingest_data_request, partner_id, verified=_config.signature_validation_enabled
                ),
            )
            injest_data_response = self.request_response_helper.construct_ingest_data_success_response(ingest_data_payload, response_template_store_id)
            return injest_data_response

        except Exception as error_exception:
            # Raise exception for testing
            # raise error_exception 
            _logger.error(f"Error in ingest_data: {str(error_exception)}")
            set_audit_outcome(ingest_data_request, "failure", reason=str(getattr(error_exception, "code", "") or "error"))
            error_response: G2PResponse = self.request_response_helper.construct_error_response(error_exception, response_template_store_id)
            return error_response