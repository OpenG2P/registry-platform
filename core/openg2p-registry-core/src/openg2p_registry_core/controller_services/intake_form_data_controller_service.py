import logging
import math

from openg2p_fastapi_common.service import BaseService

from ..schemas import (
    ApproveRejectSubmissionRequest,
    DeleteIntakeFormSubmissionRequest,
    FinalizeSubmissionRequest,
    GetSubmissionRequest,
    GetIntakeFormTabRecordsRequest,
    GetDeduplicationIntakeFormRegisterResultsRequest,
    GetDeduplicationIntakeFormIntakeFormResultsRequest,
    DeduplicationIntakeFormRegisterResultData,
    DeduplicationIntakeFormIntakeFormResultData,
    GetIntakeAllowedParentsRequest,
    IntakeAllowedParentsData,
    RegisterAndInflightSearchResult,
    SearchInInflightIntakeRequest,
    SearchResultData,
    SaveIntakeFormSubmissionRequest,
    SearchInSubmissionRequest,
    SectionPayloadResponseItem,
    SubmissionResponsePayload,
    GetIntakeFormSubmissionsSummaryRequest,
    IntakeFormSubmissionsSummaryData,
    ValidateIntakeFormSubmissionData,
    ValidateIntakeFormSubmissionRequest,
)
from ..services import G2PIntakeFormDataService, G2PRegisterService

_logger = logging.getLogger("g2p-intake-form-data-controller-service")


