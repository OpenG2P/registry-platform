"""Request and response schemas for activity registers."""

from datetime import date, datetime
from typing import Any, Optional

from openg2p_fastapi_common.schemas import G2PRequest, G2PRequestBody, G2PResponse, G2PResponseBody
from pydantic import BaseModel, Field, model_validator

# =============================================================================
# Payloads
# =============================================================================


class ParticipantInput(BaseModel):
    """A participant given by role and ID; its type comes from the activity type's configuration."""

    role: str
    id: str


class ParticipantData(BaseModel):
    role: str
    is_primary: bool = False
    ref_kind: str
    ref_register: Optional[str] = None
    ref_system: Optional[str] = None
    ref_id: str
    internal_record_id: Optional[str] = None


class ActivityInput(BaseModel):
    """One activity to append.

    ``occurred_at`` is the Gregorian date-time the activity happened. Instead of
    it, ``occurred_on_ec`` may carry the date in the Ethiopian calendar
    ("YYYY-MM-DD"); it is converted on write. The context is either named
    (``context_id`` / ``context_key``) or derived by the register's domain
    service from the subject and payload.
    """

    register_mnemonic: str
    activity_type: str
    occurred_at: Optional[datetime] = None
    occurred_on_ec: Optional[str] = None
    subject_type: Optional[str] = None
    subject_id: Optional[str] = None
    subject_internal_record_id: Optional[str] = None
    # The register the subject record is in, when subject_internal_record_id is set.
    subject_register_mnemonic: Optional[str] = None
    context_id: Optional[str] = None
    context_key: Optional[str] = None
    payload: dict[str, Any] = Field(default_factory=dict)
    source_record_id: Optional[str] = None
    idempotency_key: Optional[str] = None
    # Groups the activities of one submission (an offline sync, a file). A batch
    # append without one gets a new id for the whole batch.
    submission_id: Optional[str] = None
    # Participants by role (e.g. {"role": "plot", "id": "LAND-0007-1"}). Each fills
    # its role's payload field when the payload does not already carry it.
    participants: Optional[list[ParticipantInput]] = None

    @model_validator(mode="after")
    def _occurred(self):
        if self.occurred_at is None and not self.occurred_on_ec:
            raise ValueError("occurred_at or occurred_on_ec is required")
        return self


class AppendActivityPayload(ActivityInput):
    pass


class AppendActivitiesPayload(BaseModel):
    activities: list[ActivityInput]
    # true → all or nothing; false → each activity succeeds or fails on its own.
    atomic: bool = False
    submission_id: Optional[str] = None


class SupersedeActivityPayload(BaseModel):
    register_mnemonic: str
    activity_id: str
    reason: str
    occurred_at: Optional[datetime] = None
    occurred_on_ec: Optional[str] = None
    payload: Optional[dict[str, Any]] = None
    idempotency_key: Optional[str] = None


class ActivityStatusChangePayload(BaseModel):
    register_mnemonic: str
    activity_id: str
    reason: Optional[str] = None


class SearchActivitiesPayload(BaseModel):
    register_mnemonic: str
    activity_types: Optional[list[str]] = None
    context_id: Optional[str] = None
    subject_id: Optional[str] = None
    statuses: Optional[list[str]] = None  # default: ACTIVE
    verification_statuses: Optional[list[str]] = None
    occurred_from: Optional[datetime] = None
    occurred_to: Optional[datetime] = None
    channel: Optional[str] = None
    recorded_by: Optional[str] = None
    # Activities a participant took part in, in a role (any role when omitted).
    participant_id: Optional[str] = None
    participant_role: Optional[str] = None


class GetActivityPayload(BaseModel):
    register_mnemonic: str
    activity_id: str


class ActivityTimelinePayload(BaseModel):
    register_mnemonic: str
    context_id: Optional[str] = None
    subject_id: Optional[str] = None
    include_inactive: bool = True

    @model_validator(mode="after")
    def _target(self):
        if not (self.context_id or self.subject_id):
            raise ValueError("context_id or subject_id is required")
        return self


class RegisterMnemonicPayload(BaseModel):
    register_mnemonic: str


