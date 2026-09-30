"""Activity register models.

An activity register records things that happened — a sowing, a harvest, an
attendance — as append-only rows. Nothing is edited in place: a correction is a
new row that supersedes the old one, and a withdrawal voids it. The only
columns that ever change after insert are the status and verification columns,
and a database trigger (see ``G2PActivityPartitionService``) enforces that.

A concrete activity register is a ``g2p_register_definitions`` row with
``register_purpose = ACTIVITY``. Its extension declares:

* ``G2PActivity<Mnemonic>(G2PActivity, ...)`` — the activity table, with any
  promoted typed columns next to the JSONB ``payload``;
* ``G2PActivityProjection<Mnemonic>(G2PActivityProjection, ...)`` — the
  current-state table, one row per activity context (optional).

Activity types, contexts, period locks, idempotency keys, the outbox,
temporary references and indicators are core tables shared by every activity
register in the instance. So are the asynchronous layer's tables: enrichments
(derived or external data kept beside an activity, never inside it) and
aggregates (roll-ups per subject and period, with their history).
"""

import uuid
from datetime import datetime

from openg2p_fastapi_common.models import BaseORMModel
from sqlalchemy import Boolean, Date, DateTime, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .enum import (
    ActivityChannelEnum,
    ActivityContextStatusEnum,
    ActivityStatusEnum,
    ActivityVerificationStatusEnum,
    ProcessStatusEnum,
)


def _utcnow() -> datetime:
    return datetime.utcnow()


class G2PActivity(BaseORMModel):
    """Base for every activity table.

    Tables are range-partitioned by ``occurred_at`` — set up by
    ``G2PActivityPartitionService.ensure_activity_table``, which must be used
    instead of ``create_migrate`` — so the primary key carries the partition
    key. ``activity_id`` alone is still globally unique: it is a UUID, and the
    idempotency table below guarantees one row per submission.
    """

    __abstract__ = True

    activity_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    occurred_at: Mapped[datetime] = mapped_column(DateTime, primary_key=True)

    activity_type: Mapped[str] = mapped_column(String, nullable=False, index=True)
    context_id: Mapped[str] = mapped_column(String, nullable=True, index=True)

    # Who or what the activity is about. subject_type names the identifier
    # scheme (e.g. FARMER_ID, FAYDA_FAN, LOCAL_RECORD); subject_internal_record_id
    # is set only when the subject is a record in a register of this instance,
    # with subject_register_mnemonic naming that register. The record's
    # ancestors (e.g. the farmer owning a plot) are kept as they were when the
    # activity was written, so a farmer's profile finds its plots' activities.
    subject_type: Mapped[str] = mapped_column(String, nullable=True)
    subject_id: Mapped[str] = mapped_column(String, nullable=True, index=True)
    subject_internal_record_id: Mapped[str] = mapped_column(String, nullable=True, index=True)
    subject_register_mnemonic: Mapped[str] = mapped_column(String, nullable=True)
    subject_ancestor_record_ids: Mapped[list] = mapped_column(JSONB, nullable=True)

    recorded_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)
    recorded_by: Mapped[str] = mapped_column(String, nullable=False)
    channel: Mapped[ActivityChannelEnum] = mapped_column(String, nullable=False)
    source_record_id: Mapped[str] = mapped_column(String, nullable=True, index=True)
    source_partner_id: Mapped[str] = mapped_column(String, nullable=True)
    idempotency_key: Mapped[str] = mapped_column(String, nullable=True, index=True)
    # One id per submission batch (an offline sync, a file, a partner call).
    submission_id: Mapped[str] = mapped_column(String, nullable=True, index=True)
    # The activity type's schema_version when this activity was written, so a
    # payload is always read against the schema it was validated with.
    schema_version: Mapped[int] = mapped_column(Integer, nullable=True)

    supersedes_activity_id: Mapped[str] = mapped_column(String, nullable=True, index=True)
    superseded_by_activity_id: Mapped[str] = mapped_column(String, nullable=True)
    status: Mapped[ActivityStatusEnum] = mapped_column(
        String, nullable=False, default=ActivityStatusEnum.ACTIVE.value, index=True
    )
    status_reason: Mapped[str] = mapped_column(Text, nullable=True)
    status_changed_by: Mapped[str] = mapped_column(String, nullable=True)
    status_changed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    verification_status: Mapped[ActivityVerificationStatusEnum] = mapped_column(
        String, nullable=False, default=ActivityVerificationStatusEnum.NOT_REQUIRED.value, index=True
    )
    verified_by: Mapped[str] = mapped_column(String, nullable=True)
    verified_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    verification_remarks: Mapped[str] = mapped_column(Text, nullable=True)

    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    # Where the activity happened, as named administrative levels from Master
    # Data, snapshotted when it is written: {"region": {"code": "ET04", "name":
    # "Oromia"}, "zone": {...}, "woreda": {...}}. Taken from the payload's
    # location, else from the subject record (same registry), else from the
    # activity's context. Roll-ups by geography group on these levels.
    geo_dimensions: Mapped[dict] = mapped_column(JSONB, nullable=True)
    # Result of reference resolution at write time: which references were
    # checked, how, and any warnings (lenient mode). Display names are not
    # stored here; they are resolved when read.
    reference_checks: Mapped[dict] = mapped_column(JSONB, nullable=True)
    rule_warnings: Mapped[list] = mapped_column(JSONB, nullable=True)

    search_text: Mapped[str] = mapped_column(Text, nullable=True)

    def to_dict(self) -> dict:
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}

    def get_search_text_fields(self) -> list[str]:
        return [self.activity_type or "", self.subject_id or "", self.source_record_id or ""]


