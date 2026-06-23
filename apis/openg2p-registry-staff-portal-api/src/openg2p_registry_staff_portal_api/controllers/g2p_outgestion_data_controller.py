import logging
from openg2p_fastapi_common.controller import BaseController
from openg2p_fastapi_common.schemas import G2PPaginationResponse

from openg2p_registry_core.controller_services import G2POutgestionDataControllerService
from openg2p_registry_core.schemas import (
    OutgestionSummaryDataResponse,
    OutgestionSummaryData,
    OutgestionSummaryDataResponseBody,
    GetOutgestionSummaryDataRequest,
    OutgestionDataSearchResultsResponse,
    OutgestionDataSearchResultsResponseBody,
    SearchOutgestionDataRequest,
)
from iam_core.user_auth.decorators import require_permissions

from ..helpers import RequestResponseHelper
from ..config import Settings

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class G2POutgestionDataController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.router.tags += ["/outgestion-data"]
        self.g2p_outgestion_data_controller_service = G2POutgestionDataControllerService.get_component()
        self.helper = RequestResponseHelper.get_component()
        self.router.prefix = "/outgestion-data"

        self.router.add_api_route(
            "/get_outgestion_summary_data",
            self.get_outgestion_summary_data,
            responses={200: {"model": OutgestionSummaryDataResponse}},
            methods=["POST"],
            operation_id="get_outgestion_summary_data",
        )

        self.router.add_api_route(
            "/search_in_outgestion_data",
            self.search_in_outgestion_data,
            responses={200: {"model": OutgestionDataSearchResultsResponse}},
            methods=["POST"],
            operation_id="search_outgestion_data",
        )

    @require_permissions({})
    async def get_outgestion_summary_data(
        self, get_outgestion_summary_data_request: GetOutgestionSummaryDataRequest
    ) -> OutgestionSummaryDataResponse:
        try:
            outgestion_summary_data: OutgestionSummaryData = (
                await self.g2p_outgestion_data_controller_service.get_outgestion_summary_data(
                    get_outgestion_summary_data_request
                )
            )
            return self.helper.construct_success_response(
                OutgestionSummaryDataResponseBody(response_payload=outgestion_summary_data),
                get_outgestion_summary_data_request,
            )
        except Exception as error_exception:
            _logger.error(f"Error in get_outgestion_summary_data: {str(error_exception)}")
            return self.helper.construct_error_response(
                error_exception, get_outgestion_summary_data_request
            )

    @require_permissions({"outgoingMessage:view"})
    async def search_in_outgestion_data(
        self, search_outgestion_data_request: SearchOutgestionDataRequest
    ) -> OutgestionDataSearchResultsResponse:
        try:
            search_results_list, total_items, number_of_pages = (
                await self.g2p_outgestion_data_controller_service.search_in_outgestion_data(
                    search_outgestion_data_request
                )
            )
            return self.helper.construct_success_response(
                OutgestionDataSearchResultsResponseBody(response_payload=search_results_list),
                search_outgestion_data_request,
                G2PPaginationResponse(
                    number_of_items=total_items,
                    number_of_pages=number_of_pages,
                ),
            )
        except Exception as error_exception:
            _logger.error(f"Error in search_in_outgestion_data: {str(error_exception)}")
            return self.helper.construct_error_response(
                error_exception, search_outgestion_data_request
            )