class SearchContextsPayload(BaseModel):
    register_mnemonic: str
    context_id: Optional[str] = None
    status: Optional[str] = None
    subject_id: Optional[str] = None
    context_type: Optional[str] = None


class OpenContextPayload(BaseModel):
    register_mnemonic: str
    context_key: str
    context_type: Optional[str] = None
    subject_type: Optional[str] = None
    subject_id: Optional[str] = None
    attributes: Optional[dict[str, Any]] = None


class ContextStatusChangePayload(BaseModel):
    register_mnemonic: str
    context_id: str
    reason: Optional[str] = None


class WorkListPayload(BaseModel):
    register_mnemonic: str
    activity_type: Optional[str] = None
    due_status: Optional[str] = None  # DUE | OVERDUE


class GetProjectionPayload(BaseModel):
    register_mnemonic: str
    context_id: str


class SearchProjectionsPayload(BaseModel):
    register_mnemonic: str
    # Equality filters on projection columns; a list means IN.
    filters: Optional[dict[str, Any]] = None


class ComputeIndicatorPayload(BaseModel):
    register_mnemonic: str
    indicator_code: str
    filters: Optional[dict[str, Any]] = None


class LockPeriodPayload(BaseModel):
    register_mnemonic: str
    period_start: date
    period_end: date
    activity_type: Optional[str] = None
    reason: Optional[str] = None


class UnlockPeriodPayload(BaseModel):
    register_mnemonic: str
    lock_id: str
    reason: str


class ResolveTemporaryReferencePayload(BaseModel):
    register_mnemonic: str
    reference_field: str
    temporary_id: str
    resolved_id: str


class SubjectActivitiesPayload(BaseModel):
    """Activities about one record of this registry, across every activity register.

    Finds activities whose subject is the record, and (with include_descendants)
    those whose subject is one of its child records — a farmer's plots.
    """

    subject_internal_record_id: str
    register_mnemonic: Optional[str] = None  # one activity register only
    include_descendants: bool = True
    statuses: Optional[list[str]] = None  # default: ACTIVE


class LatestActivityPayload(BaseModel):
    """The most recent current activity of a type, for form defaults."""

    register_mnemonic: str
    activity_type: str
    context_id: Optional[str] = None
    subject_id: Optional[str] = None
    subject_internal_record_id: Optional[str] = None


class SearchAggregatesPayload(BaseModel):
    register_mnemonic: Optional[str] = None
    subject_id: Optional[str] = None
    subject_internal_record_id: Optional[str] = None
    aggregate_type: Optional[str] = None
    period_key: Optional[str] = None


class AggregateHistoryPayload(BaseModel):
    register_mnemonic: str
    subject_id: str
    aggregate_type: str
    period_key: Optional[str] = None


class ActivityTypeSchemaPayload(BaseModel):
    register_mnemonic: str
    activity_type: str
    schema_version: Optional[int] = None  # default: every version


class RebuildProjectionsPayload(BaseModel):
    register_mnemonic: str
    context_id: Optional[str] = None


# =============================================================================
# Data returned
# =============================================================================


class ActivityRegisterData(BaseModel):
    register_id: str
    register_mnemonic: str
    register_subject: Optional[str] = None  # short display name, e.g. "Crop seasons"
    register_description: Optional[str] = None
    master_register_id: Optional[str] = None
    register_icon: Optional[str] = None
    has_projection: bool = False


class ActivityTypeData(BaseModel):
    activity_type_id: str
    register_id: str
    activity_type: str
    display_name: str
    description: Optional[str] = None
    display_order: Optional[int] = None
    payload_schema: Optional[dict] = None
    section_ui_schema: Optional[dict] = None
    requires_context: bool = True
    is_repeatable: bool = True
    uniqueness_fields: Optional[list] = None
    requires_prior_types: Optional[list] = None
    sequence_enforcement: str = "WARN"
    due_rule: Optional[dict] = None
    max_backdate_days: Optional[int] = None
    allow_future_dated: bool = False
    requires_verification: bool = False
    reference_rules: Optional[dict] = None
    ethiopian_date_fields: Optional[list] = None
    schema_version: int = 1
    participant_roles: Optional[dict] = None
    # Code-list options for ATTRIBUTE-referenced fields: {field: [{"code", "label"}]}
    reference_options: dict[str, list[dict[str, str]]] = Field(default_factory=dict)