class G2PActivityType(BaseORMModel):
    """One kind of activity within an activity register (e.g. SOWN, HARVESTED)."""

    __tablename__ = "g2p_activity_types"
    __table_args__ = (UniqueConstraint("register_id", "activity_type", name="uq_activity_type_per_register"),)

    activity_type_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    register_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    activity_type: Mapped[str] = mapped_column(String, nullable=False)
    display_name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # JSON Schema (draft 2020-12) the payload must satisfy.
    payload_schema: Mapped[dict] = mapped_column(JSONB, nullable=True)
    # Incremented by a database trigger whenever payload_schema changes (by a
    # seed, an API or by hand); each version is kept in g2p_activity_type_schemas.
    schema_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    # Form layout for the staff UI, same shape as g2p_register_sections.section_ui_schema.
    section_ui_schema: Mapped[dict] = mapped_column(JSONB, nullable=True)

    # Rules
    requires_context: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_repeatable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Payload fields that, with the context, must be unique among ACTIVE rows
    # of this type (e.g. ["crop"] → one SOWN per plot × season × crop).
    uniqueness_fields: Mapped[list] = mapped_column(JSONB, nullable=True)
    # Activity types that must already exist (ACTIVE) in the context.
    requires_prior_types: Mapped[list] = mapped_column(JSONB, nullable=True)
    # "BLOCK" rejects an out-of-order activity, "WARN" records a rule warning.
    sequence_enforcement: Mapped[str] = mapped_column(String, nullable=False, default="WARN")
    # When this type falls due: {"after_type": "SOWN", "min_days": 90, "max_days": 150}.
    due_rule: Mapped[dict] = mapped_column(JSONB, nullable=True)
    max_backdate_days: Mapped[int] = mapped_column(Integer, nullable=True)
    allow_future_dated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    requires_verification: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Reference rules per payload field:
    # {"crop": {"kind": "ATTRIBUTE", "attribute": "CROP_COMMODITY", "mode": "STRICT"},
    #  "plot_id": {"kind": "EXTERNAL", "system": "farmer-registry.land", "mode": "LENIENT", "pattern": "^LND-"}}
    reference_rules: Mapped[dict] = mapped_column(JSONB, nullable=True)
    # Payload date fields entered in the Ethiopian calendar, converted on write.
    ethiopian_date_fields: Mapped[list] = mapped_column(JSONB, nullable=True)


class G2PActivityContext(BaseORMModel):
    """A grouping of activities, e.g. one plot in one season, or one training session."""

    __tablename__ = "g2p_activity_contexts"
    __table_args__ = (UniqueConstraint("register_id", "context_key", name="uq_activity_context_key"),)

    context_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    register_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    context_key: Mapped[str] = mapped_column(String, nullable=False)
    context_type: Mapped[str] = mapped_column(String, nullable=True)
    subject_type: Mapped[str] = mapped_column(String, nullable=True)
    subject_id: Mapped[str] = mapped_column(String, nullable=True, index=True)
    attributes: Mapped[dict] = mapped_column(JSONB, nullable=True)
    status: Mapped[ActivityContextStatusEnum] = mapped_column(
        String, nullable=False, default=ActivityContextStatusEnum.OPEN.value, index=True
    )
    opened_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)
    opened_by: Mapped[str] = mapped_column(String, nullable=True)
    closed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    closed_by: Mapped[str] = mapped_column(String, nullable=True)
    close_reason: Mapped[str] = mapped_column(Text, nullable=True)


