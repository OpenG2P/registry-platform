import logging
from typing import List
from openg2p_fastapi_common.service import BaseService

from ..services import G2PVcConfigurationService
from ..schemas import (
    VcConfigurationData,
    VcConfigurationRequest,
)

_logger = logging.getLogger('g2p-vc-configuration-controller-service')


class G2PVcConfigurationControllerService(BaseService):

    async def get_vc_configuration_for_register(
        self, 
        vc_configuration_request: VcConfigurationRequest
    ) -> List[VcConfigurationData]:
        """Get registry vc configurations for particular register_id"""
        _logger.info("Fetching registry vc configuration through controller service")
        g2p_vc_configuration_service = G2PVcConfigurationService.get_component()
        vc_configuration_data: List[VcConfigurationData] = await g2p_vc_configuration_service.get_vc_configuration_for_register(
            register_id=vc_configuration_request.request_body.request_payload.register_id
        )
        return vc_configuration_data
    
    async def get_all_vc_configurations(
        self,
        vc_configuration_request: VcConfigurationRequest
    ) -> List[VcConfigurationData]:
        """Get all registry vc configurations"""
        _logger.info("Fetching all registry vc configurations through controller service")
        g2p_vc_configuration_service = G2PVcConfigurationService.get_component()
        vc_configuration_data: List[VcConfigurationData] = await g2p_vc_configuration_service.get_all_vc_configurations()
        return vc_configuration_data

    async def create_vc_configuration(
        self, 
        vc_configuration_request: VcConfigurationRequest
    ) -> List[VcConfigurationData]:
        """Create registry vc configuration"""
        _logger.info("Create vc configurations through controller service")
        g2p_vc_configuration_service = G2PVcConfigurationService.get_component()
        vc_configuration_data: List[VcConfigurationData] = await g2p_vc_configuration_service.create_vc_configuration(
            register_id=vc_configuration_request.request_body.request_payload.register_id,
            vc_mnemonic=vc_configuration_request.request_body.request_payload.vc_mnemonic,
            descriptor_schema=vc_configuration_request.request_body.request_payload.descriptor_schema
        )
        return vc_configuration_data

    async def edit_descriptor_schema(
        self, 
        vc_configuration_request: VcConfigurationRequest
    ) -> List[VcConfigurationData]:
        """Edit registry vc configuration"""
        _logger.info("Edit vc configurations through controller service")
        g2p_vc_configuration_service = G2PVcConfigurationService.get_component()
        vc_configuration_data: List[VcConfigurationData] = await g2p_vc_configuration_service.edit_descriptor_schema(
            vc_config_id=vc_configuration_request.request_body.request_payload.vc_config_id,
            descriptor_schema=vc_configuration_request.request_body.request_payload.descriptor_schema
        )
        return vc_configuration_data

    async def remove_vc_configuration(
        self, 
        vc_configuration_request: VcConfigurationRequest
    ) -> List[VcConfigurationData]:
        """Delete registry vc configuration"""
        _logger.info("Delete vc configurations through controller service")
        g2p_vc_configuration_service = G2PVcConfigurationService.get_component()
        vc_configuration_data: List[VcConfigurationData] = await g2p_vc_configuration_service.remove_vc_configuration(
            vc_config_id=vc_configuration_request.request_body.request_payload.vc_config_id
        )
        return vc_configuration_data