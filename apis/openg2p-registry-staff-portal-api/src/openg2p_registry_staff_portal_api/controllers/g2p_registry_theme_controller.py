import logging

from iam_core.user_auth.decorators import require_permissions
from openg2p_fastapi_common.controller import BaseController
from openg2p_registry_core.controller_services import G2PRegistryThemeControllerService
from openg2p_registry_core.schemas import (
    CreateThemeRequest,
    GetAllThemesRequest,
    GetThemeValuesRequest,
    RegistryThemeData,
    RegistryThemeValueData,
    RegistryThemesResponse,
    RegistryThemeValuesResponse,
    RemoveThemeRequest,
    ThemeOperationData,
    ThemeOperationResponse,
    UpdateThemeValuesRequest,
)

from ..config import Settings
from ..helpers import RequestResponseHelper

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class G2PRegistryThemeController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.router.tags += ["/registry-theme"]
        self.router.prefix = "/registry-theme"
        self.helper = RequestResponseHelper.get_component()
        self.g2p_registry_theme_controller_service = G2PRegistryThemeControllerService.get_component()

        self.router.add_api_route(
            "/get_all_themes",
            self.get_all_themes,
            responses={200: {"model": RegistryThemesResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/create_theme",
            self.create_theme,
            responses={200: {"model": ThemeOperationResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/remove_theme",
            self.remove_theme,
            responses={200: {"model": ThemeOperationResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/update_theme_values",
            self.update_theme_values,
            responses={200: {"model": ThemeOperationResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/get_theme_values",
            self.get_theme_values,
            responses={200: {"model": RegistryThemeValuesResponse}},
            methods=["POST"],
        )

    @require_permissions({})
    async def get_all_themes(self, get_request: GetAllThemesRequest) -> RegistryThemesResponse:
        try:
            registry_theme_data_list: list[RegistryThemeData] = await self.g2p_registry_theme_controller_service.get_all_themes(get_request)
            return self.helper.construct_registry_themes_success_response(registry_theme_data_list, get_request)
        except Exception as error_exception:
            _logger.error(f"Error in get_all_themes: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, get_request)

    @require_permissions({"registryConfiguration:edit"})
    async def create_theme(self, create_request: CreateThemeRequest) -> ThemeOperationResponse:
        try:
            theme_operation_data: ThemeOperationData = await self.g2p_registry_theme_controller_service.create_theme(create_request)
            return self.helper.construct_theme_operation_success_response(theme_operation_data, create_request)
        except Exception as error_exception:
            _logger.error(f"Error in create_theme: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, create_request)

    @require_permissions({"registryConfiguration:edit"})
    async def remove_theme(self, remove_request: RemoveThemeRequest) -> ThemeOperationResponse:
        try:
            theme_operation_data: ThemeOperationData = await self.g2p_registry_theme_controller_service.remove_theme(remove_request)
            return self.helper.construct_theme_operation_success_response(theme_operation_data, remove_request)
        except Exception as error_exception:
            _logger.error(f"Error in remove_theme: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, remove_request)

    @require_permissions({"registryConfiguration:edit"})
    async def update_theme_values(self, update_request: UpdateThemeValuesRequest) -> ThemeOperationResponse:
        try:
            theme_operation_data: ThemeOperationData = await self.g2p_registry_theme_controller_service.update_theme_values(update_request)
            return self.helper.construct_theme_operation_success_response(theme_operation_data, update_request)
        except Exception as error_exception:
            _logger.error(f"Error in update_theme_values: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, update_request)

    @require_permissions({})
    async def get_theme_values(self, get_request: GetThemeValuesRequest) -> RegistryThemeValuesResponse:
        try:
            registry_theme_value_data_list: list[RegistryThemeValueData] = await self.g2p_registry_theme_controller_service.get_theme_values(get_request)
            return self.helper.construct_registry_theme_values_success_response(registry_theme_value_data_list, get_request)
        except Exception as error_exception:
            _logger.error(f"Error in get_theme_values: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, get_request)
