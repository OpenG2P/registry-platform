import logging
from openg2p_fastapi_common.controller import BaseController

from openg2p_registry_core.controller_services import G2PRegistryConfigurationControllerService
from openg2p_registry_core.schemas import (
    CreateRegistryConfigurationRequest,
    GetRegistryConfigurationRequest,
    UpdateRegistryConfigurationRequest,
    GetNumberOfRequestsPendingRequest,
    GetEarliestPendingChangeRequestRequest,
    RegistryConfigurationData,
    RegistryConfigurationDataResponse,
    NumberOfRequestsPendingData,
    NumberOfRequestsPendingResponse,
    EarliestPendingChangeRequestData,
    EarliestPendingChangeRequestResponse
)
from iam_core.user_auth.decorators import require_permissions

from ..helpers import RequestResponseHelper
from ..config import Settings

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class G2PRegistryConfigurationController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.router.tags += ["/registry-config"]
        self.g2p_registry_config_controller_service = G2PRegistryConfigurationControllerService.get_component()
        self.helper = RequestResponseHelper.get_component()
        self.router.prefix = "/registry-config"

        # Registry Configuration Endpoints
        self.router.add_api_route(
            "/create_registry_configuration",
            self.create_registry_configuration,
            responses={200: {"model": RegistryConfigurationDataResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_registry_configuration",
            self.get_registry_configuration,
            responses={200: {"model": RegistryConfigurationDataResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/update_registry_configuration",
            self.update_registry_configuration,
            responses={200: {"model": RegistryConfigurationDataResponse}},
            methods=["POST"],
        )

        # Change Request Endpoints
        self.router.add_api_route(
            "/get_number_of_requests_pending",
            self.get_number_of_requests_pending,
            responses={200: {"model": NumberOfRequestsPendingResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_earliest_pending_change_request",
            self.get_earliest_pending_change_request,
            responses={200: {"model": EarliestPendingChangeRequestResponse}},
            methods=["POST"],
        )

    @require_permissions({"registryConfiguration:edit"})
    async def create_registry_configuration(
        self, 
        create_request: CreateRegistryConfigurationRequest
    ) -> RegistryConfigurationDataResponse:
        try:
            registry_configuration_data: RegistryConfigurationData = await self.g2p_registry_config_controller_service.create_registry_configuration(create_request)
            response: RegistryConfigurationDataResponse = self.helper.construct_registry_configuration_data_success_response(
                registry_configuration_data=registry_configuration_data, 
                g2p_request=create_request
            )
            return response
        except Exception as error_exception:
            _logger.error(f"Error in create_registry_configuration: {str(error_exception)}")
            error_response: RegistryConfigurationDataResponse = self.helper.construct_error_response(error_exception, create_request)
            return error_response

    @require_permissions({})
    async def get_registry_configuration(
        self, 
        get_request: GetRegistryConfigurationRequest
    ) -> RegistryConfigurationDataResponse:
        try:
            registry_configuration_data: RegistryConfigurationData = await self.g2p_registry_config_controller_service.get_registry_configuration(get_request)
            response: RegistryConfigurationDataResponse = self.helper.construct_registry_configuration_data_success_response(
                registry_configuration_data=registry_configuration_data, 
                g2p_request=get_request
            )
            return response
        except Exception as error_exception:
            _logger.error(f"Error in get_registry_configuration: {str(error_exception)}")
            error_response: RegistryConfigurationDataResponse = self.helper.construct_error_response(error_exception, get_request)
            return error_response

    @require_permissions({"registryConfiguration:edit"})
    async def update_registry_configuration(
        self, 
        update_request: UpdateRegistryConfigurationRequest
    ) -> RegistryConfigurationDataResponse:
        try:
            registry_configuration_data: RegistryConfigurationData = await self.g2p_registry_config_controller_service.update_registry_configuration(update_request)
            response: RegistryConfigurationDataResponse = self.helper.construct_registry_configuration_data_success_response(
                registry_configuration_data=registry_configuration_data, 
                g2p_request=update_request
            )
            return response
        except Exception as error_exception:
            _logger.error(f"Error in update_registry_configuration: {str(error_exception)}")
            error_response: RegistryConfigurationDataResponse = self.helper.construct_error_response(error_exception, update_request)
            return error_response

    @require_permissions({"registryConfiguration:view", "changeRequest:view"})
    async def get_number_of_requests_pending(
        self, 
        get_request: GetNumberOfRequestsPendingRequest
    ) -> NumberOfRequestsPendingResponse:
        try:
            number_of_requests_pending_data: NumberOfRequestsPendingData = await self.g2p_registry_config_controller_service.get_number_of_requests_pending(get_request)
            response: NumberOfRequestsPendingResponse = self.helper.construct_number_of_requests_pending_success_response(
                number_of_requests_pending_data=number_of_requests_pending_data, 
                g2p_request=get_request
            )
            return response
        except Exception as error_exception:
            _logger.error(f"Error in get_number_of_requests_pending: {str(error_exception)}")
            error_response: NumberOfRequestsPendingResponse = self.helper.construct_error_response(error_exception, get_request)
            return error_response

    @require_permissions({"registryConfiguration:view", "changeRequest:view"})
    async def get_earliest_pending_change_request(
        self, 
        get_request: GetEarliestPendingChangeRequestRequest
    ) -> EarliestPendingChangeRequestResponse:
        try:
            earliest_change_request_data: EarliestPendingChangeRequestData = await self.g2p_registry_config_controller_service.get_earliest_pending_change_request(get_request)
            response: EarliestPendingChangeRequestResponse = self.helper.construct_earliest_pending_change_request_success_response(
                earliest_pending_change_request_data=earliest_change_request_data, 
                g2p_request=get_request
            )
            return response
        except Exception as error_exception:
            _logger.error(f"Error in get_earliest_pending_change_request: {str(error_exception)}")
            error_response: EarliestPendingChangeRequestResponse = self.helper.construct_error_response(error_exception, get_request)
            return error_response