class ActivityData(BaseModel):
    activity_id: str
    register_mnemonic: Optional[str] = None
    activity_type: str
    occurred_at: datetime
    occurred_on_ec: Optional[str] = None
    context_id: Optional[str] = None
    subject_type: Optional[str] = None
    subject_id: Optional[str] = None
    subject_internal_record_id: Optional[str] = None
    subject_register_mnemonic: Optional[str] = None
    subject_ancestor_record_ids: Optional[list] = None
    recorded_at: datetime
    recorded_by: str
    channel: str
    source_record_id: Optional[str] = None
    source_partner_id: Optional[str] = None
    idempotency_key: Optional[str] = None
    submission_id: Optional[str] = None
    schema_version: Optional[int] = None
    supersedes_activity_id: Optional[str] = None
    superseded_by_activity_id: Optional[str] = None
    status: str
    status_reason: Optional[str] = None
    status_changed_by: Optional[str] = None
    status_changed_at: Optional[datetime] = None
    verification_status: str
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    verification_remarks: Optional[str] = None
    payload: dict[str, Any] = Field(default_factory=dict)
    columns: dict[str, Any] = Field(default_factory=dict)  # promoted typed columns
    reference_checks: Optional[dict] = None
    rule_warnings: Optional[list] = None
    display: dict[str, Any] = Field(default_factory=dict)  # resolved reference labels
    geo_dimensions: Optional[dict] = None  # where it happened, as named Master Data levels
    enrichment: Optional[dict] = None  # derived or external data, added asynchronously
    participants: list[ParticipantData] = Field(default_factory=list)


class AppendActivityResult(BaseModel):
    index: int
    outcome: str  # CREATED | DUPLICATE | FAILED
    activity: Optional[ActivityData] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None


class ActivityContextData(BaseModel):
    context_id: str
    register_id: str
    context_key: str
    context_type: Optional[str] = None
    subject_type: Optional[str] = None
    subject_id: Optional[str] = None
    attributes: Optional[dict] = None
    status: str
    opened_at: datetime
    opened_by: Optional[str] = None
    closed_at: Optional[datetime] = None
    closed_by: Optional[str] = None
    close_reason: Optional[str] = None
    replaces_context_id: Optional[str] = None
    replaced_by_context_id: Optional[str] = None


class WorkItemData(BaseModel):
    context_id: str
    context_key: Optional[str] = None
    subject_id: Optional[str] = None
    activity_type: str
    after_activity_id: str
    after_activity_type: str
    after_occurred_at: datetime
    due_from: datetime
    due_by: Optional[datetime] = None
    due_status: str  # DUE | OVERDUE | NOT_YET_DUE


class IndicatorData(BaseModel):
    indicator_id: str
    indicator_code: str
    display_name: str
    description: Optional[str] = None
    unit: Optional[str] = None
    definition: dict
    display_order: Optional[int] = None


class IndicatorResultData(BaseModel):
    indicator_code: str
    display_name: str
    unit: Optional[str] = None
    group_by: list[str] = Field(default_factory=list)
    rows: list[dict[str, Any]] = Field(default_factory=list)


class PeriodLockData(BaseModel):
    lock_id: str
    register_id: str
    activity_type: Optional[str] = None
    period_start: date
    period_end: date
    reason: Optional[str] = None
    is_active: bool
    locked_by: str
    locked_at: datetime
    reopened_by: Optional[str] = None
    reopened_at: Optional[datetime] = None
    reopen_reason: Optional[str] = None


class ActivityAggregateData(BaseModel):
    aggregate_id: str
    register_id: str
    register_mnemonic: Optional[str] = None
    subject_type: str
    subject_id: str
    subject_internal_record_id: Optional[str] = None
    subject_register_mnemonic: Optional[str] = None
    aggregate_type: str
    period_key: str
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    aggregate_value: dict
    geo_dimensions: Optional[dict] = None
    custom_dimensions: Optional[dict] = None
    computed_at: datetime
    source_activity_id: Optional[str] = None


class SubjectActivitiesData(BaseModel):
    """One activity register's activities (and summaries) about a record."""

    register_mnemonic: str
    register_description: Optional[str] = None
    activities: list[ActivityData] = Field(default_factory=list)
    aggregates: list[ActivityAggregateData] = Field(default_factory=list)


