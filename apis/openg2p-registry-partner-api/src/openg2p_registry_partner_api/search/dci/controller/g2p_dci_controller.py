import logging
from openg2p_fastapi_common.controller import BaseController

from ..schemas import (
    DciSearchRequestEnvelope,
    DciSearchResponseEnvelope,
    DciRequestHeader,
    DciSearchResponseItem,
    DciSearchRequest,
)
from ..helpers import (
    DciRequestResponseHelper,
    DciKeymanagerHelper,
)
from ..services import G2PDciService
from ....config import Settings

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class G2PDciController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.router.tags += ["/dci/registry"]
        self.g2p_dci_service = G2PDciService()
        self.request_response_helper = DciRequestResponseHelper()
        self.keymanager_helper = DciKeymanagerHelper()
        self.router.prefix = "/dci/registry"

        self.router.add_api_route(
            "/sync/search",
            self.search,
            responses={200: {"model": DciSearchResponseEnvelope}},
            methods=["POST"],
        )

    async def search(self, dci_search_request_env: DciSearchRequestEnvelope) -> DciSearchResponseEnvelope:
        try:
            _logger.info("DCI search request received")

            signature: str = dci_search_request_env.signature
            header: DciRequestHeader = dci_search_request_env.header
            message: DciSearchRequest = dci_search_request_env.message
            # Skip keymanager auth for testing
            # await self.keymanager_helper.validate_signature(signature, header, message)
            
            dci_search_response_items: list[DciSearchResponseItem] = await self.g2p_dci_service.search(signature, header, message)
            
            dci_search_response_env: DciSearchResponseEnvelope = self.request_response_helper.construct_dci_search_success_response(dci_search_response_items, dci_search_request_env)
            # Skip keymanager auth for testing
            dci_search_response_env.signature = "Signature not implemented"
            # dci_search_response_env.signature = await self.keymanager_helper.sign_response(dci_search_response_env.header, dci_search_response_env.message)
            
            return dci_search_response_env

        except Exception as error_exception:
            _logger.error(f"Error in search: {str(error_exception)}")
            error_response: DciSearchResponseEnvelope = self.request_response_helper.construct_error_response(error_exception, dci_search_request_env)
            # Skip keymanager auth for testing
            # error_response.signature = await self.keymanager_helper.sign_response(error_response.header, error_response.message)
            
            return error_response