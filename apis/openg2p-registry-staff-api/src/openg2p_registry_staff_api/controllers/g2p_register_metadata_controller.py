import logging
from openg2p_fastapi_common.controller import BaseController

from openg2p_registry_core.controller_services import G2PRegisterMetadataControllerService
from openg2p_registry_core.schemas import (
    AllRegistersResponse, RegisterData,
    DashboardRegistersResponse, GetDashboardRegistersRequest,
    ChildRegistersResponse, ChildRegisterData,
    GetChildRegistersRequest, GetMasterRegisterRequest,
    GetAllRegistersRequest,
    GetRegisterSchemaRequest, GetRegisterFieldsRequest,
    CreateRegisterRequest, EditRegisterRequest, DeleteRegisterRequest, UpdateRegisterSchemaRequest,
    UpdateDedupIsEnabledRequest, UpdateDedupThresholdScoreRequest,
    UpdateDeduplicationSchemaRequest, UpdateSearchResultSchemaRequest,
    RegisterSchemaDataResponse, RegisterSchemaData,
    RegisterFieldsDataResponse,
    RegisterDataResponse,
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

        # Legacy /register-metadata tab and section CRUD routes removed.
        # Use /register-tab-metadata/* and /register-section-metadata/* instead.
        # get_register_sections remains available via bene-api
        # (/beneficiary_portal/get_register_sections).

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
