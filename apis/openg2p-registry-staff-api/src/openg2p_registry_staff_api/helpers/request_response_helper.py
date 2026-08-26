from datetime import datetime
from typing import List, Optional
from openg2p_fastapi_common.service import BaseService
from openg2p_fastapi_common.schemas import G2PRequest, G2PResponse, G2PResponseHeader, G2PResponseStatus, G2PResponseBody, G2PPaginationResponse
from openg2p_registry_core.schemas import (
    ChangeRequestResponsePayload, ChangeRequestResponse, ChangeRequestResponseBody,
    SubmissionResponsePayload, SubmissionResponse, SubmissionResponseBody,
    SubmissionSearchResultsResponse, SubmissionSearchResultsResponseBody,
    IntakeFormsForRegisterResponse, IntakeFormsForRegisterResponseBody,
    IntakeFormMetadataResponse, IntakeFormMetadataResponseBody,
    IntakeFormSubmissionsSummaryData, IntakeFormSubmissionsSummaryResponse, IntakeFormSubmissionsSummaryResponseBody,
    RegisterSummaryData, RegisterSummaryDataResponse, RegisterSummaryDataResponseBody,
    ChangeRequestSummaryData, ChangeRequestSummaryDataResponse, ChangeRequestSummaryDataResponseBody,
    RegisterData, AllRegistersRegisterData, AllRegistersResponse, AllRegistersResponseBody,
    DashboardRegistersResponse, DashboardRegistersResponseBody,
    RegisterDataResponse, RegisterDataResponseBody,
    ChildRegisterData, ChildRegistersResponse, ChildRegistersResponseBody,
    SearchResultData, SearchResultsResponse, SearchResultsResponseBody,
    ChangeRequestSearchResultData, ChangeRequestSearchResultsResponse, ChangeRequestSearchResultsResponseBody,
    NumberOfVersionsData, NumberOfVersionsResponse, NumberOfVersionsResponseBody,
    RecordHistoryListData, RecordHistoryDataResponse, RecordHistoryDataResponseBody,
    VersionDatesData, VersionDatesDataResponse, VersionDatesDataResponseBody,
    VersionsForDateData, ChangesForDateDataResponse, ChangesForDateDataResponseBody,
    NumberOfPendingChangeRequestsData, NumberOfPendingChangeRequestsResponse, NumberOfPendingChangeRequestsResponseBody,
    NumberOfPendingChangeRequestsForSubmissionData, NumberOfPendingChangeRequestsForSubmissionResponse, NumberOfPendingChangeRequestsForSubmissionResponseBody,
    NumberOfCrossRegisterChangesData, NumberOfCrossRegisterChangesResponse, NumberOfCrossRegisterChangesResponseBody,
    CrossRegisterChangeRequestData, CrossRegisterChangesData, CrossRegisterChangesDataResponse, CrossRegisterChangesDataResponseBody,
    ChangeRequestData, ChangeRequestDataResponse, ChangeRequestDataResponseBody,
    ChangeRequestsData,
    ChangeRequestFlattenedData, ChangeRequestFlattenedDataResponse, ChangeRequestFlattenedDataResponseBody,
    RecordData, RecordDataResponse, RecordDataResponseBody,
    VerificationsData, VerificationsDataResponse, VerificationsDataResponseBody,
    VerificationData, VerificationDataResponse, VerificationDataResponseBody,
    DeduplicationRegisterResultsData, DeduplicationRegisterResultsDataResponse, DeduplicationRegisterResultsDataResponseBody,
    DeduplicationChangerequestResultsData, DeduplicationChangerequestResultsDataResponse, DeduplicationChangerequestResultsDataResponseBody,
    IncomingModelKeyPathData, IncomingModelKeyPathResponseBody, IncomingModelKeyPathListResponseBody,
    IncomingModelSemanticPatternResponseBody, IncomingModelSemanticPatternsResponseBody,
    IncomingModelRegisterSemanticPatternResponseBody, IncomingModelRegisterSemanticPatternsResponseBody,
    IncomingTemplateResponseBody, IncomingTemplatesResponseBody,
    DataModelResponseBody, DataModelsResponseBody, SubscriptionActivityLogsResponseBody,
    OutgoingTopicResponseBody, OutgoingTopicsResponseBody, OutgoingTemplateResponseBody, OutgoingTemplatesResponseBody,
    RegisterSchemaData, RegisterSchemaDataResponse, RegisterSchemaDataResponseBody,
    RegisterFieldsData, RegisterFieldsDataResponse, RegisterFieldsDataResponseBody,
    RegisterSectionData, RegisterSectionsDataResponse, RegisterSectionsDataResponseBody,
    RegisterSectionDataResponse, RegisterSectionDataResponseBody,
    RegisterSectionUISchemaData, RegisterSectionUISchemaDataResponse, RegisterSectionUISchemaDataResponseBody,
    RegisterUITabData, RegisterTabsDataResponse, RegisterTabsDataResponseBody,
    RegisterTabDataResponse, RegisterTabDataResponseBody,
    RegisterTabSectionDataResponse, RegisterTabSectionDataResponseBody,
    RegisterTabSectionsDataResponse, RegisterTabSectionsDataResponseBody,
    RegisterTabMetadataDataResponse, RegisterTabMetadataDataResponseBody,
    RegisterTabMetadataListResponse, RegisterTabMetadataListResponseBody,
    RegisterSectionMetadataDataResponse, RegisterSectionMetadataDataResponseBody,
    RegisterSectionMetadataListResponse, RegisterSectionMetadataListResponseBody,
    RegisterSectionMetadataUISchemaDataResponse, RegisterSectionMetadataUISchemaDataResponseBody,
    SectionRecordsDataResponse, SectionRecordsDataResponseBody,
    RegisterTabRecordData, RegisterTabRecordsDataResponse, RegisterTabRecordsDataResponseBody,
    DocumentsData, DocumentsResponse, DocumentsResponseBody,
    DeleteDocumentsData, DeleteDocumentsResponse, DeleteDocumentsResponseBody,
    IntakeFormDocumentsData, IntakeFormDocumentsResponse, IntakeFormDocumentsResponseBody,
    RegistryConfigurationData, RegistryConfigurationDataResponse, RegistryConfigurationDataResponseBody,
    RegistryThemeData, RegistryThemesResponse, RegistryThemesResponseBody,
    RegistryThemeValueData, RegistryThemeValuesResponse, RegistryThemeValuesResponseBody,
    ThemeOperationData, ThemeOperationResponse, ThemeOperationResponseBody,
    RegistryLanguageData, RegistryLanguagesResponse, RegistryLanguagesResponseBody,RegistryLanguageResponse,RegistryLanguageResponseBody,
    LanguageOperationData, LanguageOperationResponse, LanguageOperationResponseBody,
    NumberOfRequestsPendingData, NumberOfRequestsPendingResponse, NumberOfRequestsPendingResponseBody,
    EarliestPendingChangeRequestData, EarliestPendingChangeRequestResponse, EarliestPendingChangeRequestResponseBody,
    SectionDocumentsData, SectionDocumentsResponse, SectionDocumentsResponseBody,
    ChangeRequestDocumentsData, ChangeRequestDocumentsResponse, ChangeRequestDocumentsResponseBody,
    GetIngestionSummaryDataRequest, GetIngestionSummaryDataRequestBody,
    IngestionSummaryData, IngestionSummaryDataResponse, IngestionSummaryDataResponseBody,
    IngestionDataPayloadResponse, IngestionDataPayloadResponseBody,
    IngestionDataSearchResultsResponse, IngestionDataSearchResultsResponseBody, IngestionDataSearchResultData,
    IngestionDataPayload,
    VcConfigurationResponse, VcConfigurationResponseBody, VcConfigurationData,
    ImportFileConfigurationResponse, ImportFileConfigurationResponseBody, ImportFileConfigurationData,
    G2PInputMechanismResponse, G2PInputMechanismResponseBody, G2PInputMechanismData,
    AllowedParentsData, AllowedParentsDataResponse, AllowedParentsDataResponseBody,
    G2PRegisterSectionData, G2PRegisterUITabData, G2PRegisterUITabSectionData,
    RegisterSectionIdData, RegisterTabIdData, RegisterTabSectionIdData,
    RegistrantAuthProvidersResponse, RegistrantAuthProvidersResponseBody, RegistrantAuthProvidersResponsePayload,
    RegistrantAuthInitiateResponse, RegistrantAuthInitiateResponseBody, RegistrantAuthInitiateResponsePayload,
    RegistrantAuthStatusResponse, RegistrantAuthStatusResponseBody, RegistrantAuthStatusResponsePayload,
    RegistrantAuthHistoryResponse, RegistrantAuthHistoryResponseBody, RegistrantAuthHistoryResponsePayload
)

