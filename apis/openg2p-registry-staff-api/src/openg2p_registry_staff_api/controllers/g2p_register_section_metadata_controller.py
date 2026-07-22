import logging

from iam_core.user_auth.decorators import require_permissions
from openg2p_fastapi_common.controller import BaseController

from openg2p_registry_core.controller_services import G2PRegisterSectionMetadataControllerService
from openg2p_registry_core.schemas import (
    CreateRegisterSectionMetadataRequest,
    DeleteRegisterSectionMetadataRequest,
    G2PRegisterSectionData,
    GetRegisterSectionMetadataRequest,
    GetRegisterSectionMetadataUISchemaRequest,
    GetRegisterSectionsMetadataRequest,
    RegisterSectionIdData,
    RegisterSectionMetadataDataResponse,
    RegisterSectionMetadataListResponse,
    RegisterSectionMetadataUISchemaDataResponse,
    RegisterSectionUISchemaData,
    UpdateRegisterSectionMetadataRequest,
    UpdateRegisterSectionMetadataUISchemaRequest,
)

from ..config import Settings
from ..helpers import RequestResponseHelper

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class G2PRegisterSectionMetadataController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.router.tags += ["/register-section-metadata"]
        self.router.prefix = "/register-section-metadata"
        self.helper = RequestResponseHelper.get_component()
        self.service = G2PRegisterSectionMetadataControllerService.get_component()

        self.router.add_api_route("/create_section", self.create_section, responses={200: {"model": RegisterSectionMetadataDataResponse}}, methods=["POST"])
        self.router.add_api_route("/delete_section", self.delete_section, responses={200: {"model": RegisterSectionMetadataDataResponse}}, methods=["POST"])
        self.router.add_api_route("/get_all_sections_brief", self.get_all_sections_brief, responses={200: {"model": RegisterSectionMetadataListResponse}}, methods=["POST"])
        self.router.add_api_route("/get_all_sections", self.get_all_sections, responses={200: {"model": RegisterSectionMetadataListResponse}}, methods=["POST"])
        self.router.add_api_route("/get_section", self.get_section, responses={200: {"model": RegisterSectionMetadataDataResponse}}, methods=["POST"])
        self.router.add_api_route("/update_section", self.update_section, responses={200: {"model": RegisterSectionMetadataDataResponse}}, methods=["POST"])
        self.router.add_api_route("/update_section_ui_schema", self.update_section_ui_schema, responses={200: {"model": RegisterSectionMetadataDataResponse}}, methods=["POST"])
        self.router.add_api_route("/get_section_ui_schema", self.get_section_ui_schema, responses={200: {"model": RegisterSectionMetadataUISchemaDataResponse}}, methods=["POST"])

    @require_permissions({"registerSection:create"})
    async def create_section(self, request: CreateRegisterSectionMetadataRequest):
        try:
            data: RegisterSectionIdData = await self.service.create_section(request)
            return self.helper.construct_register_section_metadata_success_response(data, request)
        except Exception as error_exception:
            _logger.error(f"Error in create_section: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"registerSection:delete"})
    async def delete_section(self, request: DeleteRegisterSectionMetadataRequest):
        try:
            data = await self.service.delete_section(request)
            return self.helper.construct_register_section_metadata_success_response(data, request)
        except Exception as error_exception:
            _logger.error(f"Error in delete_section: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"registerSection:view"})
    async def get_all_sections_brief(self, request: GetRegisterSectionsMetadataRequest):
        try:
            data = await self.service.get_all_sections_brief(request)
            return self.helper.construct_register_section_metadata_list_success_response(data, request)
        except Exception as error_exception:
            _logger.error(f"Error in get_all_sections_brief: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"registerSection:view"})
    async def get_all_sections(self, request: GetRegisterSectionsMetadataRequest):
        try:
            data, total_items, number_of_pages = await self.service.get_all_sections(request)
            return self.helper.construct_register_section_metadata_list_success_response(
                data, request, number_of_items=total_items, number_of_pages=number_of_pages
            )
        except Exception as error_exception:
            _logger.error(f"Error in get_all_sections: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"registerSection:view"})
    async def get_section(self, request: GetRegisterSectionMetadataRequest):
        try:
            data: G2PRegisterSectionData = await self.service.get_section(request)
            return self.helper.construct_register_section_metadata_success_response(data, request)
        except Exception as error_exception:
            _logger.error(f"Error in get_section: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"registerSection:edit"})
    async def update_section(self, request: UpdateRegisterSectionMetadataRequest):
        try:
            data: RegisterSectionIdData = await self.service.update_section(request)
            return self.helper.construct_register_section_metadata_success_response(data, request)
        except Exception as error_exception:
            _logger.error(f"Error in update_section: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"registerSection:edit"})
    async def update_section_ui_schema(self, request: UpdateRegisterSectionMetadataUISchemaRequest):
        try:
            data: RegisterSectionIdData = await self.service.update_section_ui_schema(request)
            return self.helper.construct_register_section_metadata_success_response(data, request)
        except Exception as error_exception:
            _logger.error(f"Error in update_section_ui_schema: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"registerSection:view"})
    async def get_section_ui_schema(self, request: GetRegisterSectionMetadataUISchemaRequest):
        try:
            data: RegisterSectionUISchemaData = await self.service.get_section_ui_schema(request)
            return self.helper.construct_register_section_metadata_ui_schema_success_response(data, request)
        except Exception as error_exception:
            _logger.error(f"Error in get_section_ui_schema: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, request)
