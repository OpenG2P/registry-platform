import logging
from openg2p_fastapi_common.controller import BaseController

from openg2p_registry_core.controller_services import G2PRegisterMetadataControllerService
from openg2p_registry_core.schemas import (
    AllRegistersResponse, RegisterData,
    DashboardRegistersResponse, GetDashboardRegistersRequest,
    ChildRegistersResponse, ChildRegisterData,
    GetChildRegistersRequest, GetMasterRegisterRequest,
    GetAllRegistersRequest,
    GetRegisterSchemaRequest, GetRegisterFieldsRequest, GetRegisterSectionsRequest, GetRegisterTabSectionsRequest, GetRegisterTabsRequest,
    AddRegisterTabRequest, DeleteRegisterTabRequest, EditRegisterTabRequest,
    AddRegisterSectionRequest, DeleteRegisterSectionRequest, GetRegisterSectionUISchemaRequest,
    UpdateRegisterSectionRequest, UpdateRegisterSectionUISchemaRequest,
    CreateRegisterRequest, EditRegisterRequest, DeleteRegisterRequest, UpdateRegisterSchemaRequest,
    UpdateDedupIsEnabledRequest, UpdateDedupThresholdScoreRequest,
    UpdateDeduplicationSchemaRequest, UpdateSearchResultSchemaRequest,
    RegisterSchemaDataResponse, RegisterSchemaData,
    RegisterFieldsDataResponse,
    RegisterSectionsDataResponse, RegisterSectionData, RegisterSectionDataResponse,
    RegisterSectionUISchemaData, RegisterSectionUISchemaDataResponse,
    RegisterDataResponse, RegisterUITabData, RegisterTabsDataResponse,
    RegisterTabDataResponse
)
from iam_core.user_auth.decorators import require_permissions

