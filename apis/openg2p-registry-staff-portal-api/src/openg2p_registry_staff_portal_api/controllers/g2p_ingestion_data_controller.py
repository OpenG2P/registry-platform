import logging
from openg2p_fastapi_common.controller import BaseController

from openg2p_registry_core.controller_services import G2PIngestionDataControllerService
from openg2p_registry_core.schemas import (
    IngestionSummaryDataResponse, IngestionSummaryData,
    GetIngestionSummaryDataRequest,
    IngestionDataSearchResultsResponse,
    SearchIngestionDataRequest,
    SearchIngestionDataRequest,
    GetIngestionDataPayloadRequest,
    IngestionDataPayloadResponse,
    IngestionDataPayload
)
from iam_core.user_auth.decorators import require_permissions

from ..helpers import RequestResponseHelper
from ..config import Settings

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class G2PIngestionDataController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.router.tags += ["/ingestion-data"]
        self.g2p_ingestion_data_controller_service = G2PIngestionDataControllerService.get_component()
        self.helper = RequestResponseHelper.get_component()
        self.router.prefix = "/ingestion-data"

        self.router.add_api_route(
            "/get_ingestion_summary_data",
            self.get_ingestion_summary_data,
            responses={200: {"model": IngestionSummaryDataResponse}},
            methods=["POST"],
            operation_id="get_ingestion_summary_data",
        )

        self.router.add_api_route(
            "/search_in_ingestion_data",
            self.search_in_ingestion_data,
            responses={200: {"model": IngestionDataSearchResultsResponse}},
            methods=["POST"],
            operation_id="search_ingestion_data",
        )

        self.router.add_api_route(
            "/get_raw_payload",
            self.get_raw_payload,
            responses={200: {"model": IngestionDataPayloadResponse}},
            methods=["POST"],
            operation_id="get_raw_ingestion_payload",
        )

        self.router.add_api_route(
            "/get_enriched_and_transformed_payload",
            self.get_enriched_and_transformed_payload,
            responses={200: {"model": IngestionDataPayloadResponse}},
            methods=["POST"],
            operation_id="get_enriched_transformed_ingestion_payload",
        )

    @require_permissions({})
    async def get_ingestion_summary_data(self, get_ingestion_summary_data_request: GetIngestionSummaryDataRequest) -> IngestionSummaryDataResponse:
        try:
            ingestion_summary_data: IngestionSummaryData = await self.g2p_ingestion_data_controller_service.get_ingestion_summary_data(get_ingestion_summary_data_request)
            ingestion_summary_data_response: IngestionSummaryDataResponse = self.helper.construct_ingestion_summary_data_success_response(
                ingestion_summary_data=ingestion_summary_data, g2p_request=get_ingestion_summary_data_request
            )
            return ingestion_summary_data_response
        except Exception as error_exception:
            _logger.error(f"Error in get_ingestion_summary_data: {str(error_exception)}")
            error_response: IngestionSummaryDataResponse = self.helper.construct_error_response(error_exception, get_ingestion_summary_data_request)
            return error_response

    @require_permissions({"incomingMessage:view"})
    async def search_in_ingestion_data(self, search_ingestion_data_request: SearchIngestionDataRequest) -> IngestionDataSearchResultsResponse:
        try:
            search_results_list, total_items, number_of_pages = await self.g2p_ingestion_data_controller_service.search_in_ingestion_data(search_ingestion_data_request)
            ingestion_data_search_results_response: IngestionDataSearchResultsResponse = self.helper.construct_ingestion_data_search_results_success_response(
                search_results_list=search_results_list, g2p_request=search_ingestion_data_request,
                number_of_items=total_items, number_of_pages=number_of_pages
            )
            return ingestion_data_search_results_response
        except Exception as error_exception:
            _logger.error(f"Error in search_in_ingestion_data: {str(error_exception)}")
            error_response: IngestionDataSearchResultsResponse = self.helper.construct_error_response(error_exception, search_ingestion_data_request)
            return error_response

    @require_permissions({"incomingMessage:view"})
    async def get_raw_payload(self, get_ingestion_data_payload_request: GetIngestionDataPayloadRequest) -> IngestionDataPayloadResponse:
        try:
            raw_data_payload: IngestionDataPayload = await self.g2p_ingestion_data_controller_service.get_raw_data_payload(get_ingestion_data_payload_request)
            ingestion_data_payload_response: IngestionDataPayloadResponse = self.helper.construct_ingestion_data_payload_success_response(
                data_payload=raw_data_payload, g2p_request=get_ingestion_data_payload_request
            )
            return ingestion_data_payload_response
        except Exception as error_exception:
            _logger.error(f"Error in get_raw_payload: {str(error_exception)}")
            error_response: IngestionDataPayloadResponse = self.helper.construct_error_response(error_exception, get_ingestion_data_payload_request)
            return error_response
    
    @require_permissions({"incomingMessage:view"})
    async def get_enriched_and_transformed_payload(self, get_ingestion_data_payload_request: GetIngestionDataPayloadRequest) -> IngestionDataPayloadResponse:
        try:
            transformed_data_payload: IngestionDataPayload = await self.g2p_ingestion_data_controller_service.get_enriched_and_transformed_data_payload(get_ingestion_data_payload_request)
            ingestion_data_payload_response: IngestionDataPayloadResponse = self.helper.construct_ingestion_data_payload_success_response(
                data_payload=transformed_data_payload, g2p_request=get_ingestion_data_payload_request
            )
            return ingestion_data_payload_response
        except Exception as error_exception:
            _logger.error(f"Error in get_enriched_and_transformed_payload: {str(error_exception)}")
            error_response: IngestionDataPayloadResponse = self.helper.construct_error_response(error_exception, get_ingestion_data_payload_request)
            return error_response
