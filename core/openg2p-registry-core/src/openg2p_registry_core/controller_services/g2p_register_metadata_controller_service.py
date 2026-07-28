import logging
from openg2p_fastapi_common.service import BaseService

from ..services import G2PRegisterService
from ..schemas import (
    RegisterData, AllRegistersRegisterData, ChildRegisterData,
    GetAllRegistersRequest, GetDashboardRegistersRequest, GetChildRegistersRequest, GetMasterRegisterRequest,
    GetRegisterSchemaRequest, GetRegisterFieldsRequest, GetRegisterSectionsRequest,
    CreateRegisterRequest, EditRegisterRequest, DeleteRegisterRequest, UpdateRegisterSchemaRequest,
    UpdateDedupIsEnabledRequest, UpdateDedupThresholdScoreRequest,
    UpdateDeduplicationSchemaRequest, UpdateSearchResultSchemaRequest,
    RegisterSchemaData, RegisterFieldsData, RegisterSectionData
)

_logger = logging.getLogger('g2p-register-metadata-controller-service')


class G2PRegisterMetadataControllerService(BaseService):

    async def get_all_registers(self, get_all_registers_request: GetAllRegistersRequest) -> tuple[list[AllRegistersRegisterData], int, int]:
        """Get all registers with pagination, returns (registers_list, total_items, number_of_pages)"""
        _logger.info("Fetching all registers through controller service")
        g2p_register_service = G2PRegisterService.get_component()

        # Extract pagination parameters from request
        pagination = get_all_registers_request.request_body.pagination_request
        current_page = pagination.current_page if pagination else 1
        page_size = pagination.page_size if pagination else 10
        sort_by = pagination.sort_by if pagination else None
        filter_by = pagination.filter_by if pagination else None

        all_registers_list, total_items = await g2p_register_service.get_all_registers(
            current_page=current_page,
            page_size=page_size,
            sort_by=sort_by,
            filter_by=filter_by
        )

        # Calculate number of pages
        number_of_pages = (total_items + page_size - 1) // page_size if total_items > 0 else 0

        return all_registers_list, total_items, number_of_pages

    async def get_dashboard_registers(self, get_dashboard_registers_request: GetDashboardRegistersRequest) -> list[RegisterData]:
        """Get all registers for dashboard display (clone of get_all_registers)"""
        _logger.info("Fetching dashboard registers through controller service")
        g2p_register_service = G2PRegisterService.get_component()
        dashboard_registers_list: list[RegisterData] = await g2p_register_service.get_dashboard_registers()
        return dashboard_registers_list

    async def get_child_registers(self, get_child_registers_request: GetChildRegistersRequest) -> list[ChildRegisterData]:
        _logger.info(f"Fetching child registers for register_id: {get_child_registers_request.request_body.request_payload.register_id} through controller service")
        g2p_register_service = G2PRegisterService.get_component()
        register_id = get_child_registers_request.request_body.request_payload.register_id
        child_registers_list: list[ChildRegisterData] = await g2p_register_service.get_child_registers(register_id)
        return child_registers_list

    async def get_master_register(self, get_master_register_request: GetMasterRegisterRequest) -> RegisterData | None:
        _logger.info(f"Fetching master register for register_id: {get_master_register_request.request_body.request_payload.register_id} through controller service")
        g2p_register_service = G2PRegisterService.get_component()
        register_id = get_master_register_request.request_body.request_payload.register_id
        master_register_data: RegisterData | None = await g2p_register_service.get_master_register(register_id)
        return master_register_data

    async def get_register_schema(self, get_register_schema_request: GetRegisterSchemaRequest) -> RegisterSchemaData:
        """
        Get register schema configuration for a given register_id.
        """
        payload = get_register_schema_request.request_body.request_payload
        register_id = payload.register_id
        _logger.info(f"Getting register schema for register_id: {register_id} through controller service")
        g2p_register_service = G2PRegisterService.get_component()
        register_schema_data: RegisterSchemaData = await g2p_register_service.get_register_schema(register_id)
        return register_schema_data

    async def get_register_fields(
        self, get_register_fields_request: GetRegisterFieldsRequest
    ) -> tuple[RegisterFieldsData, int, int]:
        """Field names and types from the SQLAlchemy ORM model for the given register_id."""
        body = get_register_fields_request.request_body
        payload = body.request_payload
        register_id = payload.register_id
        
        # Extract pagination parameters from request
        pagination = get_register_fields_request.request_body.pagination_request
        current_page = pagination.current_page if pagination else 1
        page_size = pagination.page_size if pagination else 10
        sort_by = pagination.sort_by if pagination else None
        filter_by = pagination.filter_by if pagination else None

        g2p_register_service = G2PRegisterService.get_component()
        return await g2p_register_service.get_register_fields(
            register_id, 
            current_page=current_page, 
            page_size=page_size, 
            sort_by=sort_by,
            filter_by=filter_by
        )

    async def get_register_sections(self, get_register_sections_request: GetRegisterSectionsRequest) -> list[RegisterSectionData]:
        """
        Get register sections for a given register_id.
        Kept for bene-api (/beneficiary_portal/get_register_sections).
        Staff-api legacy /register-metadata/get_register_sections route was removed;
        staff UI should use /register-section-metadata/get_all_sections.
        """
        payload = get_register_sections_request.request_body.request_payload
        register_id = payload.register_id
        _logger.info(f"Getting register sections for register_id: {register_id} through controller service")
        g2p_register_service = G2PRegisterService.get_component()
        register_sections_list: list[RegisterSectionData] = await g2p_register_service.get_register_sections(register_id)
        return register_sections_list

    async def create_register(self, create_register_request: CreateRegisterRequest) -> RegisterData:
        """
        Create a new register definition and null schema record.
        """
        payload = create_register_request.request_body.request_payload
        _logger.info(f"Creating register with mnemonic: {payload.register_mnemonic} through controller service")
        g2p_register_service = G2PRegisterService.get_component()
        register_data: RegisterData = await g2p_register_service.create_register(
            register_mnemonic=payload.register_mnemonic,
            register_description=payload.register_description,
            master_register_id=payload.master_register_id,
            dedup_is_enabled=payload.dedup_is_enabled,
            dedup_threshold_score=payload.dedup_threshold_score,
            register_icon=payload.register_icon,
            register_rank=payload.register_rank,
            register_purpose=payload.register_purpose,
            functional_id_generation_required=payload.functional_id_generation_required,
            completion_score_required=payload.completion_score_required,
            outgest_applicable=payload.outgest_applicable,
            requires_registrant_authentication=payload.requires_registrant_authentication,
            registrant_authentication_validity_days=payload.registrant_authentication_validity_days,
            registrant_re_auth_warning_days_before=payload.registrant_re_auth_warning_days_before,
        )
        return register_data

    async def edit_register(self, edit_register_request: EditRegisterRequest) -> RegisterData:
        """
        Edit an existing register definition.
        If the register has data, only mnemonic and description can be edited.
        """
        payload = edit_register_request.request_body.request_payload
        _logger.info(f"Editing register with register_id: {payload.register_id} through controller service")
        g2p_register_service = G2PRegisterService.get_component()
        register_data: RegisterData = await g2p_register_service.edit_register(
            register_id=payload.register_id,
            register_mnemonic=payload.register_mnemonic,
            register_description=payload.register_description,
            master_register_id=payload.master_register_id,
            dedup_is_enabled=payload.dedup_is_enabled,
            dedup_threshold_score=payload.dedup_threshold_score,
            register_icon=payload.register_icon,
            register_rank=payload.register_rank,
            register_purpose=payload.register_purpose,
            functional_id_generation_required=payload.functional_id_generation_required,
            completion_score_required=payload.completion_score_required,
            outgest_applicable=payload.outgest_applicable,
            requires_registrant_authentication=payload.requires_registrant_authentication,
            registrant_authentication_validity_days=payload.registrant_authentication_validity_days,
            registrant_re_auth_warning_days_before=payload.registrant_re_auth_warning_days_before,
        )
        return register_data

    async def delete_register(self, delete_register_request: DeleteRegisterRequest) -> RegisterData:
        """
        Delete a register definition if it has no data.
        """
        payload = delete_register_request.request_body.request_payload
        _logger.info(f"Deleting register with register_id: {payload.register_id} through controller service")
        g2p_register_service = G2PRegisterService.get_component()
        register_data: RegisterData = await g2p_register_service.delete_register(
            register_id=payload.register_id
        )
        return register_data

    async def update_register_schema(self, update_register_schema_request: UpdateRegisterSchemaRequest) -> RegisterSchemaData:
        """
        Update an existing register schema configuration for a given register_id.
        """
        payload = update_register_schema_request.request_body.request_payload
        register_id = payload.register_id
        _logger.info(f"Updating register schema for register_id: {register_id} through controller service")
        g2p_register_service = G2PRegisterService.get_component()
        register_schema_data: RegisterSchemaData = await g2p_register_service.update_register_schema(
            register_id=register_id,
            deduplicate_schema=payload.deduplicate_schema,
            search_result_schema=payload.search_result_schema,
            filter_schema=payload.filter_schema
        )
        return register_schema_data

    async def update_dedup_is_enabled(self, update_dedup_is_enabled_request: UpdateDedupIsEnabledRequest) -> RegisterSchemaData:
        """
        Update the dedup_is_enabled flag for a register.
        """
        payload = update_dedup_is_enabled_request.request_body.request_payload
        register_id = payload.register_id
        _logger.info(f"Updating dedup_is_enabled for register_id: {register_id} through controller service")
        g2p_register_service = G2PRegisterService.get_component()
        register_schema_data: RegisterSchemaData = await g2p_register_service.update_dedup_is_enabled(
            register_id=register_id,
            dedup_is_enabled=payload.dedup_is_enabled
        )
        return register_schema_data

    async def update_dedup_threshold_score(self, update_dedup_threshold_score_request: UpdateDedupThresholdScoreRequest) -> RegisterSchemaData:
        """
        Update the dedup_threshold_score for a register.
        """
        payload = update_dedup_threshold_score_request.request_body.request_payload
        register_id = payload.register_id
        _logger.info(f"Updating dedup_threshold_score for register_id: {register_id} through controller service")
        g2p_register_service = G2PRegisterService.get_component()
        register_schema_data: RegisterSchemaData = await g2p_register_service.update_dedup_threshold_score(
            register_id=register_id,
            dedup_threshold_score=payload.dedup_threshold_score
        )
        return register_schema_data

    async def update_deduplication_schema(self, update_deduplication_schema_request: UpdateDeduplicationSchemaRequest) -> RegisterSchemaData:
        """
        Update the deduplicate_schema for a register.
        """
        payload = update_deduplication_schema_request.request_body.request_payload
        register_id = payload.register_id
        _logger.info(f"Updating deduplicate_schema for register_id: {register_id} through controller service")
        g2p_register_service = G2PRegisterService.get_component()
        register_schema_data: RegisterSchemaData = await g2p_register_service.update_deduplication_schema(
            register_id=register_id,
            deduplicate_schema=payload.deduplicate_schema
        )
        return register_schema_data

    async def update_search_result_schema(self, update_search_result_schema_request: UpdateSearchResultSchemaRequest) -> RegisterSchemaData:
        """
        Update the search_result_schema for a register.
        """
        payload = update_search_result_schema_request.request_body.request_payload
        register_id = payload.register_id
        _logger.info(f"Updating search_result_schema for register_id: {register_id} through controller service")
        g2p_register_service = G2PRegisterService.get_component()
        register_schema_data: RegisterSchemaData = await g2p_register_service.update_search_result_schema(
            register_id=register_id,
            search_result_schema=payload.search_result_schema
        )
        return register_schema_data