from ..helpers import RequestResponseHelper
from ..config import Settings

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class G2PRegisterMetadataController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.router.tags += ["/register-metadata"]
        self.g2p_register_metadata_controller_service = G2PRegisterMetadataControllerService.get_component()
        self.helper = RequestResponseHelper.get_component()
        self.router.prefix = "/register-metadata"

        # Register endpoints
        # TODO: Add comments and separate cruds 
        self.router.add_api_route(
            "/create_register",
            self.create_register,
            responses={200: {"model": RegisterDataResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/edit_register",
            self.edit_register,
            responses={200: {"model": RegisterDataResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/delete_register",
            self.delete_register,
            responses={200: {"model": RegisterDataResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_all_registers",
            self.get_all_registers,
            responses={200: {"model": AllRegistersResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_dashboard_registers",
            self.get_dashboard_registers,
            responses={200: {"model": DashboardRegistersResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_child_registers",
            self.get_child_registers,
            responses={200: {"model": ChildRegistersResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_master_register",
            self.get_master_register,
            responses={200: {"model": RegisterDataResponse}},
            methods=["POST"],
        )

        # Register field endpoints
        self.router.add_api_route(
            "/get_register_fields",
            self.get_register_fields,
            responses={200: {"model": RegisterFieldsDataResponse}},
            methods=["POST"],
        )

        # Register schema endpoints
        self.router.add_api_route(
            "/get_register_schema",
            self.get_register_schema,
            responses={200: {"model": RegisterSchemaDataResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/update_register_schema",
            self.update_register_schema,
            responses={200: {"model": RegisterSchemaDataResponse}},
            methods=["POST"],
        )

        # Deduplication configuration endpoints (split from update_register_schema)
        self.router.add_api_route(
            "/update_dedup_is_enabled",
            self.update_dedup_is_enabled,
            responses={200: {"model": RegisterSchemaDataResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/update_dedup_threshold_score",
            self.update_dedup_threshold_score,
            responses={200: {"model": RegisterSchemaDataResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/update_deduplication_schema",
            self.update_deduplication_schema,
            responses={200: {"model": RegisterSchemaDataResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/update_search_result_schema",
            self.update_search_result_schema,
            responses={200: {"model": RegisterSchemaDataResponse}},
            methods=["POST"],
        )

        # Register section endpoints
        self.router.add_api_route(
            "/get_register_sections",
            self.get_register_sections,
            responses={200: {"model": RegisterSectionsDataResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_register_tab_sections",
            self.get_register_tab_sections,
            responses={200: {"model": RegisterSectionsDataResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/add_register_section",
            self.add_register_section,
            responses={200: {"model": RegisterSectionDataResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/delete_register_section",
            self.delete_register_section,
            responses={200: {"model": RegisterSectionDataResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/update_register_section",
            self.update_register_section,
            responses={200: {"model": RegisterSectionDataResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/update_register_section_ui_schema",
            self.update_register_section_ui_schema,
            responses={200: {"model": RegisterSectionDataResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_register_section_ui_schema",
            self.get_register_section_ui_schema,
            responses={200: {"model": RegisterSectionUISchemaDataResponse}},
            methods=["POST"],
        )

        # Register tab endpoints
        self.router.add_api_route(
            "/get_register_tabs",
            self.get_register_tabs,
            responses={200: {"model": RegisterTabsDataResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/add_register_tab",
            self.add_register_tab,
            responses={200: {"model": RegisterTabDataResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/delete_register_tab",
            self.delete_register_tab,
            responses={200: {"model": RegisterTabDataResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/edit_register_tab",
            self.edit_register_tab,
            responses={200: {"model": RegisterTabDataResponse}},
            methods=["POST"],
        )

    @require_permissions({"registerDefinition:view"})
    async def get_all_registers(self, get_all_registers_request: GetAllRegistersRequest) -> AllRegistersResponse:
        try:
            all_registers_list, total_items, number_of_pages = await self.g2p_register_metadata_controller_service.get_all_registers(get_all_registers_request)
            all_registers_response: AllRegistersResponse = self.helper.construct_all_registers_success_response(
                all_registers_list=all_registers_list,
                g2p_request=get_all_registers_request,
                number_of_items=total_items,
                number_of_pages=number_of_pages
            )
            return all_registers_response
        except Exception as error_exception:
            _logger.error(f"Error in get_all_registers: {str(error_exception)}")
            error_response: AllRegistersResponse = self.helper.construct_error_response(error_exception, get_all_registers_request)
            return error_response

    @require_permissions({})
    async def get_dashboard_registers(self, get_dashboard_registers_request: GetDashboardRegistersRequest) -> DashboardRegistersResponse:
        """Get all registers for dashboard display (clone of get_all_registers)"""
        try:
            dashboard_registers_list: list[RegisterData] = await self.g2p_register_metadata_controller_service.get_dashboard_registers(get_dashboard_registers_request)
            dashboard_registers_response: DashboardRegistersResponse = self.helper.construct_dashboard_registers_success_response(
                dashboard_registers_list=dashboard_registers_list, g2p_request=get_dashboard_registers_request
            )
            return dashboard_registers_response
        except Exception as error_exception:
            _logger.error(f"Error in get_dashboard_registers: {str(error_exception)}")
            error_response: DashboardRegistersResponse = self.helper.construct_error_response(error_exception, get_dashboard_registers_request)
            return error_response

    @require_permissions({"registerDefinition:view"})
    async def get_child_registers(self, get_child_registers_request: GetChildRegistersRequest) -> ChildRegistersResponse:
        try:
            child_registers_list: list[ChildRegisterData] = await self.g2p_register_metadata_controller_service.get_child_registers(get_child_registers_request)
            child_registers_response: ChildRegistersResponse = self.helper.construct_child_registers_success_response(
                child_registers_list=child_registers_list, g2p_request=get_child_registers_request
            )
            return child_registers_response
        except Exception as error_exception:
            _logger.error(f"Error in get_child_registers: {str(error_exception)}")
            error_response: ChildRegistersResponse = self.helper.construct_error_response(error_exception, get_child_registers_request)
            return error_response

    @require_permissions({"registerDefinition:view"})
    async def get_master_register(self, get_master_register_request: GetMasterRegisterRequest) -> RegisterDataResponse:
        try:
            master_register_data: RegisterData | None = await self.g2p_register_metadata_controller_service.get_master_register(get_master_register_request)
            master_register_response: RegisterDataResponse = self.helper.construct_register_data_success_response(
                register_data=master_register_data, g2p_request=get_master_register_request
            )
            return master_register_response
        except Exception as error_exception:
            _logger.error(f"Error in get_master_register: {str(error_exception)}")
            error_response: RegisterDataResponse = self.helper.construct_error_response(error_exception, get_master_register_request)
            return error_response

    @require_permissions({"registerDefinition:view"})
    async def get_register_schema(self, get_register_schema_request: GetRegisterSchemaRequest) -> RegisterSchemaDataResponse:
        """
        Get register schema configuration for a given register_id.
        """
        try:
            register_schema_data: RegisterSchemaData = await self.g2p_register_metadata_controller_service.get_register_schema(get_register_schema_request)
            register_schema_response: RegisterSchemaDataResponse = self.helper.construct_register_schema_success_response(
                register_schema_data=register_schema_data, g2p_request=get_register_schema_request
            )
            return register_schema_response
        except Exception as error_exception:
            _logger.error(f"Error in get_register_schema: {str(error_exception)}")
            error_response: RegisterSchemaDataResponse = self.helper.construct_error_response(error_exception, get_register_schema_request)
            return error_response

    @require_permissions({"registerDefinition:view"})
    async def get_register_fields(
        self, get_register_fields_request: GetRegisterFieldsRequest
    ) -> RegisterFieldsDataResponse:
        """Return DB-mapped column names and types from the register ORM model."""
        try:
            register_fields_data, total_items, number_of_pages = await self.g2p_register_metadata_controller_service.get_register_fields(
                get_register_fields_request
            )
            return self.helper.construct_register_fields_success_response(
                register_fields_data=register_fields_data,
                g2p_request=get_register_fields_request,
                number_of_items=total_items,
                number_of_pages=number_of_pages,
            )
        except Exception as error_exception:
            _logger.error(f"Error in get_register_fields: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, get_register_fields_request)

    @require_permissions({"registerSection:view"})
    async def get_register_sections(self, get_register_sections_request: GetRegisterSectionsRequest) -> RegisterSectionsDataResponse:
        """
        Get all sections for a given register_id.
        """
        try:
            register_sections_list: list[RegisterSectionData] = await self.g2p_register_metadata_controller_service.get_register_sections(get_register_sections_request)
            register_sections_response: RegisterSectionsDataResponse = self.helper.construct_register_sections_success_response(
                register_sections_list=register_sections_list, g2p_request=get_register_sections_request
            )
            return register_sections_response
        except Exception as error_exception:
            _logger.error(f"Error in get_register_sections: {str(error_exception)}")
            error_response: RegisterSectionsDataResponse = self.helper.construct_error_response(error_exception, get_register_sections_request)
            return error_response

    @require_permissions({"registerSection:view"})
    async def get_register_tab_sections(self, get_register_tab_sections_request: GetRegisterTabSectionsRequest) -> RegisterSectionsDataResponse:
        """
        Get all sections for a given register_id and tab_id with pagination.
        """
        try:
            register_tab_sections_list, total_items, number_of_pages = await self.g2p_register_metadata_controller_service.get_register_tab_sections(get_register_tab_sections_request)
            register_tab_sections_response: RegisterSectionsDataResponse = self.helper.construct_register_sections_success_response(
                register_sections_list=register_tab_sections_list,
                g2p_request=get_register_tab_sections_request,
                number_of_items=total_items,
                number_of_pages=number_of_pages
            )
            return register_tab_sections_response
        except Exception as error_exception:
            _logger.error(f"Error in get_register_tab_sections: {str(error_exception)}")
            error_response: RegisterSectionsDataResponse = self.helper.construct_error_response(error_exception, get_register_tab_sections_request)
            return error_response

    @require_permissions({"registerSection:create"})
    async def add_register_section(self, add_register_section_request: AddRegisterSectionRequest) -> RegisterSectionDataResponse:
        """
        Add a new section for a given register_id.
        """
        try:
            section_data: RegisterSectionData = await self.g2p_register_metadata_controller_service.add_register_section(add_register_section_request)
            section_response: RegisterSectionDataResponse = self.helper.construct_register_section_success_response(
                register_section_data=section_data, g2p_request=add_register_section_request
            )
            return section_response
        except Exception as error_exception:
            _logger.error(f"Error in add_register_section: {str(error_exception)}")
            error_response: RegisterSectionDataResponse = self.helper.construct_error_response(error_exception, add_register_section_request)
            return error_response

    @require_permissions({"registerSection:delete"})
    async def delete_register_section(self, delete_register_section_request: DeleteRegisterSectionRequest) -> RegisterSectionDataResponse:
        """
        Delete a section by section_id.
        """
        try:
            section_data: RegisterSectionData = await self.g2p_register_metadata_controller_service.delete_register_section(delete_register_section_request)
            section_response: RegisterSectionDataResponse = self.helper.construct_register_section_success_response(
                register_section_data=section_data, g2p_request=delete_register_section_request
            )
            return section_response
        except Exception as error_exception:
            _logger.error(f"Error in delete_register_section: {str(error_exception)}")
            error_response: RegisterSectionDataResponse = self.helper.construct_error_response(error_exception, delete_register_section_request)
            return error_response

    @require_permissions({"registerSection:edit"})
    async def update_register_section(self, update_register_section_request: UpdateRegisterSectionRequest) -> RegisterSectionDataResponse:
        """
        Update a section's metadata (not including UI schema).
        """
        try:
            section_data: RegisterSectionData = await self.g2p_register_metadata_controller_service.update_register_section(update_register_section_request)
            section_response: RegisterSectionDataResponse = self.helper.construct_register_section_success_response(
                register_section_data=section_data, g2p_request=update_register_section_request
            )
            return section_response
        except Exception as error_exception:
            _logger.error(f"Error in update_register_section: {str(error_exception)}")
            error_response: RegisterSectionDataResponse = self.helper.construct_error_response(error_exception, update_register_section_request)
            return error_response

    @require_permissions({"registerSection:edit"})
    async def update_register_section_ui_schema(self, update_register_section_ui_schema_request: UpdateRegisterSectionUISchemaRequest) -> RegisterSectionDataResponse:
        """
        Update a section's UI schema.
        """
        try:
            section_data: RegisterSectionData = await self.g2p_register_metadata_controller_service.update_register_section_ui_schema(update_register_section_ui_schema_request)
            section_response: RegisterSectionDataResponse = self.helper.construct_register_section_success_response(
                register_section_data=section_data, g2p_request=update_register_section_ui_schema_request
            )
            return section_response
        except Exception as error_exception:
            _logger.error(f"Error in update_register_section_ui_schema: {str(error_exception)}")
            error_response: RegisterSectionDataResponse = self.helper.construct_error_response(error_exception, update_register_section_ui_schema_request)
            return error_response

    @require_permissions({"registerSection:view"})
    async def get_register_section_ui_schema(
        self, get_register_section_ui_schema_request: GetRegisterSectionUISchemaRequest
    ) -> RegisterSectionUISchemaDataResponse:
        """
        Get UI schema for a specific section.
        """
        try:
            section_ui_schema_data: RegisterSectionUISchemaData = await self.g2p_register_metadata_controller_service.get_register_section_ui_schema(
                get_register_section_ui_schema_request
            )
            response: RegisterSectionUISchemaDataResponse = self.helper.construct_register_section_ui_schema_success_response(
                register_section_ui_schema_data=section_ui_schema_data,
                g2p_request=get_register_section_ui_schema_request
            )
            return response
        except Exception as error_exception:
            _logger.error(f"Error in get_register_section_ui_schema: {str(error_exception)}")
            error_response: RegisterSectionUISchemaDataResponse = self.helper.construct_error_response(
                error_exception, get_register_section_ui_schema_request
            )
            return error_response

    @require_permissions({"registerTab:view"})
    async def get_register_tabs(self, get_register_tabs_request: GetRegisterTabsRequest) -> RegisterTabsDataResponse:
        """
        Get all UI tabs for a given register_id with pagination.
        """
        try:
            register_tabs_list, total_items, number_of_pages = await self.g2p_register_metadata_controller_service.get_register_tabs(get_register_tabs_request)
            register_tabs_response: RegisterTabsDataResponse = self.helper.construct_register_tabs_success_response(
                register_tabs_list=register_tabs_list,
                g2p_request=get_register_tabs_request,
                number_of_items=total_items,
                number_of_pages=number_of_pages
            )
            return register_tabs_response
        except Exception as error_exception:
            _logger.error(f"Error in get_register_tabs: {str(error_exception)}")
            error_response: RegisterTabsDataResponse = self.helper.construct_error_response(error_exception, get_register_tabs_request)
            return error_response

    @require_permissions({"registerTab:create"})
    async def add_register_tab(self, add_register_tab_request: AddRegisterTabRequest) -> RegisterTabDataResponse:
        """
        Add a new UI tab for a given register_id.
        """
        try:
            register_tab_data: RegisterUITabData = await self.g2p_register_metadata_controller_service.add_register_tab(add_register_tab_request)
            register_tab_response: RegisterTabDataResponse = self.helper.construct_register_tab_success_response(
                register_tab_data=register_tab_data, g2p_request=add_register_tab_request
            )
            return register_tab_response
        except Exception as error_exception:
            _logger.error(f"Error in add_register_tab: {str(error_exception)}")
            error_response: RegisterTabDataResponse = self.helper.construct_error_response(error_exception, add_register_tab_request)
            return error_response

    @require_permissions({"registerTab:delete"})
    async def delete_register_tab(self, delete_register_tab_request: DeleteRegisterTabRequest) -> RegisterTabDataResponse:
        """
        Delete a UI tab by tab_id.
        """
        try:
            register_tab_data: RegisterUITabData = await self.g2p_register_metadata_controller_service.delete_register_tab(delete_register_tab_request)
            register_tab_response: RegisterTabDataResponse = self.helper.construct_register_tab_success_response(
                register_tab_data=register_tab_data, g2p_request=delete_register_tab_request
            )
            return register_tab_response
        except Exception as error_exception:
            _logger.error(f"Error in delete_register_tab: {str(error_exception)}")
            error_response: RegisterTabDataResponse = self.helper.construct_error_response(error_exception, delete_register_tab_request)
            return error_response

    @require_permissions({"registerTab:edit"})
    async def edit_register_tab(self, edit_register_tab_request: EditRegisterTabRequest) -> RegisterTabDataResponse:
        """
        Edit an existing UI tab.
        """
        try:
            register_tab_data: RegisterUITabData = await self.g2p_register_metadata_controller_service.edit_register_tab(edit_register_tab_request)
            register_tab_response: RegisterTabDataResponse = self.helper.construct_register_tab_success_response(
                register_tab_data=register_tab_data, g2p_request=edit_register_tab_request
            )
            return register_tab_response
        except Exception as error_exception:
            _logger.error(f"Error in edit_register_tab: {str(error_exception)}")
            error_response: RegisterTabDataResponse = self.helper.construct_error_response(error_exception, edit_register_tab_request)
            return error_response

    @require_permissions({"registerDefinition:create"})
    async def create_register(self, create_register_request: CreateRegisterRequest) -> RegisterDataResponse:
        """
        Create a new register definition and null register schema record.
        """
        try:
            register_data: RegisterData = await self.g2p_register_metadata_controller_service.create_register(create_register_request)
            register_data_response: RegisterDataResponse = self.helper.construct_register_data_success_response(
                register_data=register_data, g2p_request=create_register_request
            )
            return register_data_response
        except Exception as error_exception:
            _logger.error(f"Error in create_register: {str(error_exception)}")
            error_response: RegisterDataResponse = self.helper.construct_error_response(error_exception, create_register_request)
            return error_response

    @require_permissions({"registerDefinition:edit"})
    async def edit_register(self, edit_register_request: EditRegisterRequest) -> RegisterDataResponse:
        """
        Edit an existing register definition.
        If the register has data, only mnemonic and description can be edited.
        """
        try:
            register_data: RegisterData = await self.g2p_register_metadata_controller_service.edit_register(edit_register_request)
            register_data_response: RegisterDataResponse = self.helper.construct_register_data_success_response(
                register_data=register_data, g2p_request=edit_register_request
            )
            return register_data_response
        except Exception as error_exception:
            _logger.error(f"Error in edit_register: {str(error_exception)}")
            error_response: RegisterDataResponse = self.helper.construct_error_response(error_exception, edit_register_request)
            return error_response

    @require_permissions({"registerDefinition:delete"})
    async def delete_register(self, delete_register_request: DeleteRegisterRequest) -> RegisterDataResponse:
        """
        Delete a register definition if it has no data.
        """
        try:
            register_data: RegisterData = await self.g2p_register_metadata_controller_service.delete_register(delete_register_request)
            register_data_response: RegisterDataResponse = self.helper.construct_register_data_success_response(
                register_data=register_data, g2p_request=delete_register_request
            )
            return register_data_response
        except Exception as error_exception:
            _logger.error(f"Error in delete_register: {str(error_exception)}")
            error_response: RegisterDataResponse = self.helper.construct_error_response(error_exception, delete_register_request)
            return error_response

    @require_permissions({"registerDefinition:edit"})
    async def update_register_schema(self, update_register_schema_request: UpdateRegisterSchemaRequest) -> RegisterSchemaDataResponse:
        """
        Update an existing register schema configuration for a given register_id.
        """
        try:
            register_schema_data: RegisterSchemaData = await self.g2p_register_metadata_controller_service.update_register_schema(update_register_schema_request)
            register_schema_response: RegisterSchemaDataResponse = self.helper.construct_register_schema_success_response(
                register_schema_data=register_schema_data, g2p_request=update_register_schema_request
            )
            return register_schema_response
        except Exception as error_exception:
            _logger.error(f"Error in update_register_schema: {str(error_exception)}")
            error_response: RegisterSchemaDataResponse = self.helper.construct_error_response(error_exception, update_register_schema_request)
            return error_response

    @require_permissions({"registerDefinition:edit"})
    async def update_dedup_is_enabled(self, update_dedup_is_enabled_request: UpdateDedupIsEnabledRequest) -> RegisterSchemaDataResponse:
        """
        Update the dedup_is_enabled flag for a register.
        """
        try:
            register_schema_data: RegisterSchemaData = await self.g2p_register_metadata_controller_service.update_dedup_is_enabled(update_dedup_is_enabled_request)
            register_schema_response: RegisterSchemaDataResponse = self.helper.construct_register_schema_success_response(
                register_schema_data=register_schema_data, g2p_request=update_dedup_is_enabled_request
            )
            return register_schema_response
        except Exception as error_exception:
            _logger.error(f"Error in update_dedup_is_enabled: {str(error_exception)}")
            error_response: RegisterSchemaDataResponse = self.helper.construct_error_response(error_exception, update_dedup_is_enabled_request)
            return error_response

    @require_permissions({"registerDefinition:edit"})
    async def update_dedup_threshold_score(self, update_dedup_threshold_score_request: UpdateDedupThresholdScoreRequest) -> RegisterSchemaDataResponse:
        """
        Update the dedup_threshold_score for a register.
        """
        try:
            register_schema_data: RegisterSchemaData = await self.g2p_register_metadata_controller_service.update_dedup_threshold_score(update_dedup_threshold_score_request)
            register_schema_response: RegisterSchemaDataResponse = self.helper.construct_register_schema_success_response(
                register_schema_data=register_schema_data, g2p_request=update_dedup_threshold_score_request
            )
            return register_schema_response
        except Exception as error_exception:
            _logger.error(f"Error in update_dedup_threshold_score: {str(error_exception)}")
            error_response: RegisterSchemaDataResponse = self.helper.construct_error_response(error_exception, update_dedup_threshold_score_request)
            return error_response

    @require_permissions({"registerDefinition:edit"})
    async def update_deduplication_schema(self, update_deduplication_schema_request: UpdateDeduplicationSchemaRequest) -> RegisterSchemaDataResponse:
        """
        Update the deduplicate_schema for a register.
        """
        try:
            register_schema_data: RegisterSchemaData = await self.g2p_register_metadata_controller_service.update_deduplication_schema(update_deduplication_schema_request)
            register_schema_response: RegisterSchemaDataResponse = self.helper.construct_register_schema_success_response(
                register_schema_data=register_schema_data, g2p_request=update_deduplication_schema_request
            )
            return register_schema_response
        except Exception as error_exception:
            _logger.error(f"Error in update_deduplication_schema: {str(error_exception)}")
            error_response: RegisterSchemaDataResponse = self.helper.construct_error_response(error_exception, update_deduplication_schema_request)
            return error_response

    @require_permissions({"registerDefinition:edit"})
    async def update_search_result_schema(self, update_search_result_schema_request: UpdateSearchResultSchemaRequest) -> RegisterSchemaDataResponse:
        """
        Update the search_result_schema for a register.
        """
        try:
            register_schema_data: RegisterSchemaData = await self.g2p_register_metadata_controller_service.update_search_result_schema(update_search_result_schema_request)
            register_schema_response: RegisterSchemaDataResponse = self.helper.construct_register_schema_success_response(
                register_schema_data=register_schema_data, g2p_request=update_search_result_schema_request
            )
            return register_schema_response
        except Exception as error_exception:
            _logger.error(f"Error in update_search_result_schema: {str(error_exception)}")
            error_response: RegisterSchemaDataResponse = self.helper.construct_error_response(error_exception, update_search_result_schema_request)
            return error_response
