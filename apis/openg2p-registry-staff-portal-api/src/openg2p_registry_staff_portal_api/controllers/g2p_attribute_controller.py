import logging
from typing import List
from openg2p_fastapi_common.controller import BaseController

from openg2p_registry_core.controller_services import G2PAttributeControllerService
from openg2p_registry_core.schemas import (
    GetG2PAttributeValuesRequest,
    GetG2PAttributeValuesResponse,
    G2PAttributeValueData,
)
from iam_core.user_auth.helpers import require_permissions

from ..helpers import RequestResponseHelper
from ..config import Settings

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class G2PAttributeController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.router.tags += ["/attributes"]
        self.g2p_attribute_controller_service = G2PAttributeControllerService.get_component()
        self.helper = RequestResponseHelper.get_component()
        self.router.prefix = "/attributes"

        self.router.add_api_route(
            "/get_g2p_attribute_values",
            self.get_g2p_attribute_values,
            responses={200: {"model": GetG2PAttributeValuesResponse}},
            methods=["POST"],
        )

    @require_permissions({"referenceData:view"})
    async def get_g2p_attribute_values(
        self,
        request: GetG2PAttributeValuesRequest,
    ) -> GetG2PAttributeValuesResponse:
        _logger.debug("Get G2P Attribute Values Request: %s", request)
        try:
            attribute_values: List[G2PAttributeValueData] = await self.g2p_attribute_controller_service.get_attribute_values(
                request
            )

            _logger.debug("Attribute values: %s", attribute_values)

            return self.helper.construct_attribute_values_success_response(
                attribute_values, request
            )
        except Exception as e:
            _logger.error("Error getting attribute values: %s", str(e), exc_info=True)
            return self.helper.construct_error_response(e, request)