class G2PActivityPeriodLock(BaseORMModel):
    """A closed period: no activity with occurred_at inside it may be written or corrected."""

    __tablename__ = "g2p_activity_period_locks"

    lock_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    register_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    activity_type: Mapped[str] = mapped_column(String, nullable=True)  # null → all types
    period_start: Mapped[datetime] = mapped_column(Date, nullable=False)
    period_end: Mapped[datetime] = mapped_column(Date, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    locked_by: Mapped[str] = mapped_column(String, nullable=False)
    locked_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)
    reopened_by: Mapped[str] = mapped_column(String, nullable=True)
    reopened_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    reopen_reason: Mapped[str] = mapped_column(Text, nullable=True)


class G2PActivityIdempotencyKey(BaseORMModel):
    """Global uniqueness of idempotency keys (the partitioned activity table cannot enforce it)."""

    __tablename__ = "g2p_activity_idempotency_keys"

    register_id: Mapped[str] = mapped_column(String, primary_key=True)
    idempotency_key: Mapped[str] = mapped_column(String, primary_key=True)
    activity_id: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)


class G2PActivityOutbox(BaseORMModel):
    """Work written in the same transaction as the activity, processed asynchronously."""

    __tablename__ = "g2p_activity_outbox"

    outbox_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    register_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    activity_id: Mapped[str] = mapped_column(String, nullable=False)
    context_id: Mapped[str] = mapped_column(String, nullable=True)
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[ProcessStatusEnum] = mapped_column(
        String, nullable=False, default=ProcessStatusEnum.PENDING.value, index=True
    )
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_error: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow, index=True)
    processed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)


class G2PActivityTemporaryReference(BaseORMModel):
    """Temporary identifiers created offline (e.g. a new plot) and what they resolved to."""

    __tablename__ = "g2p_activity_temporary_references"
    __table_args__ = (
        UniqueConstraint("register_id", "reference_field", "temporary_id", name="uq_activity_temporary_reference"),
    )

    temporary_reference_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    register_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    reference_field: Mapped[str] = mapped_column(String, nullable=False)
    temporary_id: Mapped[str] = mapped_column(String, nullable=False)
    resolved_id: Mapped[str] = mapped_column(String, nullable=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)
    resolved_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    resolved_by: Mapped[str] = mapped_column(String, nullable=True)


class G2PActivityIndicator(BaseORMModel):
    """A configured measure over a projection table (no SQL in configuration).

    ``definition`` = {"measure": {"fn": "sum", "field": "area_sown_ha"},
                      "group_by": ["season", "woreda"],
                      "filters": {"stage": ["SOWN", "HARVESTED"]}}
    """

    __tablename__ = "g2p_activity_indicators"
    __table_args__ = (UniqueConstraint("register_id", "indicator_code", name="uq_activity_indicator_code"),)

    indicator_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    register_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    indicator_code: Mapped[str] = mapped_column(String, nullable=False)
    display_name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    unit: Mapped[str] = mapped_column(String, nullable=True)
    definition: Mapped[dict] = mapped_column(JSONB, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class G2PActivityProjection(BaseORMModel):
    """Base for current-state tables: one row per activity context."""

    __abstract__ = True

    context_id: Mapped[str] = mapped_column(String, primary_key=True)
    context_key: Mapped[str] = mapped_column(String, nullable=True, index=True)
    subject_type: Mapped[str] = mapped_column(String, nullable=True)
    subject_id: Mapped[str] = mapped_column(String, nullable=True, index=True)
    context_status: Mapped[str] = mapped_column(String, nullable=True)
    activity_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_activity_id: Mapped[str] = mapped_column(String, nullable=True)
    last_activity_type: Mapped[str] = mapped_column(String, nullable=True)
    last_occurred_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    last_recorded_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    projected_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)
    # Geo copied from the context/latest activity so data policies can filter projections.
    geo_code_hierarchy_json: Mapped[dict] = mapped_column(JSONB, nullable=True)
    # The context's location as named levels (see G2PActivity.geo_dimensions),
    # from its latest activity that has one. Indicators group by "geo:<level>".
    geo_dimensions: Mapped[dict] = mapped_column(JSONB, nullable=True)

    def to_dict(self) -> dict:
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