class ActivityTypeSchemaData(BaseModel):
    activity_type: str
    schema_version: int
    payload_schema: Optional[dict] = None
    created_at: datetime


class TemporaryReferenceData(BaseModel):
    temporary_reference_id: str
    register_id: str
    reference_field: str
    temporary_id: str
    resolved_id: Optional[str] = None
    first_seen_at: datetime
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None


# =============================================================================
# Request / response envelopes
# =============================================================================


def _envelope(payload_cls, name: str):
    body = type(f"{name}RequestBody", (G2PRequestBody,), {"__annotations__": {"request_payload": payload_cls}})
    request = type(f"{name}Request", (G2PRequest,), {"__annotations__": {"request_body": body}})
    return body, request


AppendActivityRequestBody, AppendActivityRequest = _envelope(AppendActivityPayload, "AppendActivity")
AppendActivitiesRequestBody, AppendActivitiesRequest = _envelope(AppendActivitiesPayload, "AppendActivities")
SupersedeActivityRequestBody, SupersedeActivityRequest = _envelope(SupersedeActivityPayload, "SupersedeActivity")
ActivityStatusChangeRequestBody, ActivityStatusChangeRequest = _envelope(
    ActivityStatusChangePayload, "ActivityStatusChange"
)
SearchActivitiesRequestBody, SearchActivitiesRequest = _envelope(SearchActivitiesPayload, "SearchActivities")
GetActivityRequestBody, GetActivityRequest = _envelope(GetActivityPayload, "GetActivity")
ActivityTimelineRequestBody, ActivityTimelineRequest = _envelope(ActivityTimelinePayload, "ActivityTimeline")
RegisterMnemonicRequestBody, RegisterMnemonicRequest = _envelope(RegisterMnemonicPayload, "RegisterMnemonic")
SearchContextsRequestBody, SearchContextsRequest = _envelope(SearchContextsPayload, "SearchContexts")
OpenContextRequestBody, OpenContextRequest = _envelope(OpenContextPayload, "OpenContext")
ContextStatusChangeRequestBody, ContextStatusChangeRequest = _envelope(
    ContextStatusChangePayload, "ContextStatusChange"
)
WorkListRequestBody, WorkListRequest = _envelope(WorkListPayload, "WorkList")
GetProjectionRequestBody, GetProjectionRequest = _envelope(GetProjectionPayload, "GetProjection")
SearchProjectionsRequestBody, SearchProjectionsRequest = _envelope(SearchProjectionsPayload, "SearchProjections")
ComputeIndicatorRequestBody, ComputeIndicatorRequest = _envelope(ComputeIndicatorPayload, "ComputeIndicator")
LockPeriodRequestBody, LockPeriodRequest = _envelope(LockPeriodPayload, "LockPeriod")
UnlockPeriodRequestBody, UnlockPeriodRequest = _envelope(UnlockPeriodPayload, "UnlockPeriod")
ResolveTemporaryReferenceRequestBody, ResolveTemporaryReferenceRequest = _envelope(
    ResolveTemporaryReferencePayload, "ResolveTemporaryReference"
)
RebuildProjectionsRequestBody, RebuildProjectionsRequest = _envelope(
    RebuildProjectionsPayload, "RebuildProjections"
)
SubjectActivitiesRequestBody, SubjectActivitiesRequest = _envelope(SubjectActivitiesPayload, "SubjectActivities")
LatestActivityRequestBody, LatestActivityRequest = _envelope(LatestActivityPayload, "LatestActivity")
SearchAggregatesRequestBody, SearchAggregatesRequest = _envelope(SearchAggregatesPayload, "SearchAggregates")
AggregateHistoryRequestBody, AggregateHistoryRequest = _envelope(AggregateHistoryPayload, "AggregateHistory")
ActivityTypeSchemaRequestBody, ActivityTypeSchemaRequest = _envelope(ActivityTypeSchemaPayload, "ActivityTypeSchema")


class ActivityResponseBody(G2PResponseBody):
    response_payload: Optional[Any] = None


class ActivityResponse(G2PResponse):
    response_body: ActivityResponseBody
