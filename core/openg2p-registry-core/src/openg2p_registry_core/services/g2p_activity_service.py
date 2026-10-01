"""The activity register write and read paths.

Writing an activity is one transaction:

1. resolve the register and activity type; return the existing activity if the
   idempotency key was seen before;
2. convert Ethiopian-calendar dates, let the domain enrich the payload, and
   validate it against the type's JSON Schema;
3. check references (codes, geo, local records, external IDs), and take the
   subject from a reference marked as the subject (with the record's
   ancestors, so parent records' profiles find the activity);
4. find or open the context, locking it so concurrent writes to one context
   are serialised;
5. check dates, period locks, repeatability, uniqueness and sequence;
6. insert the activity and its idempotency key, recompute the context's
   projection, and write an outbox row for asynchronous work.

Nothing is ever updated except status and verification columns (enforced by a
database trigger); corrections are new rows that supersede old ones.
"""

import logging
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Optional

from openg2p_fastapi_common.context import dbengine
from openg2p_fastapi_common.service import BaseService
from sqlalchemy import Date, DateTime, Float, Integer, Numeric, and_, func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker

from ..errors import G2PRegistryErrorCodes, G2PRegistryException
from ..helpers.ethiopian_calendar import EthiopianDateError, format_ethiopian_date, parse_ethiopian_date
from ..models import (
    ActivityContextStatusEnum,
    ActivityOutboxEventEnum,
    ActivityStatusEnum,
    ActivityVerificationStatusEnum,
    G2PActivity,
    G2PActivityAggregate,
    G2PActivityAggregateHistory,
    G2PActivityContext,
    G2PActivityEnrichment,
    G2PActivityIdempotencyKey,
    G2PActivityOutbox,
    G2PActivityParticipant,
    G2PActivityPeriodLock,
    G2PActivityTemporaryReference,
    G2PActivityTypeSchema,
    G2PRegisterDefinition,
    ReferenceKindEnum,
)
from ..repositories import ActivityPolicyRepository
from ..schemas.activity import (
    ActivityAggregateData,
    ActivityContextData,
    ActivityData,
    ActivityInput,
    ActivityTypeSchemaData,
    AppendActivityResult,
    ParticipantData,
    PeriodLockData,
    SubjectActivitiesData,
    TemporaryReferenceData,
    WorkItemData,
)
from .g2p_activity_geo_service import G2PActivityGeoService
from .g2p_activity_projection_service import G2PActivityProjectionService
from .g2p_activity_reference_service import G2PActivityReferenceService
from .g2p_activity_registry_service import ActivityRegister, G2PActivityRegistryService
from .g2p_activity_rule_service import G2PActivityRuleService, active_filter

_logger = logging.getLogger("g2p-activity-service")

_BASE_ACTIVITY_COLUMNS = set(G2PActivity.__annotations__.keys()) | {"activity_id", "occurred_at"}

CREATED = "CREATED"
DUPLICATE = "DUPLICATE"
FAILED = "FAILED"


def _error(code: G2PRegistryErrorCodes, message: str) -> G2PRegistryException:
    return G2PRegistryException(code=code.value[1], message=message)


def to_utc_naive(value: datetime) -> datetime:
    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


