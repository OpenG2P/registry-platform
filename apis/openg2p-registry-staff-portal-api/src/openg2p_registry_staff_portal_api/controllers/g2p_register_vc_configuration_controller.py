import logging
from typing import Optional, List
from openg2p_fastapi_common.controller import BaseController

from openg2p_registry_core.controller_services import G2PVcConfigurationControllerService
from openg2p_registry_core.schemas import (
    VcConfigurationData,
    VcConfigurationResponse,
    VcConfigurationRequest,
)
from iam_core.user_auth.helpers import require_permissions

from ..helpers import RequestResponseHelper
from ..config import Settings

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class G2PRegisterVCConfigurationController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.router.tags += ["/vc-config"]
        self.g2p_vc_configuration_service = G2PVcConfigurationControllerService.get_component()
        self.helper = RequestResponseHelper.get_component()
        self.router.prefix = "/vc-config"

        # VC Config endpoints
        self.router.add_api_route(
            "/get_vc_configuration_for_register",
            self.get_vc_configuration_for_register,
            responses={200: {"model": VcConfigurationResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_all_vc_configurations",
            self.get_all_vc_configurations,
            responses={200: {"model": VcConfigurationResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/create_vc_configuration",
            self.create_vc_configuration,
            responses={200: {"model": VcConfigurationResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/edit_descriptor_schema",
            self.edit_descriptor_schema,
            responses={200: {"model": VcConfigurationResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/remove_vc_configuration",
            self.remove_vc_configuration,
            responses={200: {"model": VcConfigurationResponse}},
            methods=["POST"],
        )


    @require_permissions({"registerDefinition:view"})
    async def get_vc_configuration_for_register(
        self, 
        vc_configuration_request: VcConfigurationRequest
    ) -> VcConfigurationResponse:
        try:
            vc_configuration_data: List[VcConfigurationData] = await self.g2p_vc_configuration_service.get_vc_configuration_for_register(vc_configuration_request)
            response: VcConfigurationResponse = self.helper.construct_vc_configuration_data_success_response(
                vc_configuration_data=vc_configuration_data, 
                g2p_request=vc_configuration_request
            )
            return response
        except Exception as error_exception:
            _logger.error(f"Error in get_vc_configuration_for_register: {str(error_exception)}")
            error_response: VcConfigurationResponse = self.helper.construct_error_response(error_exception, vc_configuration_request)
            return error_response
        
    @require_permissions({"registerDefinition:view"})
    async def get_all_vc_configurations(self, vc_configuration_request: VcConfigurationRequest) -> VcConfigurationResponse:
        try:
            vc_configuration_data: List[VcConfigurationData] = await self.g2p_vc_configuration_service.get_all_vc_configurations(vc_configuration_request)
            response: VcConfigurationResponse = self.helper.construct_vc_configuration_data_success_response(
                vc_configuration_data=vc_configuration_data, 
                g2p_request=vc_configuration_request
            )
            return response
        except Exception as error_exception:
            _logger.error(f"Error in get_all_vc_configurations: {str(error_exception)}")
            error_response: VcConfigurationResponse = self.helper.construct_error_response(error_exception, vc_configuration_request)
            return error_response
        
    @require_permissions({"registerDefinition:create"})
    async def create_vc_configuration(self, vc_configuration_request: VcConfigurationRequest) -> VcConfigurationResponse:
        try:
            vc_configuration_data: List[VcConfigurationData] = await self.g2p_vc_configuration_service.create_vc_configuration(vc_configuration_request)
            response: VcConfigurationResponse = self.helper.construct_vc_configuration_data_success_response(
                vc_configuration_data=vc_configuration_data, 
                g2p_request=vc_configuration_request
            )
            return response
        except Exception as error_exception:
            _logger.error(f"Error in create_vc_configuration: {str(error_exception)}")
            error_response: VcConfigurationResponse = self.helper.construct_error_response(error_exception, vc_configuration_request)
            return error_response

    @require_permissions({"registerDefinition:edit"})
    async def edit_descriptor_schema(self, vc_configuration_request: VcConfigurationRequest) -> VcConfigurationResponse:
        try:
            vc_configuration_data: List[VcConfigurationData] = await self.g2p_vc_configuration_service.edit_descriptor_schema(vc_configuration_request)
            response: VcConfigurationResponse = self.helper.construct_vc_configuration_data_success_response(
                vc_configuration_data=vc_configuration_data, 
                g2p_request=vc_configuration_request
            )
            return response
        except Exception as error_exception:
            _logger.error(f"Error in edit_descriptor_schema: {str(error_exception)}")
            error_response: VcConfigurationResponse = self.helper.construct_error_response(error_exception, vc_configuration_request)
            return error_response

    @require_permissions({"registerDefinition:edit"})
    async def remove_vc_configuration(self, vc_configuration_request: VcConfigurationRequest) -> VcConfigurationResponse:
        try:
            vc_configuration_data: List[VcConfigurationData] = await self.g2p_vc_configuration_service.remove_vc_configuration(vc_configuration_request)
            response: VcConfigurationResponse = self.helper.construct_vc_configuration_data_success_response(
                vc_configuration_data=vc_configuration_data, 
                g2p_request=vc_configuration_request
            )
            return response
        except Exception as error_exception:
            _logger.error(f"Error in remove_vc_configuration: {str(error_exception)}")
            error_response: VcConfigurationResponse = self.helper.construct_error_response(error_exception, vc_configuration_request)
            return error_response