from openg2p_registry_core.errors import G2PRegistryErrorCodes, G2PRegistryException


class RequestResponseHelper(BaseService):
    
    def construct_error_response(self, error: Exception, g2p_request: G2PRequest = None) -> G2PResponse:
        """
        Unified error response constructor that handles both G2PRegistryException and generic exceptions.
        For G2PRegistryException, uses the exception's code and message.
        For other exceptions, returns a generic internal error (full details are logged only).
        g2p_request is optional - if not provided, request_id will be empty string.
        """
        if isinstance(error, G2PRegistryException):
            error_code = error.code
            error_message = error.message
        else:
            error_code = G2PRegistryErrorCodes.UNEXPECTED_ERROR.value[1]
            error_message = G2PRegistryErrorCodes.UNEXPECTED_ERROR.value[0]

        request_id = g2p_request.request_header.request_id if g2p_request else ""

        g2p_response_header = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.ERROR,
            response_error_code=error_code,
            response_error_message=error_message,
            response_timestamp=datetime.now()
        )
        error_response = G2PResponse(
            response_header=g2p_response_header,
            response_body=G2PResponseBody(
                pagination_response=None,
                response_payload=None
            )
        )

        return error_response

    def construct_success_response(
        self,
        response_body: G2PResponseBody,
        request: G2PRequest,
        pagination_response: Optional[G2PPaginationResponse] = None,
    ) -> G2PResponse:
        request_id = request.request_header.request_id if request else ""

        if pagination_response is not None:
            response_body.pagination_response = pagination_response

        g2p_response_header = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now(),
        )

        return G2PResponse(
            response_header=g2p_response_header,
            response_body=response_body,
        )

    def construct_change_request_success_response(self, change_request_response_payload: ChangeRequestResponsePayload, g2p_request: G2PRequest) -> ChangeRequestResponse:

        g2p_response_header = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: ChangeRequestResponseBody = ChangeRequestResponseBody(
            response_payload=change_request_response_payload
        )

        change_request_response: ChangeRequestResponse = ChangeRequestResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return change_request_response

    def construct_submission_success_response(
        self,
        submission_response_payload: SubmissionResponsePayload,
        g2p_request: G2PRequest
    ) -> SubmissionResponse:
        g2p_response_header = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: SubmissionResponseBody = SubmissionResponseBody(
            response_payload=submission_response_payload
        )

        submission_response: SubmissionResponse = SubmissionResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return submission_response

    def construct_submission_search_results_success_response(
        self,
        search_results_list: List[SubmissionResponsePayload],
        g2p_request: G2PRequest = None,
        number_of_items: int = None,
        number_of_pages: int = None
    ) -> SubmissionSearchResultsResponse:
        request_id = g2p_request.request_header.request_id if g2p_request else ""
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        pagination_response = None
        if number_of_items is not None and number_of_pages is not None:
            pagination_response = G2PPaginationResponse(
                number_of_items=number_of_items,
                number_of_pages=number_of_pages
            )

        response_body: SubmissionSearchResultsResponseBody = SubmissionSearchResultsResponseBody(
            response_payload=search_results_list,
            pagination_response=pagination_response
        )

        search_results_response: SubmissionSearchResultsResponse = SubmissionSearchResultsResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return search_results_response

    def construct_registrant_auth_providers_success_response(
        self,
        response_payload: RegistrantAuthProvidersResponsePayload,
        g2p_request: G2PRequest,
    ) -> RegistrantAuthProvidersResponse:
        g2p_response_header = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now(),
        )
        response_body: RegistrantAuthProvidersResponseBody = RegistrantAuthProvidersResponseBody(
            response_payload=response_payload
        )
        return RegistrantAuthProvidersResponse(
            response_header=g2p_response_header,
            response_body=response_body,
        )

    def construct_registrant_auth_initiate_success_response(
        self,
        response_payload: RegistrantAuthInitiateResponsePayload,
        g2p_request: G2PRequest,
    ) -> RegistrantAuthInitiateResponse:
        g2p_response_header = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now(),
        )
        response_body: RegistrantAuthInitiateResponseBody = RegistrantAuthInitiateResponseBody(
            response_payload=response_payload
        )
        return RegistrantAuthInitiateResponse(
            response_header=g2p_response_header,
            response_body=response_body,
        )

    def construct_registrant_auth_status_success_response(
        self,
        response_payload: RegistrantAuthStatusResponsePayload,
        g2p_request: G2PRequest,
    ) -> RegistrantAuthStatusResponse:
        g2p_response_header = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now(),
        )
        response_body: RegistrantAuthStatusResponseBody = RegistrantAuthStatusResponseBody(
            response_payload=response_payload
        )
        return RegistrantAuthStatusResponse(
            response_header=g2p_response_header,
            response_body=response_body,
        )

    def construct_registrant_auth_history_success_response(
        self,
        response_payload: RegistrantAuthHistoryResponsePayload,
        g2p_request: G2PRequest,
    ) -> RegistrantAuthHistoryResponse:
        g2p_response_header = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now(),
        )
        response_body: RegistrantAuthHistoryResponseBody = RegistrantAuthHistoryResponseBody(
            response_payload=response_payload
        )
        return RegistrantAuthHistoryResponse(
            response_header=g2p_response_header,
            response_body=response_body,
        )

    def construct_intake_forms_for_register_success_response(
        self,
        intake_forms_list: List[RegisterUITabData],
        g2p_request: G2PRequest = None,
        number_of_items: int = None,
        number_of_pages: int = None
    ) -> IntakeFormsForRegisterResponse:
        request_id = g2p_request.request_header.request_id if g2p_request else ""
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        pagination_response = None
        if number_of_items is not None and number_of_pages is not None:
            pagination_response = G2PPaginationResponse(
                number_of_items=number_of_items,
                number_of_pages=number_of_pages
            )

        response_body: IntakeFormsForRegisterResponseBody = IntakeFormsForRegisterResponseBody(
            response_payload=intake_forms_list,
            pagination_response=pagination_response
        )

        response: IntakeFormsForRegisterResponse = IntakeFormsForRegisterResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return response

    def construct_intake_form_metadata_success_response(
        self,
        intake_form_sections_list: List[RegisterSectionData],
        g2p_request: G2PRequest = None,
        number_of_items: int = None,
        number_of_pages: int = None
    ) -> IntakeFormMetadataResponse:
        request_id = g2p_request.request_header.request_id if g2p_request else ""
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        pagination_response = None
        if number_of_items is not None and number_of_pages is not None:
            pagination_response = G2PPaginationResponse(
                number_of_items=number_of_items,
                number_of_pages=number_of_pages
            )

        response_body: IntakeFormMetadataResponseBody = IntakeFormMetadataResponseBody(
            response_payload=intake_form_sections_list,
            pagination_response=pagination_response
        )

        response: IntakeFormMetadataResponse = IntakeFormMetadataResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return response

    def construct_intake_form_submissions_summary_success_response(
        self,
        summary_data: IntakeFormSubmissionsSummaryData,
        g2p_request: G2PRequest = None
    ) -> IntakeFormSubmissionsSummaryResponse:
        request_id = g2p_request.request_header.request_id if g2p_request else ""
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: IntakeFormSubmissionsSummaryResponseBody = IntakeFormSubmissionsSummaryResponseBody(
            response_payload=summary_data
        )

        summary_response: IntakeFormSubmissionsSummaryResponse = IntakeFormSubmissionsSummaryResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return summary_response

    def construct_vc_configuration_data_success_response(
        self,
        vc_configuration_data: List[VcConfigurationData],
        g2p_request: G2PRequest = None,
        pagination_response: Optional[G2PPaginationResponse] = None,
    ) -> VcConfigurationResponse:
        """Construct success response for vc configuration endpoints."""
        request_id = g2p_request.request_header.request_id if g2p_request else ""

        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: VcConfigurationResponseBody = VcConfigurationResponseBody(
            pagination_response=pagination_response,
            response_payload=vc_configuration_data,
        )

        response: VcConfigurationResponse = VcConfigurationResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return response

    def construct_import_file_configuration_data_success_response(
        self,
        import_file_configuration_data: List[ImportFileConfigurationData],
        g2p_request: G2PRequest = None,
        pagination_response: Optional[G2PPaginationResponse] = None,
    ) -> ImportFileConfigurationResponse:
        """Construct success response for import file configuration endpoints."""
        request_id = g2p_request.request_header.request_id if g2p_request else ""

        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now(),
        )

        response_body = ImportFileConfigurationResponseBody(
            pagination_response=pagination_response,
            response_payload=import_file_configuration_data,
        )

        return ImportFileConfigurationResponse(
            response_header=g2p_response_header,
            response_body=response_body,
        )
    
    def construct_input_mechanisms_success_response(
        self,
        input_mechanisms: List[G2PInputMechanismData],
        g2p_request: G2PRequest = None
    ) -> G2PInputMechanismResponse:
        """Construct success response for input mechanisms endpoints."""
        request_id = g2p_request.request_header.request_id if g2p_request else ""

        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: G2PInputMechanismResponseBody = G2PInputMechanismResponseBody(
            response_payload=input_mechanisms
        )

        response: G2PInputMechanismResponse = G2PInputMechanismResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return response

    def construct_ingestion_summary_data_success_response(self, ingestion_summary_data: IngestionSummaryData, g2p_request: G2PRequest = None) -> IngestionSummaryDataResponse:
        request_id = g2p_request.request_header.request_id if g2p_request else ""

        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: IngestionSummaryDataResponseBody = IngestionSummaryDataResponseBody(
            response_payload=ingestion_summary_data
        )

        ingestion_summary_data_response: IngestionSummaryDataResponse = IngestionSummaryDataResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return ingestion_summary_data_response

    def construct_register_summary_data_success_response(self, register_summary_data_list: List[RegisterSummaryData], g2p_request: G2PRequest = None) -> RegisterSummaryDataResponse:
        request_id = g2p_request.request_header.request_id if g2p_request else ""

        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: RegisterSummaryDataResponseBody = RegisterSummaryDataResponseBody(
            response_payload=register_summary_data_list
        )

        register_summary_data_response: RegisterSummaryDataResponse = RegisterSummaryDataResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return register_summary_data_response

    def construct_change_request_summary_data_success_response(self, change_request_summary_data: ChangeRequestSummaryData, g2p_request: G2PRequest = None) -> ChangeRequestSummaryDataResponse:
        request_id = g2p_request.request_header.request_id if g2p_request else ""

        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: ChangeRequestSummaryDataResponseBody = ChangeRequestSummaryDataResponseBody(
            response_payload=change_request_summary_data
        )

        change_request_summary_data_response: ChangeRequestSummaryDataResponse = ChangeRequestSummaryDataResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return change_request_summary_data_response

    def construct_all_registers_success_response(self, all_registers_list: List[AllRegistersRegisterData], g2p_request: G2PRequest = None, number_of_items: int = None, number_of_pages: int = None) -> AllRegistersResponse:
        request_id = g2p_request.request_header.request_id if g2p_request else ""

        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        # Add pagination response if provided
        pagination_response = None
        if number_of_items is not None and number_of_pages is not None:
            pagination_response = G2PPaginationResponse(
                number_of_items=number_of_items,
                number_of_pages=number_of_pages
            )

        response_body: AllRegistersResponseBody = AllRegistersResponseBody(
            response_payload=all_registers_list,
            pagination_response=pagination_response
        )

        all_registers_response: AllRegistersResponse = AllRegistersResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return all_registers_response

    def construct_dashboard_registers_success_response(self, dashboard_registers_list: List[RegisterData], g2p_request: G2PRequest = None) -> DashboardRegistersResponse:
        """Construct success response for get_dashboard_registers endpoint (clone of construct_all_registers_success_response)"""
        request_id = g2p_request.request_header.request_id if g2p_request else ""

        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: DashboardRegistersResponseBody = DashboardRegistersResponseBody(
            response_payload=dashboard_registers_list
        )

        dashboard_registers_response: DashboardRegistersResponse = DashboardRegistersResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return dashboard_registers_response

    def construct_child_registers_success_response(self, child_registers_list: List[ChildRegisterData], g2p_request: G2PRequest = None) -> ChildRegistersResponse:
        request_id = g2p_request.request_header.request_id if g2p_request else ""

        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: ChildRegistersResponseBody = ChildRegistersResponseBody(
            response_payload=child_registers_list
        )

        child_registers_response: ChildRegistersResponse = ChildRegistersResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return child_registers_response

    def construct_search_results_success_response(self, search_results_list: List[SearchResultData], g2p_request: G2PRequest = None, number_of_items: int = 0, number_of_pages: int = 0) -> SearchResultsResponse:
        request_id = g2p_request.request_header.request_id if g2p_request else ""

        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        pagination_response = None
        if number_of_items > 0 or number_of_pages > 0:
            pagination_response = G2PPaginationResponse(
                number_of_items=number_of_items,
                number_of_pages=number_of_pages
            )

        response_body: SearchResultsResponseBody = SearchResultsResponseBody(
            pagination_response=pagination_response,
            response_payload=search_results_list
        )

        search_results_response: SearchResultsResponse = SearchResultsResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return search_results_response

    def construct_ingestion_data_payload_success_response(self, data_payload: IngestionDataPayload, g2p_request: G2PRequest = None) -> IngestionDataPayloadResponse:
        request_id = g2p_request.request_header.request_id if g2p_request else ""

        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: IngestionDataPayloadResponseBody = IngestionDataPayloadResponseBody(
            response_payload=data_payload
        )

        ingestion_data_payload_response: IngestionDataPayloadResponse = IngestionDataPayloadResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return ingestion_data_payload_response

    def construct_ingestion_data_search_results_success_response(self, search_results_list: List[IngestionDataSearchResultData], g2p_request: G2PRequest = None, number_of_items: int = None, number_of_pages: int = None) -> IngestionDataSearchResultsResponse:
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        pagination_response = None
        if number_of_items is not None and number_of_pages is not None:
            pagination_response = G2PPaginationResponse(
                number_of_items=number_of_items,
                number_of_pages=number_of_pages
            )

        response_body: IngestionDataSearchResultsResponseBody = IngestionDataSearchResultsResponseBody(
            response_payload=search_results_list,
            pagination_response=pagination_response
        )

        ingestion_data_search_results_response: IngestionDataSearchResultsResponse = IngestionDataSearchResultsResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return ingestion_data_search_results_response

    def construct_change_request_search_results_success_response(self, search_results_list: List[ChangeRequestSearchResultData], g2p_request: G2PRequest = None, number_of_items: int = None, number_of_pages: int = None) -> ChangeRequestSearchResultsResponse:
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        pagination_response = None
        if number_of_items is not None and number_of_pages is not None:
            pagination_response = G2PPaginationResponse(
                number_of_items=number_of_items,
                number_of_pages=number_of_pages
            )

        response_body: ChangeRequestSearchResultsResponseBody = ChangeRequestSearchResultsResponseBody(
            response_payload=search_results_list,
            pagination_response=pagination_response
        )

        change_request_search_results_response: ChangeRequestSearchResultsResponse = ChangeRequestSearchResultsResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return change_request_search_results_response

    def construct_number_of_versions_success_response(self, number_of_versions_data: NumberOfVersionsData, g2p_request: G2PRequest = None) -> NumberOfVersionsResponse:
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: NumberOfVersionsResponseBody = NumberOfVersionsResponseBody(
            response_payload=number_of_versions_data
        )

        number_of_versions_response: NumberOfVersionsResponse = NumberOfVersionsResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return number_of_versions_response

    def construct_record_history_success_response(self, record_history_data: RecordHistoryListData, g2p_request: G2PRequest = None) -> RecordHistoryDataResponse:
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: RecordHistoryDataResponseBody = RecordHistoryDataResponseBody(
            response_payload=record_history_data
        )

        record_history_response: RecordHistoryDataResponse = RecordHistoryDataResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return record_history_response

    def construct_version_dates_success_response(self, version_dates_data: VersionDatesData, g2p_request: G2PRequest = None) -> VersionDatesDataResponse:
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: VersionDatesDataResponseBody = VersionDatesDataResponseBody(
            response_payload=version_dates_data
        )

        version_dates_response: VersionDatesDataResponse = VersionDatesDataResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return version_dates_response

    def construct_changes_for_date_success_response(self, changes_for_date_data: VersionsForDateData, g2p_request: G2PRequest = None) -> ChangesForDateDataResponse:
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: ChangesForDateDataResponseBody = ChangesForDateDataResponseBody(
            response_payload=changes_for_date_data
        )

        changes_for_date_response: ChangesForDateDataResponse = ChangesForDateDataResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return changes_for_date_response

    def construct_number_of_pending_change_requests_success_response(self, number_of_pending_change_requests_data: NumberOfPendingChangeRequestsData, g2p_request: G2PRequest = None) -> NumberOfPendingChangeRequestsResponse:
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: NumberOfPendingChangeRequestsResponseBody = NumberOfPendingChangeRequestsResponseBody(
            response_payload=number_of_pending_change_requests_data
        )

        number_of_pending_change_requests_response: NumberOfPendingChangeRequestsResponse = NumberOfPendingChangeRequestsResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return number_of_pending_change_requests_response

    def construct_number_of_pending_change_requests_for_submission_success_response(
        self,
        number_of_pending_change_requests_for_submission_data: NumberOfPendingChangeRequestsForSubmissionData,
        g2p_request: G2PRequest = None
    ) -> NumberOfPendingChangeRequestsForSubmissionResponse:
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: NumberOfPendingChangeRequestsForSubmissionResponseBody = (
            NumberOfPendingChangeRequestsForSubmissionResponseBody(
                response_payload=number_of_pending_change_requests_for_submission_data
            )
        )

        response: NumberOfPendingChangeRequestsForSubmissionResponse = (
            NumberOfPendingChangeRequestsForSubmissionResponse(
                response_header=g2p_response_header,
                response_body=response_body
            )
        )
        return response

    def construct_number_of_cross_register_changes_success_response(self, number_of_cross_register_changes_data: NumberOfCrossRegisterChangesData, g2p_request: G2PRequest = None) -> NumberOfCrossRegisterChangesResponse:
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: NumberOfCrossRegisterChangesResponseBody = NumberOfCrossRegisterChangesResponseBody(
            response_payload=number_of_cross_register_changes_data
        )

        number_of_cross_register_changes_response: NumberOfCrossRegisterChangesResponse = NumberOfCrossRegisterChangesResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return number_of_cross_register_changes_response

    def construct_cross_register_changes_success_response(self, cross_register_changes: List[CrossRegisterChangeRequestData], g2p_request: G2PRequest = None) -> CrossRegisterChangesDataResponse:
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: CrossRegisterChangesDataResponseBody = CrossRegisterChangesDataResponseBody(
            response_payload=CrossRegisterChangesData(cross_register_changes=cross_register_changes)
        )

        cross_register_changes_response: CrossRegisterChangesDataResponse = CrossRegisterChangesDataResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return cross_register_changes_response

    def construct_change_requests_success_response(self, change_requests_list: list = None, change_requests_data: ChangeRequestsData = None, g2p_request: G2PRequest = None, number_of_items: int = None, number_of_pages: int = None) -> ChangeRequestFlattenedDataResponse:
        """Construct success response for change requests with flattened payload data."""
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        # Return flattened change requests (list of dicts with change_payload fields at root level)
        if change_requests_list is not None:
            payload = change_requests_list
        elif change_requests_data is not None:
            payload = change_requests_data.change_requests
        else:
            payload = []

        pagination_response = None
        if number_of_items is not None and number_of_pages is not None:
            pagination_response = G2PPaginationResponse(
                number_of_items=number_of_items,
                number_of_pages=number_of_pages
            )

        response_body: ChangeRequestFlattenedDataResponseBody = ChangeRequestFlattenedDataResponseBody(
            response_payload=payload,
            pagination_response=pagination_response
        )

        change_requests_response: ChangeRequestFlattenedDataResponse = ChangeRequestFlattenedDataResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return change_requests_response

    def construct_change_request_data_success_response(self, change_request_data: ChangeRequestData, g2p_request: G2PRequest = None) -> ChangeRequestDataResponse:
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: ChangeRequestDataResponseBody = ChangeRequestDataResponseBody(
            response_payload=change_request_data
        )

        change_request_response: ChangeRequestDataResponse = ChangeRequestDataResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return change_request_response

    def construct_record_success_response(self, record_data: RecordData, g2p_request: G2PRequest = None) -> RecordDataResponse:
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: RecordDataResponseBody = RecordDataResponseBody(
            response_payload=record_data
        )

        record_response: RecordDataResponse = RecordDataResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return record_response

    def construct_verifications_success_response(self, verifications_list: List[VerificationData] = None, verifications_data: VerificationsData = None, g2p_request: G2PRequest = None, number_of_items: int = None, number_of_pages: int = None) -> VerificationsDataResponse:
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        # Support both old (verifications_data) and new (verifications_list) parameters
        if verifications_list is not None:
            payload = VerificationsData(verifications=verifications_list)
        else:
            payload = verifications_data

        pagination_response = None
        if number_of_items is not None and number_of_pages is not None:
            pagination_response = G2PPaginationResponse(
                number_of_items=number_of_items,
                number_of_pages=number_of_pages
            )

        response_body: VerificationsDataResponseBody = VerificationsDataResponseBody(
            response_payload=payload,
            pagination_response=pagination_response
        )

        verifications_response: VerificationsDataResponse = VerificationsDataResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return verifications_response

    def construct_verification_success_response(self, verification_data: VerificationData, g2p_request: G2PRequest = None) -> VerificationDataResponse:
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: VerificationDataResponseBody = VerificationDataResponseBody(
            response_payload=verification_data
        )

        verification_response: VerificationDataResponse = VerificationDataResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return verification_response

    def construct_ingestion_config_success_response(
        self,
        payload_data,
        response_class,
        g2p_request=None,
        number_of_items: int = None,
        number_of_pages: int = None,
    ):
        """Generic method to construct success response for ingestion configuration endpoints"""
        request_id = g2p_request.request_header.request_id if g2p_request else ""

        g2p_response_header = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        pagination_response = None
        if number_of_items is not None and number_of_pages is not None:
            pagination_response = G2PPaginationResponse(
                number_of_items=number_of_items,
                number_of_pages=number_of_pages,
            )

        # Determine the response body class based on response_class
        response_class_name = response_class.__name__
        if response_class_name == 'IncomingModelKeyPathResponse':
            response_body = IncomingModelKeyPathResponseBody(
                response_payload=payload_data,
                pagination_response=pagination_response,
            )
        elif response_class_name == 'IncomingModelKeyPathListResponse':
            response_body = IncomingModelKeyPathListResponseBody(
                response_payload=payload_data,
                pagination_response=pagination_response,
            )
        elif response_class_name == 'IncomingModelSemanticPatternResponse':
            response_body = IncomingModelSemanticPatternResponseBody(
                response_payload=payload_data,
                pagination_response=pagination_response,
            )
        elif response_class_name == 'IncomingModelSemanticPatternsResponse':
            response_body = IncomingModelSemanticPatternsResponseBody(
                response_payload=payload_data,
                pagination_response=pagination_response,
            )
        elif response_class_name == 'IncomingModelRegisterSemanticPatternResponse':
            response_body = IncomingModelRegisterSemanticPatternResponseBody(
                response_payload=payload_data,
                pagination_response=pagination_response,
            )
        elif response_class_name == 'IncomingModelRegisterSemanticPatternsResponse':
            response_body = IncomingModelRegisterSemanticPatternsResponseBody(
                response_payload=payload_data,
                pagination_response=pagination_response,
            )
        elif response_class_name == 'IncomingTemplateResponse':
            response_body = IncomingTemplateResponseBody(
                response_payload=payload_data,
                pagination_response=pagination_response,
            )
        elif response_class_name == 'IncomingTemplatesResponse':
            response_body = IncomingTemplatesResponseBody(
                response_payload=payload_data,
                pagination_response=pagination_response,
            )
        elif response_class_name == 'DataModelResponse':
            response_body = DataModelResponseBody(
                response_payload=payload_data,
                pagination_response=pagination_response,
            )
        elif response_class_name == 'DataModelsResponse':
            response_body = DataModelsResponseBody(
                response_payload=payload_data,
                pagination_response=pagination_response,
            )
        elif response_class_name == 'SubscriptionActivityLogsResponse':
            response_body = SubscriptionActivityLogsResponseBody(
                response_payload=payload_data,
                pagination_response=pagination_response,
            )
        else:
            # Fallback for other response types
            response_body = G2PResponseBody(
                response_payload=payload_data,
                pagination_response=pagination_response,
            )

        response = response_class(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return response

    def construct_deduplication_register_results_success_response(self, dedup_results_list: List = None, dedup_results_data: DeduplicationRegisterResultsData = None, g2p_request: G2PRequest = None, number_of_items: int = None, number_of_pages: int = None) -> DeduplicationRegisterResultsDataResponse:
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        # Support both old (dedup_results_data) and new (dedup_results_list) parameters
        if dedup_results_list is not None:
            payload = DeduplicationRegisterResultsData(results=dedup_results_list)
        else:
            payload = dedup_results_data

        pagination_response = None
        if number_of_items is not None and number_of_pages is not None:
            pagination_response = G2PPaginationResponse(
                number_of_items=number_of_items,
                number_of_pages=number_of_pages
            )

        response_body: DeduplicationRegisterResultsDataResponseBody = DeduplicationRegisterResultsDataResponseBody(
            response_payload=payload,
            pagination_response=pagination_response
        )

        dedup_results_response: DeduplicationRegisterResultsDataResponse = DeduplicationRegisterResultsDataResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return dedup_results_response

    def construct_deduplication_change_request_results_success_response(self, dedup_results_list: List = None, dedup_results_data: DeduplicationChangerequestResultsData = None, g2p_request: G2PRequest = None, number_of_items: int = None, number_of_pages: int = None) -> DeduplicationChangerequestResultsDataResponse:
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        # Support both old (dedup_results_data) and new (dedup_results_list) parameters
        if dedup_results_list is not None:
            payload = DeduplicationChangerequestResultsData(results=dedup_results_list)
        else:
            payload = dedup_results_data

        pagination_response = None
        if number_of_items is not None and number_of_pages is not None:
            pagination_response = G2PPaginationResponse(
                number_of_items=number_of_items,
                number_of_pages=number_of_pages
            )

        response_body: DeduplicationChangerequestResultsDataResponseBody = DeduplicationChangerequestResultsDataResponseBody(
            response_payload=payload,
            pagination_response=pagination_response
        )

        dedup_results_response: DeduplicationChangerequestResultsDataResponse = DeduplicationChangerequestResultsDataResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return dedup_results_response

    def construct_outgestion_config_success_response(
        self,
        payload_data,
        response_class,
        g2p_request=None,
        number_of_items: int = None,
        number_of_pages: int = None,
    ):
        """Generic method to construct success response for ingestion configuration endpoints"""
        request_id = g2p_request.request_header.request_id if g2p_request else ""

        g2p_response_header = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        pagination_response = None
        if number_of_items is not None and number_of_pages is not None:
            pagination_response = G2PPaginationResponse(
                number_of_items=number_of_items,
                number_of_pages=number_of_pages,
            )

        # Determine the response body class based on response_class
        response_class_name = response_class.__name__
        if response_class_name == 'OutgoingTopicResponse':
            response_body = OutgoingTopicResponseBody(
                response_payload=payload_data,
                pagination_response=pagination_response,
            )
        elif response_class_name == 'OutgoingTopicsResponse':
            response_body = OutgoingTopicsResponseBody(
                response_payload=payload_data,
                pagination_response=pagination_response,
            )
        elif response_class_name == 'OutgoingTemplateResponse':
            response_body = OutgoingTemplateResponseBody(
                response_payload=payload_data,
                pagination_response=pagination_response,
            )
        elif response_class_name == 'OutgoingTemplatesResponse':
            response_body = OutgoingTemplatesResponseBody(
                response_payload=payload_data,
                pagination_response=pagination_response,
            )
        else:
            # Fallback for other response types
            response_body = G2PResponseBody(
                response_payload=payload_data,
                pagination_response=pagination_response,
            )

        response = response_class(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return response

    def construct_register_schema_success_response(self, register_schema_data: RegisterSchemaData, g2p_request: G2PRequest = None) -> RegisterSchemaDataResponse:
        """Construct success response for get_register_schema endpoint."""
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: RegisterSchemaDataResponseBody = RegisterSchemaDataResponseBody(
            response_payload=register_schema_data
        )

        register_schema_response: RegisterSchemaDataResponse = RegisterSchemaDataResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return register_schema_response

    def construct_register_fields_success_response(
        self,
        register_fields_data: RegisterFieldsData,
        g2p_request: G2PRequest = None,
        number_of_items: int = None,
        number_of_pages: int = None,
    ) -> RegisterFieldsDataResponse:
        """Construct success response for get_register_fields endpoint."""
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now(),
        )
        pagination_response = None
        if number_of_items is not None and number_of_pages is not None:
            pagination_response = G2PPaginationResponse(
                number_of_items=number_of_items,
                number_of_pages=number_of_pages,
            )
        response_body: RegisterFieldsDataResponseBody = RegisterFieldsDataResponseBody(
            response_payload=register_fields_data,
            pagination_response=pagination_response,
        )
        return RegisterFieldsDataResponse(
            response_header=g2p_response_header,
            response_body=response_body,
        )

    def construct_register_data_success_response(self, register_data: RegisterData, g2p_request: G2PRequest = None) -> RegisterDataResponse:
        """Construct success response for create_register endpoint."""
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: RegisterDataResponseBody = RegisterDataResponseBody(
            response_payload=register_data
        )

        register_data_response: RegisterDataResponse = RegisterDataResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return register_data_response

    def construct_register_sections_success_response(
        self,
        register_sections_list: List[RegisterSectionData],
        g2p_request: G2PRequest = None,
        number_of_items: int = None,
        number_of_pages: int = None
    ) -> RegisterSectionsDataResponse:
        """Construct success response for get_register_sections endpoint."""
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        # Add pagination response if provided
        pagination_response = None
        if number_of_items is not None and number_of_pages is not None:
            pagination_response = G2PPaginationResponse(
                number_of_items=number_of_items,
                number_of_pages=number_of_pages
            )

        response_body: RegisterSectionsDataResponseBody = RegisterSectionsDataResponseBody(
            response_payload=register_sections_list,
            pagination_response=pagination_response
        )

        register_sections_response: RegisterSectionsDataResponse = RegisterSectionsDataResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return register_sections_response

    def construct_register_section_success_response(self, register_section_data: RegisterSectionData, g2p_request: G2PRequest = None) -> RegisterSectionDataResponse:
        """Construct success response for get_schema_definition_for_register_section endpoint."""
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: RegisterSectionDataResponseBody = RegisterSectionDataResponseBody(
            response_payload=register_section_data
        )

        register_section_response: RegisterSectionDataResponse = RegisterSectionDataResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return register_section_response

    def construct_register_section_ui_schema_success_response(
        self,
        register_section_ui_schema_data: RegisterSectionUISchemaData,
        g2p_request: G2PRequest = None
    ) -> RegisterSectionUISchemaDataResponse:
        """Construct success response for get_register_section_ui_schema endpoint."""
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: RegisterSectionUISchemaDataResponseBody = RegisterSectionUISchemaDataResponseBody(
            response_payload=register_section_ui_schema_data
        )

        return RegisterSectionUISchemaDataResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )

    def construct_register_tabs_success_response(
        self,
        register_tabs_list: List[RegisterUITabData],
        g2p_request: G2PRequest = None,
        number_of_items: int = None,
        number_of_pages: int = None
    ) -> RegisterTabsDataResponse:
        """Construct success response for get_register_tabs endpoint."""
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        # Add pagination response if provided
        pagination_response = None
        if number_of_items is not None and number_of_pages is not None:
            pagination_response = G2PPaginationResponse(
                number_of_items=number_of_items,
                number_of_pages=number_of_pages
            )

        response_body: RegisterTabsDataResponseBody = RegisterTabsDataResponseBody(
            response_payload=register_tabs_list,
            pagination_response=pagination_response
        )

        register_tabs_response: RegisterTabsDataResponse = RegisterTabsDataResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return register_tabs_response

    def construct_register_tab_success_response(self, register_tab_data: RegisterUITabData, g2p_request: G2PRequest = None) -> RegisterTabDataResponse:
        """Construct success response for add_register_tab endpoint."""
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: RegisterTabDataResponseBody = RegisterTabDataResponseBody(
            response_payload=register_tab_data
        )

        register_tab_response: RegisterTabDataResponse = RegisterTabDataResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return register_tab_response

    def construct_register_tab_metadata_success_response(
        self,
        register_tab_data: G2PRegisterUITabData | RegisterTabIdData | None,
        g2p_request: G2PRequest = None,
    ) -> RegisterTabMetadataDataResponse:
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )
        response_body = RegisterTabMetadataDataResponseBody(response_payload=register_tab_data)
        return RegisterTabMetadataDataResponse(response_header=g2p_response_header, response_body=response_body)

    def construct_register_tab_metadata_list_success_response(
        self,
        register_tabs_list: List[G2PRegisterUITabData],
        g2p_request: G2PRequest = None,
        number_of_items: int = None,
        number_of_pages: int = None,
    ) -> RegisterTabMetadataListResponse:
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )
        pagination_response = None
        if number_of_items is not None and number_of_pages is not None:
            pagination_response = G2PPaginationResponse(
                number_of_items=number_of_items,
                number_of_pages=number_of_pages
            )
        response_body = RegisterTabMetadataListResponseBody(
            response_payload=register_tabs_list,
            pagination_response=pagination_response,
        )
        return RegisterTabMetadataListResponse(response_header=g2p_response_header, response_body=response_body)

    def construct_register_tab_section_success_response(
        self,
        register_tab_section_data: G2PRegisterUITabSectionData | RegisterTabSectionIdData | None,
        g2p_request: G2PRequest = None,
    ) -> RegisterTabSectionDataResponse:
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )
        response_body = RegisterTabSectionDataResponseBody(response_payload=register_tab_section_data)
        return RegisterTabSectionDataResponse(response_header=g2p_response_header, response_body=response_body)

    def construct_register_tab_sections_success_response(
        self,
        register_tab_sections_list: List[G2PRegisterUITabSectionData],
        g2p_request: G2PRequest = None,
        number_of_items: int = None,
        number_of_pages: int = None,
    ) -> RegisterTabSectionsDataResponse:
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )
        pagination_response = None
        if number_of_items is not None and number_of_pages is not None:
            pagination_response = G2PPaginationResponse(
                number_of_items=number_of_items,
                number_of_pages=number_of_pages
            )
        response_body = RegisterTabSectionsDataResponseBody(
            response_payload=register_tab_sections_list,
            pagination_response=pagination_response,
        )
        return RegisterTabSectionsDataResponse(response_header=g2p_response_header, response_body=response_body)

    def construct_register_section_metadata_success_response(
        self,
        register_section_data: G2PRegisterSectionData | RegisterSectionIdData | None,
        g2p_request: G2PRequest = None,
    ) -> RegisterSectionMetadataDataResponse:
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )
        response_body = RegisterSectionMetadataDataResponseBody(response_payload=register_section_data)
        return RegisterSectionMetadataDataResponse(response_header=g2p_response_header, response_body=response_body)

    def construct_register_section_metadata_list_success_response(
        self,
        register_sections_list: List[G2PRegisterSectionData],
        g2p_request: G2PRequest = None,
        number_of_items: int = None,
        number_of_pages: int = None,
    ) -> RegisterSectionMetadataListResponse:
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )
        pagination_response = None
        if number_of_items is not None and number_of_pages is not None:
            pagination_response = G2PPaginationResponse(
                number_of_items=number_of_items,
                number_of_pages=number_of_pages
            )
        response_body = RegisterSectionMetadataListResponseBody(
            response_payload=register_sections_list,
            pagination_response=pagination_response,
        )
        return RegisterSectionMetadataListResponse(response_header=g2p_response_header, response_body=response_body)

    def construct_register_section_metadata_ui_schema_success_response(
        self, register_section_ui_schema_data: RegisterSectionUISchemaData, g2p_request: G2PRequest = None
    ) -> RegisterSectionMetadataUISchemaDataResponse:
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )
        response_body = RegisterSectionMetadataUISchemaDataResponseBody(
            response_payload=register_section_ui_schema_data
        )
        return RegisterSectionMetadataUISchemaDataResponse(
            response_header=g2p_response_header,
            response_body=response_body,
        )

    def construct_section_records_success_response(
        self,
        section_records: List[RecordData],
        g2p_request: G2PRequest = None
    ) -> SectionRecordsDataResponse:
        """Construct success response for get_section_records endpoint."""
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: SectionRecordsDataResponseBody = SectionRecordsDataResponseBody(
            response_payload=section_records
        )

        section_records_response: SectionRecordsDataResponse = SectionRecordsDataResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return section_records_response

    def construct_register_tab_records_success_response(
        self,
        tab_records: List[RegisterTabRecordData],
        g2p_request: G2PRequest = None
    ) -> RegisterTabRecordsDataResponse:
        """Construct success response for get_register_tab_records endpoint."""
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=g2p_request.request_header.request_id if g2p_request else "",
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: RegisterTabRecordsDataResponseBody = RegisterTabRecordsDataResponseBody(
            response_payload=tab_records
        )

        tab_records_response: RegisterTabRecordsDataResponse = RegisterTabRecordsDataResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return tab_records_response

    def construct_documents_success_response(
        self,
        documents_data: DocumentsData,
        g2p_request: G2PRequest = None
    ) -> DocumentsResponse:
        """Construct success response for upload_documents / get_documents endpoints."""
        request_id = g2p_request.request_header.request_id if g2p_request else ""

        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: DocumentsResponseBody = DocumentsResponseBody(
            response_payload=documents_data
        )

        return DocumentsResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )

    def construct_delete_documents_success_response(
        self,
        delete_documents_data: DeleteDocumentsData,
        g2p_request: G2PRequest = None
    ) -> DeleteDocumentsResponse:
        """Construct success response for delete_documents endpoint."""
        request_id = g2p_request.request_header.request_id if g2p_request else ""

        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: DeleteDocumentsResponseBody = DeleteDocumentsResponseBody(
            response_payload=delete_documents_data
        )

        return DeleteDocumentsResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )

    def construct_registry_configuration_data_success_response(
        self,
        registry_configuration_data: RegistryConfigurationData,
        g2p_request: G2PRequest = None
    ) -> RegistryConfigurationDataResponse:
        """Construct success response for registry configuration endpoints."""
        request_id = g2p_request.request_header.request_id if g2p_request else ""

        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: RegistryConfigurationDataResponseBody = RegistryConfigurationDataResponseBody(
            response_payload=registry_configuration_data
        )

        response: RegistryConfigurationDataResponse = RegistryConfigurationDataResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return response

    def construct_registry_themes_success_response(
        self,
        themes: List[RegistryThemeData],
        g2p_request: G2PRequest = None
    ) -> RegistryThemesResponse:
        request_id = g2p_request.request_header.request_id if g2p_request else ""
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )
        response_body: RegistryThemesResponseBody = RegistryThemesResponseBody(response_payload=themes)
        return RegistryThemesResponse(response_header=g2p_response_header, response_body=response_body)

    def construct_theme_operation_success_response(
        self,
        operation_data: ThemeOperationData,
        g2p_request: G2PRequest = None
    ) -> ThemeOperationResponse:
        request_id = g2p_request.request_header.request_id if g2p_request else ""
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )
        response_body: ThemeOperationResponseBody = ThemeOperationResponseBody(response_payload=operation_data)
        return ThemeOperationResponse(response_header=g2p_response_header, response_body=response_body)

    def construct_registry_theme_values_success_response(
        self,
        theme_values: List[RegistryThemeValueData],
        g2p_request: G2PRequest = None
    ) -> RegistryThemeValuesResponse:
        request_id = g2p_request.request_header.request_id if g2p_request else ""
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )
        response_body: RegistryThemeValuesResponseBody = RegistryThemeValuesResponseBody(response_payload=theme_values)
        return RegistryThemeValuesResponse(response_header=g2p_response_header, response_body=response_body)

    def construct_registry_languages_success_response(
        self,
        languages: List[RegistryLanguageData],
        g2p_request: G2PRequest = None
    ) -> RegistryLanguagesResponse:
        request_id = g2p_request.request_header.request_id if g2p_request else ""
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )
        response_body: RegistryLanguagesResponseBody = RegistryLanguagesResponseBody(response_payload=languages)
        return RegistryLanguagesResponse(response_header=g2p_response_header, response_body=response_body)

    def construct_language_operation_success_response(
        self,
        operation_data: LanguageOperationData,
        g2p_request: G2PRequest = None
    ) -> LanguageOperationResponse:
        request_id = g2p_request.request_header.request_id if g2p_request else ""
        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )
        response_body: LanguageOperationResponseBody = LanguageOperationResponseBody(response_payload=operation_data)
        return LanguageOperationResponse(response_header=g2p_response_header, response_body=response_body)

    def construct_registry_language_success_response(
        self,
        language: RegistryLanguageData,
        g2p_request: G2PRequest = None
    ) -> RegistryLanguageResponse:
        request_id = g2p_request.request_header.request_id if g2p_request else ""
        g2p_response_header = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )
        response_body = RegistryLanguageResponseBody(response_payload=language)
        return RegistryLanguageResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )

    def construct_number_of_requests_pending_success_response(
        self,
        number_of_requests_pending_data: NumberOfRequestsPendingData,
        g2p_request: G2PRequest = None
    ) -> NumberOfRequestsPendingResponse:
        """Construct success response for get_number_of_requests_pending endpoint."""
        request_id = g2p_request.request_header.request_id if g2p_request else ""

        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: NumberOfRequestsPendingResponseBody = NumberOfRequestsPendingResponseBody(
            response_payload=number_of_requests_pending_data
        )

        response: NumberOfRequestsPendingResponse = NumberOfRequestsPendingResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return response

    def construct_earliest_pending_change_request_success_response(
        self,
        earliest_pending_change_request_data: EarliestPendingChangeRequestData,
        g2p_request: G2PRequest = None
    ) -> EarliestPendingChangeRequestResponse:
        """Construct success response for get_earliest_pending_change_request endpoint."""
        request_id = g2p_request.request_header.request_id if g2p_request else ""

        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: EarliestPendingChangeRequestResponseBody = EarliestPendingChangeRequestResponseBody(
            response_payload=earliest_pending_change_request_data
        )

        response: EarliestPendingChangeRequestResponse = EarliestPendingChangeRequestResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return response

    # =========================================================================
    # Document APIs Helper Methods
    # =========================================================================

    def construct_section_documents_success_response(
        self,
        section_documents_data: SectionDocumentsData,
        g2p_request: G2PRequest = None
    ) -> SectionDocumentsResponse:
        """Construct success response for get_section_documents endpoint."""
        request_id = g2p_request.request_header.request_id if g2p_request else ""

        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: SectionDocumentsResponseBody = SectionDocumentsResponseBody(
            response_payload=section_documents_data
        )

        response: SectionDocumentsResponse = SectionDocumentsResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return response

    def construct_change_request_documents_success_response(
        self,
        change_request_documents_data: ChangeRequestDocumentsData,
        g2p_request: G2PRequest = None
    ) -> ChangeRequestDocumentsResponse:
        """Construct success response for get_section_documents_for_change_request endpoint."""
        request_id = g2p_request.request_header.request_id if g2p_request else ""

        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: ChangeRequestDocumentsResponseBody = ChangeRequestDocumentsResponseBody(
            response_payload=change_request_documents_data
        )

        response: ChangeRequestDocumentsResponse = ChangeRequestDocumentsResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return response

    def construct_intake_form_documents_success_response(
        self,
        intake_form_documents_data: IntakeFormDocumentsData,
        g2p_request: G2PRequest = None
    ) -> IntakeFormDocumentsResponse:
        """Construct success response for get_intake_form_documents endpoint."""
        request_id = g2p_request.request_header.request_id if g2p_request else ""

        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: IntakeFormDocumentsResponseBody = IntakeFormDocumentsResponseBody(
            response_payload=intake_form_documents_data
        )

        return IntakeFormDocumentsResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )

    # =========================================================================
    # Allowed Parents For Child Section Helper Methods
    # =========================================================================

    def construct_allowed_parents_success_response(
        self,
        allowed_parents_data: AllowedParentsData,
        g2p_request: G2PRequest = None
    ) -> AllowedParentsDataResponse:
        """Construct success response for get_allowed_parents_for_a_child_section endpoint."""
        request_id = g2p_request.request_header.request_id if g2p_request else ""

        g2p_response_header: G2PResponseHeader = G2PResponseHeader(
            request_id=request_id,
            response_status=G2PResponseStatus.SUCCESS,
            response_error_code="",
            response_error_message="",
            response_timestamp=datetime.now()
        )

        response_body: AllowedParentsDataResponseBody = AllowedParentsDataResponseBody(
            response_payload=allowed_parents_data
        )

        response: AllowedParentsDataResponse = AllowedParentsDataResponse(
            response_header=g2p_response_header,
            response_body=response_body
        )
        return response
