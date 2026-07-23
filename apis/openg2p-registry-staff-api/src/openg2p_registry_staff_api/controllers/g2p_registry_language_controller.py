import logging

from iam_core.user_auth.decorators import require_permissions
from openg2p_fastapi_common.controller import BaseController
from openg2p_registry_core.controller_services import G2PRegistryLanguageControllerService
from openg2p_registry_core.schemas import (
    CreateLanguageRequest,
    GetAllLanguagesRequest,
    GetLanguageRequest,
    RegistryLanguageData,
    RegistryLanguagesResponse,
    RegistryLanguageResponse,
    RemoveLanguageRequest,
    UpdateLanguageRequest,
)

from ..config import Settings
from ..helpers import RequestResponseHelper

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class G2PRegistryLanguageController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.router.tags += ["/registry-language"]
        self.router.prefix = "/registry-language"
        self.helper = RequestResponseHelper.get_component()
        self.g2p_registry_language_controller_service = G2PRegistryLanguageControllerService.get_component()

        self.router.add_api_route(
            "/get_all_languages",
            self.get_all_languages,
            responses={200: {"model": RegistryLanguagesResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/get_language",
            self.get_language,
            responses={200: {"model": RegistryLanguageResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/create_language",
            self.create_language,
            responses={200: {"model": RegistryLanguageResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/update_language",
            self.update_language,
            responses={200: {"model": RegistryLanguageResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/remove_language",
            self.remove_language,
            responses={200: {"model": RegistryLanguageResponse}},
            methods=["POST"],
        )

    @require_permissions({})
    async def get_all_languages(self, get_request: GetAllLanguagesRequest) -> RegistryLanguagesResponse:
        try:
            registry_language_data_list: list[RegistryLanguageData] = await self.g2p_registry_language_controller_service.get_all_languages(get_request)
            return self.helper.construct_registry_languages_success_response(registry_language_data_list, get_request)
        except Exception as error_exception:
            _logger.error(f"Error in get_all_languages: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, get_request)

    @require_permissions({})
    async def get_language(self, get_request: GetLanguageRequest) -> RegistryLanguageResponse:
        try:
            language: RegistryLanguageData = await self.g2p_registry_language_controller_service.get_language(get_request)
            return self.helper.construct_registry_language_success_response(language, get_request)
        except Exception as error_exception:
            _logger.error(f"Error in get_language: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, get_request)

    @require_permissions({"registryConfiguration:edit"})
    async def create_language(self, create_request: CreateLanguageRequest) -> RegistryLanguageResponse:
        try:
            language: RegistryLanguageData = await self.g2p_registry_language_controller_service.create_language(create_request)
            return self.helper.construct_registry_language_success_response(language, create_request)
        except Exception as error_exception:
            _logger.error(f"Error in create_language: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, create_request)

    @require_permissions({"registryConfiguration:edit"})
    async def update_language(self, update_request: UpdateLanguageRequest) -> RegistryLanguageResponse:
        try:
            language: RegistryLanguageData = await self.g2p_registry_language_controller_service.update_language(update_request)
            return self.helper.construct_registry_language_success_response(language, update_request)
        except Exception as error_exception:
            _logger.error(f"Error in update_language: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, update_request)

    @require_permissions({"registryConfiguration:edit"})
    async def remove_language(self, remove_request: RemoveLanguageRequest) -> RegistryLanguageResponse:
        try:
            language: RegistryLanguageData = await self.g2p_registry_language_controller_service.remove_language(remove_request)
            return self.helper.construct_registry_language_success_response(language, remove_request)
        except Exception as error_exception:
            _logger.error(f"Error in remove_language: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, remove_request)