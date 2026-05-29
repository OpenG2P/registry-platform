import logging
from typing import List
from openg2p_fastapi_common.service import BaseService

from ..services import G2PAttributeService
from ..schemas import (
    GetG2PAttributeValuesRequest,
    G2PAttributeValueData
)

_logger = logging.getLogger('g2p-attribute-controller-service')


class G2PAttributeControllerService(BaseService):

    async def get_attribute_values(
        self,
        get_attribute_values_request: GetG2PAttributeValuesRequest
    ) -> List[G2PAttributeValueData]:
        """
        Get attribute values through controller service.
        
        Args:
            get_attribute_values_request: Request containing attribute_id and optional parent_value_id
            
        Returns:
            List of G2PAttributeValueData
        """
        _logger.info("Fetching attribute values through controller service")
        g2p_attribute_service = G2PAttributeService.get_component()
        
        request_payload = get_attribute_values_request.request_body.request_payload
        
        attribute_values: List[G2PAttributeValueData] = await g2p_attribute_service.get_attribute_values(
            attribute_id=request_payload.attribute_id,
            parent_value_id=request_payload.parent_value_id
        )
        
        return attribute_values