class G2PActivityOdkForm(BaseORMModel):
    """An ODK Central form whose submissions are pulled into an activity register.

    ``mapping`` says where each activity field comes from in a submission.
    Paths use "/" between groups (as ODK's JSON does); a value may be a literal
    via {"value": ...}, or a path with a transform via {"path": ..., "transform": ...}:

        {"activity_type": {"value": "SOWN"},
         "subject_type": {"value": "FARMER_ID"},
         "subject_id": "farmer/farmer_id",
         "occurred_on_ec": {"path": "sowing/sowing_date_ec"},
         "payload": {"plot_id": "plot/plot_id", "crop": "sowing/crop",
                     "area_ha": {"path": "sowing/area", "transform": "number"},
                     "latitude": {"path": "plot/location", "transform": "geopoint_lat"},
                     "longitude": {"path": "plot/location", "transform": "geopoint_lon"},
                     "photo_document_id": {"path": "sowing/photo", "transform": "attachment"}}}
    """

    __tablename__ = "g2p_activity_odk_forms"
    __table_args__ = (UniqueConstraint("odk_project_id", "odk_form_id", name="uq_activity_odk_form"),)

    odk_form_config_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    register_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    odk_project_id: Mapped[int] = mapped_column(Integer, nullable=False)
    odk_form_id: Mapped[str] = mapped_column(String, nullable=False)
    mapping: Mapped[dict] = mapped_column(JSONB, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Cursor: submissions with a later __system/submissionDate are pulled next.
    last_submission_date: Mapped[str] = mapped_column(String, nullable=True)
    last_pulled_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    last_error: Mapped[str] = mapped_column(Text, nullable=True)
    submissions_pulled: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    submissions_failed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class G2PActivityOdkFailure(BaseORMModel):
    """A submission that could not be turned into an activity (kept for review and retry)."""

    __tablename__ = "g2p_activity_odk_failures"
    __table_args__ = (UniqueConstraint("odk_form_config_id", "instance_id", name="uq_activity_odk_failure"),)

    failure_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    odk_form_config_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    instance_id: Mapped[str] = mapped_column(String, nullable=False)
    submission: Mapped[dict] = mapped_column(JSONB, nullable=True)
    error_code: Mapped[str] = mapped_column(String, nullable=True)
    error_message: Mapped[str] = mapped_column(Text, nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    first_failed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)
    last_failed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)
    resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)


class G2PActivityTypeSchema(BaseORMModel):
    """Every payload schema an activity type has had, by version (written by a trigger)."""

    __tablename__ = "g2p_activity_type_schemas"

    activity_type_id: Mapped[str] = mapped_column(String, primary_key=True)
    schema_version: Mapped[int] = mapped_column(Integer, primary_key=True)
    register_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    activity_type: Mapped[str] = mapped_column(String, nullable=False)
    payload_schema: Mapped[dict] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)


class G2PActivityEnrichment(BaseORMModel):
    """Derived or external data for one activity (e.g. rainfall at the plot), written asynchronously.

    Kept beside the activity rather than in it: the activity row is append-only
    and its payload is exactly what was submitted.
    """

    __tablename__ = "g2p_activity_enrichments"

    activity_id: Mapped[str] = mapped_column(String, primary_key=True)
    register_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    enrichment: Mapped[dict] = mapped_column(JSONB, nullable=False)
    enriched_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)


class _G2PActivityAggregateBase(BaseORMModel):
    __abstract__ = True

    register_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    # The subject the roll-up is about, which need not be an activity's own
    # subject (e.g. a farmer's season summary across all of the farmer's plots).
    subject_type: Mapped[str] = mapped_column(String, nullable=False)
    subject_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    subject_internal_record_id: Mapped[str] = mapped_column(String, nullable=True, index=True)
    subject_register_mnemonic: Mapped[str] = mapped_column(String, nullable=True)
    aggregate_type: Mapped[str] = mapped_column(String, nullable=False, index=True)
    # A label the domain chooses (e.g. "2019|SEASON_MEHER"), with a sortable date range.
    period_key: Mapped[str] = mapped_column(String, nullable=False)
    period_start: Mapped[datetime] = mapped_column(Date, nullable=True, index=True)
    period_end: Mapped[datetime] = mapped_column(Date, nullable=True)
    aggregate_value: Mapped[dict] = mapped_column(JSONB, nullable=False)
    geo_dimensions: Mapped[dict] = mapped_column(JSONB, nullable=True)
    custom_dimensions: Mapped[dict] = mapped_column(JSONB, nullable=True)
    computed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)
    # The activity event that caused this computation.
    source_activity_id: Mapped[str] = mapped_column(String, nullable=True)


class G2PActivityAggregate(_G2PActivityAggregateBase):
    """The latest value of a roll-up, one row per register × subject × aggregate type × period."""

    __tablename__ = "g2p_activity_aggregates"
    __table_args__ = (
        UniqueConstraint(
            "register_id", "subject_type", "subject_id", "aggregate_type", "period_key",
            name="uq_activity_aggregate",
        ),
    )

    aggregate_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))


class G2PActivityAggregateHistory(_G2PActivityAggregateBase):
    """Every value a roll-up has had, appended on each computation."""

    __tablename__ = "g2p_activity_aggregate_history"
    __table_args__ = (Index("ix_activity_aggregate_history_key", "subject_id", "aggregate_type", "period_key"),)

    history_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    aggregate_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
