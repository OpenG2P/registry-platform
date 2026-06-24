import logging

from iam_core.user_auth.decorators import require_permissions
from openg2p_fastapi_common.controller import BaseController

from openg2p_registry_core.controller_services import G2PRegisterTabMetadataControllerService
from openg2p_registry_core.schemas import (
    AddRegisterTabSectionRequest,
    CreateRegisterTabRequest,
    DeleteRegisterTabMetadataRequest,
    G2PRegisterUITabData,
    G2PRegisterUITabSectionData,
    GetRegisterTabMetadataListRequest,
    GetRegisterTabMetadataRequest,
    GetRegisterTabSectionsMetadataRequest,
    RegisterTabMetadataDataResponse,
    RegisterTabIdData,
    RegisterTabMetadataListResponse,
    RegisterTabSectionDataResponse,
    RegisterTabSectionIdData,
    RegisterTabSectionsDataResponse,
    RemoveRegisterTabSectionRequest,
    UpdateRegisterTabRequest,
    UpdateRegisterTabSectionRequest,
)

from ..config import Settings
from ..helpers import RequestResponseHelper

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class G2PRegisterTabMetadataController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.router.tags += ["/register-tab-metadata"]
        self.router.prefix = "/register-tab-metadata"
        self.helper = RequestResponseHelper.get_component()
        self.service = G2PRegisterTabMetadataControllerService.get_component()

        self.router.add_api_route("/create_tab", self.create_tab, responses={200: {"model": RegisterTabMetadataDataResponse}}, methods=["POST"])
        self.router.add_api_route("/delete_tab", self.delete_tab, responses={200: {"model": RegisterTabMetadataDataResponse}}, methods=["POST"])
        self.router.add_api_route("/get_all_tabs", self.get_all_tabs, responses={200: {"model": RegisterTabMetadataListResponse}}, methods=["POST"])
        self.router.add_api_route("/get_tab", self.get_tab, responses={200: {"model": RegisterTabMetadataDataResponse}}, methods=["POST"])
        self.router.add_api_route("/update_tab", self.update_tab, responses={200: {"model": RegisterTabMetadataDataResponse}}, methods=["POST"])
        self.router.add_api_route("/add_section", self.add_section, responses={200: {"model": RegisterTabSectionDataResponse}}, methods=["POST"])
        self.router.add_api_route("/get_sections", self.get_sections, responses={200: {"model": RegisterTabSectionsDataResponse}}, methods=["POST"])
        self.router.add_api_route("/update_section", self.update_section, responses={200: {"model": RegisterTabSectionDataResponse}}, methods=["POST"])
        self.router.add_api_route("/remove_section", self.remove_section, responses={200: {"model": RegisterTabSectionDataResponse}}, methods=["POST"])

    @require_permissions({"registerTab:create"})
    async def create_tab(self, request: CreateRegisterTabRequest):
        try:
            data: RegisterTabIdData = await self.service.create_tab(request)
            return self.helper.construct_register_tab_metadata_success_response(data, request)
        except Exception as error_exception:
            _logger.error(f"Error in create_tab: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"registerTab:delete"})
    async def delete_tab(self, request: DeleteRegisterTabMetadataRequest):
        try:
            data = await self.service.delete_tab(request)
            return self.helper.construct_register_tab_metadata_success_response(data, request)
        except Exception as error_exception:
            _logger.error(f"Error in delete_tab: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"registerTab:view"})
    async def get_all_tabs(self, request: GetRegisterTabMetadataListRequest):
        try:
            data, total_items, number_of_pages = await self.service.get_all_tabs(request)
            return self.helper.construct_register_tab_metadata_list_success_response(
                data, request, number_of_items=total_items, number_of_pages=number_of_pages
            )
        except Exception as error_exception:
            _logger.error(f"Error in get_all_tabs: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"registerTab:view"})
    async def get_tab(self, request: GetRegisterTabMetadataRequest):
        try:
            data: G2PRegisterUITabData = await self.service.get_tab(request)
            return self.helper.construct_register_tab_metadata_success_response(data, request)
        except Exception as error_exception:
            _logger.error(f"Error in get_tab: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"registerTab:edit"})
    async def update_tab(self, request: UpdateRegisterTabRequest):
        try:
            data: RegisterTabIdData = await self.service.update_tab(request)
            return self.helper.construct_register_tab_metadata_success_response(data, request)
        except Exception as error_exception:
            _logger.error(f"Error in update_tab: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"registerTab:edit"})
    async def add_section(self, request: AddRegisterTabSectionRequest):
        try:
            data: RegisterTabSectionIdData = await self.service.add_section(request)
            return self.helper.construct_register_tab_section_success_response(data, request)
        except Exception as error_exception:
            _logger.error(f"Error in add_section: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"registerTab:view"})
    async def get_sections(self, request: GetRegisterTabSectionsMetadataRequest):
        try:
            data = await self.service.get_sections(request)
            return self.helper.construct_register_tab_sections_success_response(data, request)
        except Exception as error_exception:
            _logger.error(f"Error in get_sections: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"registerTab:edit"})
    async def update_section(self, request: UpdateRegisterTabSectionRequest):
        try:
            data: G2PRegisterUITabSectionData = await self.service.update_section(request)
            return self.helper.construct_register_tab_section_success_response(data, request)
        except Exception as error_exception:
            _logger.error(f"Error in update_section: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"registerTab:edit"})
    async def remove_section(self, request: RemoveRegisterTabSectionRequest):
        try:
            data = await self.service.remove_section(request)
            return self.helper.construct_register_tab_section_success_response(data, request)
        except Exception as error_exception:
            _logger.error(f"Error in remove_section: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, request)