class G2PActivityService(BaseService):
    def __init__(self, name=""):
        super().__init__(name)
        self.registry = G2PActivityRegistryService.get_component() or G2PActivityRegistryService()
        self.references = G2PActivityReferenceService.get_component() or G2PActivityReferenceService()
        self.rules = G2PActivityRuleService.get_component() or G2PActivityRuleService()
        self.projections = G2PActivityProjectionService.get_component() or G2PActivityProjectionService()
        self.geo = G2PActivityGeoService.get_component() or G2PActivityGeoService()

    @staticmethod
    def _session_maker():
        return async_sessionmaker(dbengine.get(), expire_on_commit=False)

    @staticmethod
    def now() -> datetime:
        return datetime.utcnow()

    # ================================================================ writing

    async def append(
        self,
        activity: ActivityInput,
        actor: str,
        channel: str,
        partner_id: Optional[str] = None,
        seeding: bool = False,
    ) -> tuple[ActivityData, str]:
        """Append one activity. ``seeding`` (sample data only) lifts the backdating limit."""
        async with self._session_maker()() as session:
            try:
                async with session.begin():
                    register = await self.registry.get_register(session, activity.register_mnemonic)
                    row, outcome = await self._append(
                        session, register, activity, actor, channel, partner_id, seeding=seeding
                    )
            except IntegrityError:
                # Lost a race on the idempotency key: the other writer's row is the answer.
                if not activity.idempotency_key:
                    raise
                async with session.begin():
                    register = await self.registry.get_register(session, activity.register_mnemonic)
                    row = await self._find_by_idempotency_key(session, register, activity.idempotency_key)
                    outcome = DUPLICATE
            return await self.to_data(session, register, row), outcome

    async def append_many(
        self,
        activities: list[ActivityInput],
        actor: str,
        channel: str,
        atomic: bool = False,
        partner_id: Optional[str] = None,
        submission_id: Optional[str] = None,
    ) -> list[AppendActivityResult]:
        # One submission id for the batch, unless each activity already names its own.
        batch_id = submission_id or str(uuid.uuid4())
        activities = [
            a if a.submission_id else a.model_copy(update={"submission_id": batch_id}) for a in activities
        ]
        if atomic:
            async with self._session_maker()() as session:
                async with session.begin():
                    results = []
                    for index, activity in enumerate(activities):
                        register = await self.registry.get_register(session, activity.register_mnemonic)
                        row, outcome = await self._append(session, register, activity, actor, channel, partner_id)
                        results.append(
                            AppendActivityResult(
                                index=index, outcome=outcome, activity=await self.to_data(session, register, row)
                            )
                        )
                    return results

        results = []
        for index, activity in enumerate(activities):
            try:
                data, outcome = await self.append(activity, actor, channel, partner_id)
                results.append(AppendActivityResult(index=index, outcome=outcome, activity=data))
            except G2PRegistryException as error:
                results.append(
                    AppendActivityResult(index=index, outcome=FAILED, error_code=error.code, error_message=error.message)
                )
            except Exception as error:  # keep going; report the item
                _logger.exception("Append failed for item %s", index)
                results.append(
                    AppendActivityResult(
                        index=index,
                        outcome=FAILED,
                        error_code=G2PRegistryErrorCodes.UNEXPECTED_ERROR.value[1],
                        error_message=str(error),
                    )
                )
        return results

    async def _append(
        self,
        session,
        register: ActivityRegister,
        activity: ActivityInput,
        actor: str,
        channel: str,
        partner_id: Optional[str],
        superseding=None,
        seeding: bool = False,
    ):
        if activity.idempotency_key:
            existing = await self._find_by_idempotency_key(session, register, activity.idempotency_key)
            if existing is not None:
                return existing, DUPLICATE

        type_row = await self.registry.get_activity_type(session, register.register_id, activity.activity_type)
        domain = register.domain_service
        now = self.now()

        occurred_at = self._occurred_at(activity)
        payload = self._apply_participant_inputs(type_row, activity, dict(activity.payload or {}))
        payload = self._convert_ethiopian_dates(type_row, payload)
        payload = domain.enrich_payload(type_row.activity_type, payload) or payload
        self.rules.validate_payload(type_row.payload_schema, payload)
        payload, checks, warnings = await self.references.check_references(
            session, register.register_id, type_row, payload, domain
        )
        activity = await self._with_subject(session, type_row, activity, payload)
        ancestors = await self.references.ancestor_record_ids(
            session, activity.subject_register_mnemonic, activity.subject_internal_record_id
        )

        context = await self._resolve_context(session, register, type_row, activity, payload, actor)
        if not seeding:
            self.rules.check_dates(type_row, occurred_at, now)
        await self.rules.check_period_lock(session, register.register_id, type_row.activity_type, occurred_at)

        context_activities = []
        if context is not None:
            context_activities = await self.projections.current_activities(session, register, context.context_id)
            if superseding is not None:
                context_activities = [a for a in context_activities if a.activity_id != superseding.activity_id]
            warnings += self.rules.check_context_rules(type_row, payload, context_activities, occurred_at)
        warnings += domain.validate(type_row.activity_type, payload, context_activities) or []
        geo_dimensions = await self.geo.resolve(session, register, type_row, activity, payload, context)

        model = register.activity_model
        row = model(
            activity_id=str(uuid.uuid4()),
            occurred_at=occurred_at,
            activity_type=type_row.activity_type,
            context_id=context.context_id if context else None,
            subject_type=activity.subject_type or (context.subject_type if context else None),
            subject_id=activity.subject_id or (context.subject_id if context else None),
            subject_internal_record_id=activity.subject_internal_record_id,
            subject_register_mnemonic=activity.subject_register_mnemonic,
            subject_ancestor_record_ids=ancestors or None,
            recorded_at=now,
            recorded_by=actor,
            channel=channel,
            source_record_id=activity.source_record_id,
            source_partner_id=partner_id,
            idempotency_key=activity.idempotency_key,
            submission_id=activity.submission_id,
            schema_version=type_row.schema_version,
            supersedes_activity_id=superseding.activity_id if superseding is not None else None,
            status=ActivityStatusEnum.ACTIVE.value,
            verification_status=(
                ActivityVerificationStatusEnum.SUBMITTED.value
                if type_row.requires_verification
                else ActivityVerificationStatusEnum.NOT_REQUIRED.value
            ),
            payload=payload,
            geo_dimensions=geo_dimensions,
            reference_checks=checks or None,
            rule_warnings=warnings or None,
            **self._promoted_columns(model, payload),
        )
        row.search_text = " ".join(
            filter(None, [type_row.activity_type, row.subject_id, activity.source_record_id]
                   + [str(v) for v in domain.search_text_values(type_row.activity_type, payload) or []])
        ) or None
        session.add(row)
        if activity.idempotency_key:
            session.add(
                G2PActivityIdempotencyKey(
                    register_id=register.register_id,
                    idempotency_key=activity.idempotency_key,
                    activity_id=row.activity_id,
                )
            )
        await session.flush()
        await self._write_participants(session, register, type_row, row, payload)
        await self.projections.recompute(session, register, row.context_id)
        self._outbox(session, register, row, ActivityOutboxEventEnum.APPENDED.value)
        return row, CREATED

    async def supersede(self, register_mnemonic: str, activity_id: str, reason: str, actor: str, channel: str,
                        occurred_at: Optional[datetime] = None, occurred_on_ec: Optional[str] = None,
                        payload: Optional[dict] = None, idempotency_key: Optional[str] = None,
                        partner_id: Optional[str] = None, seeding: bool = False) -> ActivityData:
        self._require_reason(reason)
        async with self._session_maker()() as session:
            async with session.begin():
                register = await self.registry.get_register(session, register_mnemonic)
                old = await self._get_for_update(session, register, activity_id)
                self._require_state(old, ActivityStatusEnum.ACTIVE.value)
                await self.rules.check_period_lock(session, register.register_id, old.activity_type, old.occurred_at)
                replacement = ActivityInput(
                    register_mnemonic=register_mnemonic,
                    activity_type=old.activity_type,
                    occurred_at=occurred_at if (occurred_at or occurred_on_ec) else old.occurred_at,
                    occurred_on_ec=occurred_on_ec,
                    subject_type=old.subject_type,
                    subject_id=old.subject_id,
                    subject_internal_record_id=old.subject_internal_record_id,
                    subject_register_mnemonic=old.subject_register_mnemonic,
                    context_id=old.context_id,
                    payload=payload if payload is not None else dict(old.payload or {}),
                    source_record_id=old.source_record_id,
                    idempotency_key=idempotency_key,
                )
                new, _ = await self._append(
                    session, register, replacement, actor, channel, partner_id, superseding=old, seeding=seeding
                )
                old.status = ActivityStatusEnum.SUPERSEDED.value
                old.superseded_by_activity_id = new.activity_id
                old.status_reason = reason
                old.status_changed_by = actor
                old.status_changed_at = self.now()
                await session.flush()
                if old.context_id != new.context_id:
                    await self.projections.recompute(session, register, old.context_id)
                await self.projections.recompute(session, register, new.context_id)
                self._outbox(session, register, old, ActivityOutboxEventEnum.SUPERSEDED.value)
            return await self.to_data(session, register, new)

    async def void(self, register_mnemonic: str, activity_id: str, reason: str, actor: str) -> ActivityData:
        self._require_reason(reason)
        async with self._session_maker()() as session:
            async with session.begin():
                register = await self.registry.get_register(session, register_mnemonic)
                row = await self._get_for_update(session, register, activity_id)
                self._require_state(row, ActivityStatusEnum.ACTIVE.value)
                await self.rules.check_period_lock(session, register.register_id, row.activity_type, row.occurred_at)
                row.status = ActivityStatusEnum.VOIDED.value
                row.status_reason = reason
                row.status_changed_by = actor
                row.status_changed_at = self.now()
                await session.flush()
                await self.projections.recompute(session, register, row.context_id)
                self._outbox(session, register, row, ActivityOutboxEventEnum.VOIDED.value)
            return await self.to_data(session, register, row)

    async def verify(self, register_mnemonic: str, activity_id: str, actor: str,
                     remarks: Optional[str] = None, approve: bool = True) -> ActivityData:
        if not approve:
            self._require_reason(remarks)
        async with self._session_maker()() as session:
            async with session.begin():
                register = await self.registry.get_register(session, register_mnemonic)
                row = await self._get_for_update(session, register, activity_id)
                self._require_state(row, ActivityStatusEnum.ACTIVE.value)
                if row.verification_status != ActivityVerificationStatusEnum.SUBMITTED.value:
                    raise _error(
                        G2PRegistryErrorCodes.ACTIVITY_INVALID_STATE,
                        f"Activity is {row.verification_status}, not awaiting verification",
                    )
                row.verification_status = (
                    ActivityVerificationStatusEnum.VERIFIED.value if approve
                    else ActivityVerificationStatusEnum.REJECTED.value
                )
                row.verified_by = actor
                row.verified_at = self.now()
                row.verification_remarks = remarks
                await session.flush()
                await self.projections.recompute(session, register, row.context_id)
                self._outbox(
                    session, register, row,
                    ActivityOutboxEventEnum.VERIFIED.value if approve else ActivityOutboxEventEnum.REJECTED.value,
                )
            return await self.to_data(session, register, row)

    # ================================================================ reading

    async def get(self, register_mnemonic: str, activity_id: str, data_policies=None) -> ActivityData:
        async with self._session_maker()() as session:
            register = await self.registry.get_register(session, register_mnemonic)
            model = register.activity_model
            stmt = select(model).where(model.activity_id == activity_id)
            stmt = self._apply_policy(stmt, register, model, data_policies)
            row = (await session.execute(stmt)).scalar()
            if row is None:
                raise _error(G2PRegistryErrorCodes.ACTIVITY_NOT_FOUND, f"Activity {activity_id} not found")
            return await self.to_data(session, register, row)

    async def search(self, payload, pagination, data_policies=None) -> tuple[list[ActivityData], int]:
        async with self._session_maker()() as session:
            register = await self.registry.get_register(session, payload.register_mnemonic)
            model = register.activity_model
            conditions = []
            statuses = payload.statuses or [ActivityStatusEnum.ACTIVE.value]
            conditions.append(model.status.in_(statuses))
            if payload.activity_types:
                conditions.append(model.activity_type.in_(payload.activity_types))
            if payload.context_id:
                conditions.append(model.context_id == payload.context_id)
            if payload.subject_id:
                conditions.append(model.subject_id == payload.subject_id)
            if payload.verification_statuses:
                conditions.append(model.verification_status.in_(payload.verification_statuses))
            if payload.occurred_from:
                conditions.append(model.occurred_at >= to_utc_naive(payload.occurred_from))
            if payload.occurred_to:
                conditions.append(model.occurred_at <= to_utc_naive(payload.occurred_to))
            if payload.channel:
                conditions.append(model.channel == payload.channel)
            if payload.recorded_by:
                conditions.append(model.recorded_by == payload.recorded_by)
            if payload.participant_id:
                conditions.append(self._took_part(model, payload.participant_id, payload.participant_role))
            if pagination and pagination.search_text:
                conditions.append(model.search_text.ilike(f"%{pagination.search_text}%"))

            stmt = self._apply_policy(select(model).where(*conditions), register, model, data_policies)
            total = (await session.execute(select(func.count()).select_from(stmt.subquery()))).scalar() or 0
            stmt = stmt.order_by(*self._sort(model, pagination))
            if pagination:
                stmt = stmt.offset((pagination.current_page - 1) * pagination.page_size).limit(pagination.page_size)
            rows = list((await session.execute(stmt)).scalars())
            return [await self.to_data(session, register, row) for row in rows], total

    async def timeline(self, register_mnemonic: str, context_id: Optional[str], subject_id: Optional[str],
                       include_inactive: bool = True, data_policies=None) -> list[ActivityData]:
        async with self._session_maker()() as session:
            register = await self.registry.get_register(session, register_mnemonic)
            model = register.activity_model
            conditions = [model.context_id == context_id] if context_id else [model.subject_id == subject_id]
            if not include_inactive:
                conditions.append(model.status == ActivityStatusEnum.ACTIVE.value)
            stmt = self._apply_policy(select(model).where(*conditions), register, model, data_policies)
            rows = (await session.execute(stmt.order_by(model.occurred_at, model.recorded_at))).scalars()
            return [await self.to_data(session, register, row) for row in rows]

    # ================================================= subjects and defaults

    async def subject_activities(self, payload, data_policies=None) -> list[SubjectActivitiesData]:
        """Activities about a record of this registry, per activity register, newest first.

        With include_descendants, also those about its child records (a
        farmer's plots), found through the ancestors stamped on each activity.
        """
        record_id = payload.subject_internal_record_id
        statuses = payload.statuses or [ActivityStatusEnum.ACTIVE.value]
        result: list[SubjectActivitiesData] = []
        async with self._session_maker()() as session:
            definitions = await self.registry.list_registers(session)
            for definition in definitions:
                if payload.register_mnemonic and definition.register_mnemonic != payload.register_mnemonic:
                    continue
                try:
                    register = await self.registry.get_register(session, definition.register_mnemonic)
                except G2PRegistryException:
                    continue  # no classes for this register in the loaded extension
                model = register.activity_model
                about = or_(
                    model.subject_internal_record_id == record_id,
                    # ...or the record took part in another role (e.g. a cluster).
                    select(G2PActivityParticipant.participant_id)
                    .where(
                        G2PActivityParticipant.activity_id == model.activity_id,
                        G2PActivityParticipant.internal_record_id == record_id,
                    )
                    .exists(),
                )
                if payload.include_descendants:
                    about = or_(about, model.subject_ancestor_record_ids.contains([record_id]))
                stmt = select(model).where(about, model.status.in_(statuses))
                stmt = self._apply_policy(stmt, register, model, data_policies)
                rows = list(
                    (await session.execute(stmt.order_by(model.occurred_at.desc(), model.recorded_at.desc()))).scalars()
                )
                aggregates = await self._aggregates(session, [register.register_id], None, record_id, None, None)
                if not rows and not aggregates:
                    continue
                result.append(
                    SubjectActivitiesData(
                        register_mnemonic=register.mnemonic,
                        register_description=definition.register_description,
                        activities=[await self.to_data(session, register, row) for row in rows],
                        aggregates=aggregates,
                    )
                )
        return result

    async def latest_activity(self, payload, data_policies=None) -> Optional[ActivityData]:
        """The most recent current activity of a type for a context or subject — form defaults."""
        async with self._session_maker()() as session:
            register = await self.registry.get_register(session, payload.register_mnemonic)
            model = register.activity_model
            conditions = [model.activity_type == payload.activity_type, active_filter(model)]
            if payload.context_id:
                conditions.append(model.context_id == payload.context_id)
            elif payload.subject_internal_record_id:
                conditions.append(model.subject_internal_record_id == payload.subject_internal_record_id)
            elif payload.subject_id:
                conditions.append(model.subject_id == payload.subject_id)
            else:
                return None
            stmt = self._apply_policy(select(model).where(*conditions), register, model, data_policies)
            row = (
                await session.execute(stmt.order_by(model.occurred_at.desc(), model.recorded_at.desc()).limit(1))
            ).scalar()
            return await self.to_data(session, register, row) if row is not None else None

    async def activity_type_schemas(self, payload) -> list[ActivityTypeSchemaData]:
        """Every payload schema an activity type has had, newest first."""
        async with self._session_maker()() as session:
            register = await self.registry.get_register(session, payload.register_mnemonic)
            stmt = select(G2PActivityTypeSchema).where(
                G2PActivityTypeSchema.register_id == register.register_id,
                G2PActivityTypeSchema.activity_type == payload.activity_type,
            )
            if payload.schema_version is not None:
                stmt = stmt.where(G2PActivityTypeSchema.schema_version == payload.schema_version)
            rows = (await session.execute(stmt.order_by(G2PActivityTypeSchema.schema_version.desc()))).scalars()
            return [ActivityTypeSchemaData.model_validate(row, from_attributes=True) for row in rows]

    # ============================================================= aggregates

    async def search_aggregates(self, payload) -> list[ActivityAggregateData]:
        async with self._session_maker()() as session:
            register_ids = None
            if payload.register_mnemonic:
                register_ids = [(await self.registry.get_register(session, payload.register_mnemonic)).register_id]
            return await self._aggregates(
                session, register_ids, payload.subject_id, payload.subject_internal_record_id,
                payload.aggregate_type, payload.period_key,
            )

    async def aggregate_history(self, payload) -> list[ActivityAggregateData]:
        async with self._session_maker()() as session:
            register = await self.registry.get_register(session, payload.register_mnemonic)
            stmt = select(G2PActivityAggregateHistory).where(
                G2PActivityAggregateHistory.register_id == register.register_id,
                G2PActivityAggregateHistory.subject_id == payload.subject_id,
                G2PActivityAggregateHistory.aggregate_type == payload.aggregate_type,
            )
            if payload.period_key:
                stmt = stmt.where(G2PActivityAggregateHistory.period_key == payload.period_key)
            rows = (await session.execute(stmt.order_by(G2PActivityAggregateHistory.computed_at))).scalars()
            return [
                ActivityAggregateData.model_validate(row, from_attributes=True).model_copy(
                    update={"register_mnemonic": register.mnemonic}
                )
                for row in rows
            ]

    async def _aggregates(self, session, register_ids, subject_id, subject_internal_record_id, aggregate_type,
                          period_key) -> list[ActivityAggregateData]:
        if not subject_id and not subject_internal_record_id:
            return []
        stmt = select(G2PActivityAggregate, G2PRegisterDefinition.register_mnemonic).join(
            G2PRegisterDefinition, G2PRegisterDefinition.register_id == G2PActivityAggregate.register_id
        )
        if register_ids is not None:
            stmt = stmt.where(G2PActivityAggregate.register_id.in_(register_ids))
        if subject_internal_record_id:
            stmt = stmt.where(G2PActivityAggregate.subject_internal_record_id == subject_internal_record_id)
        if subject_id:
            stmt = stmt.where(G2PActivityAggregate.subject_id == subject_id)
        if aggregate_type:
            stmt = stmt.where(G2PActivityAggregate.aggregate_type == aggregate_type)
        if period_key:
            stmt = stmt.where(G2PActivityAggregate.period_key == period_key)
        stmt = stmt.order_by(G2PActivityAggregate.period_start.desc().nulls_last(), G2PActivityAggregate.aggregate_type)
        return [
            ActivityAggregateData.model_validate(row, from_attributes=True).model_copy(
                update={"register_mnemonic": mnemonic}
            )
            for row, mnemonic in (await session.execute(stmt)).all()
        ]

    # =============================================================== contexts

    async def search_contexts(self, payload, pagination) -> tuple[list[ActivityContextData], int]:
        async with self._session_maker()() as session:
            register = await self.registry.get_register(session, payload.register_mnemonic)
            conditions = [G2PActivityContext.register_id == register.register_id]
            if payload.context_id:
                conditions.append(G2PActivityContext.context_id == payload.context_id)
            if payload.status:
                conditions.append(G2PActivityContext.status == payload.status)
            if payload.subject_id:
                conditions.append(G2PActivityContext.subject_id == payload.subject_id)
            if payload.context_type:
                conditions.append(G2PActivityContext.context_type == payload.context_type)
            if pagination and pagination.search_text:
                conditions.append(G2PActivityContext.context_key.ilike(f"%{pagination.search_text}%"))
            stmt = select(G2PActivityContext).where(*conditions)
            total = (await session.execute(select(func.count()).select_from(stmt.subquery()))).scalar() or 0
            stmt = stmt.order_by(G2PActivityContext.opened_at.desc())
            if pagination:
                stmt = stmt.offset((pagination.current_page - 1) * pagination.page_size).limit(pagination.page_size)
            rows = (await session.execute(stmt)).scalars()
            return [ActivityContextData.model_validate(row, from_attributes=True) for row in rows], total

    async def open_context(self, payload, actor: str) -> ActivityContextData:
        async with self._session_maker()() as session:
            async with session.begin():
                register = await self.registry.get_register(session, payload.register_mnemonic)
                context = await self._get_or_create_context(
                    session, register, payload.context_key, payload.context_type,
                    payload.subject_type, payload.subject_id, payload.attributes, actor,
                )
            return ActivityContextData.model_validate(context, from_attributes=True)

    async def set_context_status(self, register_mnemonic: str, context_id: str, close: bool, actor: str,
                                 reason: Optional[str] = None) -> ActivityContextData:
        if close:
            self._require_reason(reason)
        async with self._session_maker()() as session:
            async with session.begin():
                register = await self.registry.get_register(session, register_mnemonic)
                context = await self._get_context(session, register, context_id, for_update=True)
                if close:
                    context.status = ActivityContextStatusEnum.CLOSED.value
                    context.closed_at = self.now()
                    context.closed_by = actor
                    context.close_reason = reason
                else:
                    context.status = ActivityContextStatusEnum.OPEN.value
                    context.closed_at = None
                    context.closed_by = None
                    context.close_reason = reason
                await session.flush()
                await self.projections.recompute(session, register, context_id)
            return ActivityContextData.model_validate(context, from_attributes=True)

    # ============================================================== work list

    async def work_list(self, payload, pagination, data_policies=None) -> tuple[list[WorkItemData], int]:
        """Activities that are due: the rule's after_type exists in an OPEN context and the type does not."""
        now = self.now()
        async with self._session_maker()() as session:
            register = await self.registry.get_register(session, payload.register_mnemonic)
            model = register.activity_model
            types = await self.registry.list_activity_types(session, register.register_id)
            items: list[WorkItemData] = []
            for type_row in types:
                rule = type_row.due_rule
                if not rule or not rule.get("after_type"):
                    continue
                if payload.activity_type and payload.activity_type != type_row.activity_type:
                    continue
                after = model.__table__.alias("after_activity")
                done = model.__table__.alias("done_activity")
                done_exists = (
                    select(done.c.activity_id)
                    .where(
                        done.c.context_id == after.c.context_id,
                        done.c.activity_type == type_row.activity_type,
                        done.c.status == ActivityStatusEnum.ACTIVE.value,
                        done.c.verification_status != ActivityVerificationStatusEnum.REJECTED.value,
                    )
                    .exists()
                )
                stmt = (
                    select(after, G2PActivityContext.context_key)
                    .join(G2PActivityContext, G2PActivityContext.context_id == after.c.context_id)
                    .where(
                        after.c.activity_type == rule["after_type"],
                        after.c.status == ActivityStatusEnum.ACTIVE.value,
                        after.c.verification_status != ActivityVerificationStatusEnum.REJECTED.value,
                        G2PActivityContext.status == ActivityContextStatusEnum.OPEN.value,
                        ~done_exists,
                    )
                )
                policy = self._policy_condition(register, model, data_policies, table=after)
                if policy is not None:
                    stmt = stmt.where(policy)
                for row in (await session.execute(stmt)).mappings():
                    window = self.rules.due_window(rule, row["occurred_at"])
                    status = self.rules.due_status(window[0], window[1], now)
                    if status == "NOT_YET_DUE" and payload.due_status is None:
                        continue
                    if payload.due_status and payload.due_status != status:
                        continue
                    items.append(
                        WorkItemData(
                            context_id=row["context_id"],
                            context_key=row["context_key"],
                            subject_id=row["subject_id"],
                            activity_type=type_row.activity_type,
                            after_activity_id=row["activity_id"],
                            after_activity_type=row["activity_type"],
                            after_occurred_at=row["occurred_at"],
                            due_from=window[0],
                            due_by=window[1],
                            due_status=status,
                        )
                    )
            items.sort(key=lambda item: (item.due_status != "OVERDUE", item.due_by or item.due_from))
            total = len(items)
            if pagination:
                start = (pagination.current_page - 1) * pagination.page_size
                items = items[start:start + pagination.page_size]
            return items, total

    # =========================================================== period locks

    async def lock_period(self, payload, actor: str) -> PeriodLockData:
        if payload.period_end < payload.period_start:
            raise _error(G2PRegistryErrorCodes.REQUEST_VALIDATION_ERROR, "period_end is before period_start")
        async with self._session_maker()() as session:
            async with session.begin():
                register = await self.registry.get_register(session, payload.register_mnemonic)
                lock = G2PActivityPeriodLock(
                    register_id=register.register_id,
                    activity_type=payload.activity_type,
                    period_start=payload.period_start,
                    period_end=payload.period_end,
                    reason=payload.reason,
                    locked_by=actor,
                    locked_at=self.now(),
                )
                session.add(lock)
                await session.flush()
            return PeriodLockData.model_validate(lock, from_attributes=True)

    async def unlock_period(self, register_mnemonic: str, lock_id: str, reason: str, actor: str) -> PeriodLockData:
        self._require_reason(reason)
        async with self._session_maker()() as session:
            async with session.begin():
                register = await self.registry.get_register(session, register_mnemonic)
                lock = await session.get(G2PActivityPeriodLock, lock_id)
                if lock is None or lock.register_id != register.register_id:
                    raise _error(G2PRegistryErrorCodes.REGISTER_DATA_NOT_FOUND, f"Period lock {lock_id} not found")
                lock.is_active = False
                lock.reopened_by = actor
                lock.reopened_at = self.now()
                lock.reopen_reason = reason
            return PeriodLockData.model_validate(lock, from_attributes=True)

    async def list_period_locks(self, register_mnemonic: str) -> list[PeriodLockData]:
        async with self._session_maker()() as session:
            register = await self.registry.get_register(session, register_mnemonic)
            rows = (
                await session.execute(
                    select(G2PActivityPeriodLock)
                    .where(G2PActivityPeriodLock.register_id == register.register_id)
                    .order_by(G2PActivityPeriodLock.period_start.desc())
                )
            ).scalars()
            return [PeriodLockData.model_validate(row, from_attributes=True) for row in rows]

    # ==================================================== temporary references

    async def list_temporary_references(self, register_mnemonic: str, unresolved_only: bool = True):
        async with self._session_maker()() as session:
            register = await self.registry.get_register(session, register_mnemonic)
            stmt = select(G2PActivityTemporaryReference).where(
                G2PActivityTemporaryReference.register_id == register.register_id
            )
            if unresolved_only:
                stmt = stmt.where(G2PActivityTemporaryReference.resolved_id.is_(None))
            rows = (await session.execute(stmt.order_by(G2PActivityTemporaryReference.first_seen_at))).scalars()
            return [TemporaryReferenceData.model_validate(row, from_attributes=True) for row in rows]

    async def resolve_temporary_reference(self, payload, actor: str) -> TemporaryReferenceData:
        """Record what an offline temporary ID turned out to be.

        Existing activities keep the temporary value they were written with
        (they are immutable); new activities using it get the resolved ID, and
        projections can map through this table.
        """
        async with self._session_maker()() as session:
            async with session.begin():
                register = await self.registry.get_register(session, payload.register_mnemonic)
                stmt = insert(G2PActivityTemporaryReference).values(
                    temporary_reference_id=str(uuid.uuid4()),
                    register_id=register.register_id,
                    reference_field=payload.reference_field,
                    temporary_id=payload.temporary_id,
                    resolved_id=payload.resolved_id,
                    first_seen_at=self.now(),
                    resolved_at=self.now(),
                    resolved_by=actor,
                )
                stmt = stmt.on_conflict_do_update(
                    constraint="uq_activity_temporary_reference",
                    set_={"resolved_id": payload.resolved_id, "resolved_at": self.now(), "resolved_by": actor},
                )
                await session.execute(stmt)
                row = (
                    await session.execute(
                        select(G2PActivityTemporaryReference).where(
                            G2PActivityTemporaryReference.register_id == register.register_id,
                            G2PActivityTemporaryReference.reference_field == payload.reference_field,
                            G2PActivityTemporaryReference.temporary_id == payload.temporary_id,
                        )
                    )
                ).scalar_one()
            return TemporaryReferenceData.model_validate(row, from_attributes=True)

    # ================================================================ helpers

    async def to_data(self, session, register: ActivityRegister, row) -> ActivityData:
        values = row.to_dict()
        columns = {key: value for key, value in values.items() if key not in _BASE_ACTIVITY_COLUMNS}
        display = {}
        try:
            type_row = await self.registry.get_activity_type(session, register.register_id, row.activity_type)
            display = await self.references.display_labels(session, type_row, row.payload or {}, register.domain_service)
        except G2PRegistryException:
            pass  # type deactivated since: still return the activity
        enrichment = await session.get(G2PActivityEnrichment, row.activity_id)
        participants = (
            await session.execute(
                select(G2PActivityParticipant)
                .where(G2PActivityParticipant.activity_id == row.activity_id)
                .order_by(G2PActivityParticipant.is_primary.desc(), G2PActivityParticipant.role)
            )
        ).scalars()
        base = {key: value for key, value in values.items() if key in _BASE_ACTIVITY_COLUMNS}
        return ActivityData(
            **base,
            register_mnemonic=register.mnemonic,
            occurred_on_ec=format_ethiopian_date(row.occurred_at.date()),
            columns={key: _jsonable(value) for key, value in columns.items()},
            display=display,
            enrichment=enrichment.enrichment if enrichment is not None else None,
            participants=[ParticipantData.model_validate(p, from_attributes=True) for p in participants],
        )

    # ============================================================ participants

    @staticmethod
    def _apply_participant_inputs(type_row, activity: ActivityInput, payload: dict) -> dict:
        """Participants given as (role, id) fill their role's payload field, unless the payload has it."""
        roles = type_row.participant_roles or {}
        for participant in activity.participants or []:
            config = roles.get(participant.role)
            if config is None:
                raise _error(
                    G2PRegistryErrorCodes.ACTIVITY_PAYLOAD_INVALID,
                    f"{type_row.activity_type} has no participant role '{participant.role}'",
                )
            field = config.get("field")
            if field and payload.get(field) in (None, ""):
                payload[field] = participant.id
        return payload

    def _participant_type(self, type_row, config: dict) -> tuple[str, Optional[str], Optional[str], dict]:
        """(kind, register, system, rule) for a role: from its field's reference rule, or the role's own."""
        rule = (type_row.reference_rules or {}).get(config.get("field")) or {}
        if config.get("register") or str(rule.get("kind") or "").upper() == ReferenceKindEnum.LOCAL_RECORD.value:
            register = config.get("register") or rule.get("register")
            return "LOCAL", register, None, {**rule, "register": register}
        return "EXTERNAL", None, config.get("system") or rule.get("system"), rule

    async def _write_participants(self, session, register, type_row, row, payload: dict) -> None:
        for role, config in (type_row.participant_roles or {}).items():
            value = payload.get(config.get("field"))
            if value in (None, "", []):
                continue
            kind, ref_register, ref_system, rule = self._participant_type(type_row, config)
            internal_record_id = None
            if kind == "LOCAL":
                record = await self.references._local_record(session, rule, str(value))
                internal_record_id = getattr(record, "internal_record_id", None)
            session.add(
                G2PActivityParticipant(
                    register_id=register.register_id,
                    activity_id=row.activity_id,
                    activity_type=row.activity_type,
                    role=role,
                    is_primary=bool(config.get("primary")),
                    ref_kind=kind,
                    ref_register=ref_register,
                    ref_system=ref_system,
                    ref_id=str(value),
                    internal_record_id=internal_record_id,
                    created_at=self.now(),
                )
            )
        await session.flush()

    @staticmethod
    def _took_part(model, participant_id: str, role: Optional[str] = None):
        stmt = select(G2PActivityParticipant.participant_id).where(
            G2PActivityParticipant.activity_id == model.activity_id,
            or_(
                G2PActivityParticipant.ref_id == participant_id,
                G2PActivityParticipant.internal_record_id == participant_id,
            ),
        )
        if role:
            stmt = stmt.where(G2PActivityParticipant.role == role)
        return stmt.exists()

    async def _with_subject(self, session, type_row, activity: ActivityInput, payload: dict) -> ActivityInput:
        """Take the subject from a reference rule marked ``"subject": true`` when the caller named none."""
        if activity.subject_internal_record_id:
            return activity
        subject = await self.references.subject_from_rules(session, type_row, payload)
        if subject is None:
            return activity
        return activity.model_copy(update=subject)

    def _occurred_at(self, activity: ActivityInput) -> datetime:
        if activity.occurred_on_ec:
            try:
                return datetime.combine(parse_ethiopian_date(activity.occurred_on_ec), datetime.min.time())
            except EthiopianDateError as error:
                raise _error(G2PRegistryErrorCodes.ACTIVITY_PAYLOAD_INVALID, str(error))
        return to_utc_naive(activity.occurred_at)

    @staticmethod
    def _convert_ethiopian_dates(type_row, payload: dict) -> dict:
        for field in type_row.ethiopian_date_fields or []:
            entered = payload.pop(f"{field}_ec", None)
            if entered and not payload.get(field):
                try:
                    payload[field] = parse_ethiopian_date(str(entered)).isoformat()
                except EthiopianDateError as error:
                    raise _error(G2PRegistryErrorCodes.ACTIVITY_PAYLOAD_INVALID, f"{field}_ec: {error}")
        return payload

    @staticmethod
    def _promoted_columns(model, payload: dict) -> dict:
        values = {}
        for column in model.__table__.columns:
            if column.name in _BASE_ACTIVITY_COLUMNS or column.name not in payload:
                continue
            value = payload[column.name]
            if value is None or value == "":
                continue
            try:
                if isinstance(column.type, DateTime) and isinstance(value, str):
                    value = to_utc_naive(datetime.fromisoformat(value.replace("Z", "+00:00")))
                elif isinstance(column.type, Date) and isinstance(value, str):
                    value = date.fromisoformat(value[:10])
                elif isinstance(column.type, (Numeric, Float)) and not isinstance(value, (list, dict)):
                    value = Decimal(str(value)) if isinstance(column.type, Numeric) else float(value)
                elif isinstance(column.type, Integer) and not isinstance(value, (list, dict)):
                    value = int(value)
            except (ValueError, ArithmeticError):
                raise _error(G2PRegistryErrorCodes.ACTIVITY_PAYLOAD_INVALID, f"{column.name}: invalid value {value!r}")
            values[column.name] = value
        return values

    async def _resolve_context(self, session, register, type_row, activity: ActivityInput, payload, actor):
        if activity.context_id:
            context = await self._get_context(session, register, activity.context_id, for_update=True)
        elif activity.context_key:
            context = await self._get_or_create_context(
                session, register, activity.context_key, None, activity.subject_type, activity.subject_id, None, actor
            )
        else:
            spec = register.domain_service.build_context(
                type_row.activity_type, activity.subject_type, activity.subject_id, payload
            )
            context = None
            if spec and spec.get("context_key"):
                context = await self._get_or_create_context(
                    session, register, spec["context_key"], spec.get("context_type"),
                    spec.get("subject_type", activity.subject_type), spec.get("subject_id", activity.subject_id),
                    spec.get("attributes"), actor,
                )
                if spec.get("replaces_context_id"):
                    await self._replace_context(session, register, context, spec["replaces_context_id"], actor)
        if context is None:
            if type_row.requires_context:
                raise _error(
                    G2PRegistryErrorCodes.ACTIVITY_CONTEXT_REQUIRED,
                    f"{type_row.activity_type} must belong to a context; none was given or derivable",
                )
            return None
        if context.status == ActivityContextStatusEnum.CLOSED.value:
            raise _error(G2PRegistryErrorCodes.ACTIVITY_CONTEXT_CLOSED, f"Context {context.context_key} is closed")
        return context

    async def _replace_context(self, session, register, context, replaced_id: str, actor: str) -> None:
        """Link a new context to the one it replaces (e.g. the crop was changed), and close the old one."""
        if replaced_id == context.context_id or context.replaces_context_id == replaced_id:
            return
        old = await self._get_context(session, register, replaced_id, for_update=True)
        if old.replaced_by_context_id and old.replaced_by_context_id != context.context_id:
            raise _error(
                G2PRegistryErrorCodes.ACTIVITY_INVALID_STATE,
                f"Context {old.context_key} was already replaced by {old.replaced_by_context_id}",
            )
        context.replaces_context_id = old.context_id
        old.replaced_by_context_id = context.context_id
        if old.status != ActivityContextStatusEnum.CLOSED.value:
            old.status = ActivityContextStatusEnum.CLOSED.value
            old.closed_at = self.now()
            old.closed_by = actor
            old.close_reason = f"Replaced by {context.context_key}"
        await session.flush()
        await self.projections.recompute(session, register, old.context_id)

    async def _get_context(self, session, register, context_id: str, for_update: bool = False):
        stmt = select(G2PActivityContext).where(
            G2PActivityContext.context_id == context_id,
            G2PActivityContext.register_id == register.register_id,
        )
        if for_update:
            stmt = stmt.with_for_update()
        context = (await session.execute(stmt)).scalar()
        if context is None:
            raise _error(G2PRegistryErrorCodes.ACTIVITY_CONTEXT_NOT_FOUND, f"Context {context_id} not found")
        return context

    async def _get_or_create_context(self, session, register, context_key, context_type, subject_type,
                                     subject_id, attributes, actor):
        await session.execute(
            insert(G2PActivityContext)
            .values(
                context_id=str(uuid.uuid4()),
                register_id=register.register_id,
                context_key=context_key,
                context_type=context_type,
                subject_type=subject_type,
                subject_id=subject_id,
                attributes=attributes,
                status=ActivityContextStatusEnum.OPEN.value,
                opened_at=self.now(),
                opened_by=actor,
            )
            .on_conflict_do_nothing(constraint="uq_activity_context_key")
        )
        # Lock the context row: writes to one context are serialised, which is
        # what makes the repeatability/uniqueness checks race-free.
        return (
            await session.execute(
                select(G2PActivityContext)
                .where(
                    G2PActivityContext.register_id == register.register_id,
                    G2PActivityContext.context_key == context_key,
                )
                .with_for_update()
                .execution_options(populate_existing=True)
            )
        ).scalar_one()

    async def _find_by_idempotency_key(self, session, register, key: str):
        found = (
            await session.execute(
                select(G2PActivityIdempotencyKey.activity_id).where(
                    G2PActivityIdempotencyKey.register_id == register.register_id,
                    G2PActivityIdempotencyKey.idempotency_key == key,
                )
            )
        ).scalar()
        if found is None:
            return None
        model = register.activity_model
        return (await session.execute(select(model).where(model.activity_id == found))).scalar()

    async def _get_for_update(self, session, register, activity_id: str):
        model = register.activity_model
        row = (
            await session.execute(select(model).where(model.activity_id == activity_id).with_for_update())
        ).scalar()
        if row is None:
            raise _error(G2PRegistryErrorCodes.ACTIVITY_NOT_FOUND, f"Activity {activity_id} not found")
        if row.context_id:
            # Lock the context too, so correcting and appending in one context never interleave.
            await self._get_context(session, register, row.context_id, for_update=True)
        return row

    @staticmethod
    def _require_state(row, status: str) -> None:
        if row.status != status:
            raise _error(G2PRegistryErrorCodes.ACTIVITY_INVALID_STATE, f"Activity is {row.status}")

    @staticmethod
    def _require_reason(reason: Optional[str]) -> None:
        if not reason or not reason.strip():
            raise _error(G2PRegistryErrorCodes.ACTIVITY_REASON_REQUIRED, "A reason is required")

    def _outbox(self, session, register, row, event_type: str) -> None:
        session.add(
            G2PActivityOutbox(
                register_id=register.register_id,
                activity_id=row.activity_id,
                context_id=row.context_id,
                event_type=event_type,
                created_at=self.now(),
            )
        )

    @staticmethod
    def _policy_condition(register, model, data_policies, table=None):
        if not data_policies:
            return None
        from iam_core.helpers.data_policy_helper import DataPolicyHelper

        expression = DataPolicyHelper.resolve_register_record_policy(data_policies, register.register_id)
        if not expression:
            return None
        if table is None:
            return ActivityPolicyRepository(model).build_policy_condition(expression)

        class _Aliased:  # policy conditions against an aliased table
            pass

        for column in table.c:
            setattr(_Aliased, column.name, column)
        _Aliased.__name__ = model.__name__
        return ActivityPolicyRepository(_Aliased).build_policy_condition(expression)

    def _apply_policy(self, stmt, register, model, data_policies):
        condition = self._policy_condition(register, model, data_policies)
        return stmt.where(condition) if condition is not None else stmt

    @staticmethod
    def _sort(model, pagination):
        sort_by = pagination.sort_by if pagination else None
        if sort_by:
            descending = sort_by.startswith("-")
            column = getattr(model, sort_by.lstrip("-"), None)
            if column is not None:
                return [column.desc() if descending else column.asc(), model.activity_id]
        return [model.occurred_at.desc(), model.recorded_at.desc()]


def _jsonable(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value