class G2PIntakeFormDataControllerService(BaseService):
    async def save_intake_form_submission(
        self,
        request: SaveIntakeFormSubmissionRequest,
    ) -> SubmissionResponsePayload:
        payload = request.request_body.request_payload
        return await G2PIntakeFormDataService.get_component().save_intake_form_submission(
            submission_id=payload.submission_id,
            section_id=payload.section_id,
            section_payload=payload.section_payload,
            section_register_id=payload.section_register_id,
            form_id=payload.form_id,
            register_id=payload.register_id,
            created_by=payload.created_by or "Unknown",
            documents=payload.documents,
        )

    async def finalize_intake_form_submission(
        self,
        request: FinalizeSubmissionRequest,
        *,
        bearer_token: str | None = None,
        requester_sub: str | None = None,
    ) -> SubmissionResponsePayload:
        payload = request.request_body.request_payload
        return await G2PIntakeFormDataService.get_component().finalize_submission(
            payload.submission_id,
            bearer_token=bearer_token,
            requester_sub=requester_sub,
        )

    async def delete_intake_form_submission(
        self,
        request: DeleteIntakeFormSubmissionRequest,
    ) -> SubmissionResponsePayload:
        payload = request.request_body.request_payload
        return await G2PIntakeFormDataService.get_component().delete_submission(payload.submission_id)

    async def approve_intake_form_submission(
        self,
        request: ApproveRejectSubmissionRequest,
    ) -> SubmissionResponsePayload:
        payload = request.request_body.request_payload
        return await G2PIntakeFormDataService.get_component().approve_submission(
            payload.submission_id,
            payload.approved_by or "Unknown",
        )

    async def reject_intake_form_submission(
        self,
        request: ApproveRejectSubmissionRequest,
    ) -> SubmissionResponsePayload:
        payload = request.request_body.request_payload
        return await G2PIntakeFormDataService.get_component().reject_submission(
            payload.submission_id,
            payload.approved_by or "Unknown",
        )

    async def get_intake_form_submission(
        self,
        request: GetSubmissionRequest,
        data_policies: list[dict] | None = None,
    ) -> SubmissionResponsePayload:
        payload = request.request_body.request_payload
        return await G2PIntakeFormDataService.get_component().get_intake_form_submission(
            payload.submission_id,
            data_policies=data_policies,
        )

    async def get_tab_records(
        self,
        request: GetIntakeFormTabRecordsRequest,
        data_policies: list[dict] | None = None,
    ) -> list[SectionPayloadResponseItem]:
        payload = request.request_body.request_payload
        return await G2PIntakeFormDataService.get_component().get_tab_records(
            payload.submission_id,
            payload.tab_id,
            data_policies=data_policies,
        )

    async def search_in_intake_form_submissions(
        self,
        request: SearchInSubmissionRequest,
        data_policies: list[dict] | None = None,
    ):
        payload = request.request_body.request_payload
        pagination = request.request_body.pagination_request
        records, total_items = await G2PIntakeFormDataService.get_component().search_submissions(
            payload.register_id,
            pagination.search_text if pagination else None,
            pagination.current_page if pagination else 1,
            pagination.page_size if pagination else 10,
            pagination.sort_by if pagination else None,
            pagination.filter_by if pagination else None,
            data_policies=data_policies,
        )
        page_size = pagination.page_size if pagination else 10
        return records, total_items, math.ceil(total_items / page_size) if page_size else 0

    async def get_deduplication_intake_form_register_results(
        self,
        request: GetDeduplicationIntakeFormRegisterResultsRequest,
    ) -> list[DeduplicationIntakeFormRegisterResultData]:
        payload = request.request_body.request_payload
        return await G2PIntakeFormDataService.get_component().get_deduplication_intake_form_register_results(
            submission_id=payload.submission_id,
        )

    async def get_deduplication_intake_form_intake_form_results(
        self,
        request: GetDeduplicationIntakeFormIntakeFormResultsRequest,
    ) -> list[DeduplicationIntakeFormIntakeFormResultData]:
        payload = request.request_body.request_payload
        return await G2PIntakeFormDataService.get_component().get_deduplication_intake_form_intake_form_results(
            submission_id=payload.submission_id,
        )
    
    async def get_intake_allowed_parents(
        self,
        request: GetIntakeAllowedParentsRequest,
    ) -> IntakeAllowedParentsData:
        payload = request.request_body.request_payload
        return await G2PIntakeFormDataService.get_component().get_intake_allowed_parents(
            submission_id=payload.submission_id,
            section_register_id=payload.section_register_id,
            form_register_id=payload.form_register_id,
        )

    async def search_in_inflight_intake(
        self,
        request: SearchInInflightIntakeRequest,
    ) -> tuple[list[SearchResultData], int, int]:
        payload = request.request_body.request_payload
        pagination = request.request_body.pagination_request
        return await G2PIntakeFormDataService.get_component().search_in_inflight_intake(
            register_id=payload.register_id,
            search_text=pagination.search_text if pagination else None,
            current_page=pagination.current_page if pagination else 1,
            page_size=pagination.page_size if pagination else 10,
            internal_record_id=(payload.internal_record_id or "").strip() or None,
        )

    async def search_in_register_and_inflight_intake(
        self,
        request: SearchInInflightIntakeRequest,
        data_policies: list[dict] | None = None,
    ) -> tuple[list[RegisterAndInflightSearchResult], int, int]:
        payload = request.request_body.request_payload
        pagination = request.request_body.pagination_request
        register_id = payload.register_id
        record_id = (payload.internal_record_id or "").strip() or None
        search_text = pagination.search_text if pagination else None
        current_page = pagination.current_page if pagination else 1
        page_size = pagination.page_size if pagination else 10
        intake_service = G2PIntakeFormDataService.get_component()
        register_service = G2PRegisterService.get_component()

        if record_id:
            live_rows, live_total = await register_service.search_in_a_register(
                register_id,
                search_text,
                internal_record_id=record_id,
                data_policies=data_policies,
            )
            if live_total and live_rows:
                return [self._with_record_source(live_rows[0], "REGISTER")], 1, 1
            intake_rows, intake_total, _pages = await intake_service.search_in_inflight_intake(
                register_id,
                internal_record_id=record_id,
                page_size=1,
            )
            if intake_total and intake_rows:
                return [self._with_record_source(intake_rows[0], "INTAKE")], 1, 1
            return [], 0, 0

        filter_by = pagination.filter_by if pagination else None
        if filter_by == "":
            filter_by = None
        live_rows, live_total = await register_service.search_in_a_register(
            register_id,
            search_text or "",
            current_page,
            page_size,
            pagination.sort_by if pagination else None,
            filter_by,
            data_policies=data_policies,
        )
        intake_rows: list[SearchResultData] = []
        if current_page == 1:
            intake_rows, intake_total, _pages = await intake_service.search_in_inflight_intake(
                register_id,
                search_text=search_text,
                current_page=1,
                page_size=page_size,
            )
        else:
            _ignored, intake_total, _pages = await intake_service.search_in_inflight_intake(
                register_id,
                search_text=search_text,
                current_page=1,
                page_size=1,
            )
        live_ids = {row.internal_record_id for row in live_rows}
        intake_page = [
            row for row in intake_rows if row.internal_record_id not in live_ids
        ]
        merged = [
            self._with_record_source(row, "INTAKE") for row in intake_page
        ] + [
            self._with_record_source(row, "REGISTER") for row in live_rows
        ]
        number_of_items = live_total + intake_total
        number_of_pages = (
            math.ceil(live_total / page_size) if page_size and live_total else (1 if intake_total else 0)
        )
        return merged, number_of_items, number_of_pages

    @staticmethod
    def _with_record_source(row: SearchResultData, record_source: str) -> RegisterAndInflightSearchResult:
        data = row.model_dump() if hasattr(row, "model_dump") else row.dict()
        return RegisterAndInflightSearchResult(**data, record_source=record_source)

    async def get_intake_form_submissions_summary(
        self,
        get_intake_form_submissions_summary_request: GetIntakeFormSubmissionsSummaryRequest,
        data_policies: list[dict] | None = None,
    ) -> IntakeFormSubmissionsSummaryData:
        _ = get_intake_form_submissions_summary_request
        _logger.info("Getting intake form submissions summary through controller service")
        g2p_intake_form_data_service = G2PIntakeFormDataService.get_component()
        return await g2p_intake_form_data_service.get_intake_form_submissions_summary(
            data_policies=data_policies,
        )

    async def validate_intake_form_submission(
        self,
        request: ValidateIntakeFormSubmissionRequest,
    ) -> ValidateIntakeFormSubmissionData:
        payload = request.request_body.request_payload
        return await G2PIntakeFormDataService.get_component().validate_submission_for_approval(
            payload.submission_id
        )

