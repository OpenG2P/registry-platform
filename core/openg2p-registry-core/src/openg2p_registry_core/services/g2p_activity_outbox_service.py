"""Asynchronous work after an activity is written, and projection reconciliation.

The outbox row is committed in the same transaction as the activity, so no
event is ever lost. A worker claims pending rows with SKIP LOCKED (several
workers can run) and, for each event:

1. publishes to outgest topics;
2. enrichment — stores the register's ``enrich`` result beside the activity
   (APPENDED events);
3. aggregates — stores each roll-up the register's ``aggregate`` returns,
   replacing the current value for its subject, type and period, and appends
   it to the aggregate history;
4. runs the register's ``on_activity_event`` hook, if any;

and marks the row processed — in one transaction, so a crash means the row is
simply picked up again. Every step is idempotent.
"""

import logging
import uuid
from datetime import datetime

from openg2p_fastapi_common.context import dbengine
from openg2p_fastapi_common.service import BaseService
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import async_sessionmaker

from ..config import Settings
from ..errors import G2PRegistryException
from ..models import (
    ActivityOutboxEventEnum,
    G2PActivityAggregate,
    G2PActivityAggregateHistory,
    G2PActivityEnrichment,
    G2PActivityOutbox,
    G2PRegisterDefinition,
    OutgoingRawData,
    OutgoingRawDataPayload,
    OutgoingTopic,
    ProcessStatusEnum,
)
from .g2p_activity_projection_service import G2PActivityProjectionService
from .g2p_activity_registry_service import G2PActivityRegistryService
from .g2p_activity_rule_service import active_filter

_config = Settings.get_config(strict=False)
_logger = logging.getLogger("g2p-activity-outbox-service")


class G2PActivityOutboxService(BaseService):
    def __init__(self, name=""):
        super().__init__(name)
        self.registry = G2PActivityRegistryService.get_component() or G2PActivityRegistryService()
        self.projections = G2PActivityProjectionService.get_component() or G2PActivityProjectionService()

    @staticmethod
    def _session_maker():
        return async_sessionmaker(dbengine.get(), expire_on_commit=False)

    async def process_batch(self, batch_size: int | None = None) -> int:
        """Process up to batch_size outbox rows. Returns the number processed successfully."""
        batch_size = batch_size or int(_config.activity_outbox_batch_size)
        max_attempts = int(_config.activity_outbox_max_attempts)
        async with self._session_maker()() as session:
            async with session.begin():
                rows = list(
                    (
                        await session.execute(
                            select(G2PActivityOutbox)
                            .where(
                                or_(
                                    G2PActivityOutbox.status == ProcessStatusEnum.PENDING.value,
                                    and_(
                                        G2PActivityOutbox.status == ProcessStatusEnum.FAILED.value,
                                        G2PActivityOutbox.attempts < max_attempts,
                                    ),
                                )
                            )
                            .order_by(G2PActivityOutbox.created_at)
                            .limit(batch_size)
                            .with_for_update(skip_locked=True)
                        )
                    ).scalars()
                )
                done = 0
                for row in rows:
                    try:
                        async with session.begin_nested():
                            await self._process(session, row)
                        row.status = ProcessStatusEnum.PROCESSED.value
                        row.processed_at = datetime.utcnow()
                        row.last_error = None
                        done += 1
                    except Exception as error:
                        _logger.exception("Outbox %s failed", row.outbox_id)
                        row.status = ProcessStatusEnum.FAILED.value
                        row.last_error = str(error)[:2000]
                    row.attempts += 1
                # Periods locked while these events were pending can now be final.
                if done:
                    await self._finalise_periods(session, {row.register_id for row in rows})
        return done

    async def _finalise_periods(self, session, register_ids: set) -> None:
        from .g2p_activity_period_service import G2PActivityPeriodService

        periods = G2PActivityPeriodService.get_component() or G2PActivityPeriodService()
        await session.flush()
        for definition in await self.registry.list_registers(session):
            if definition.register_id not in register_ids:
                continue
            try:
                register = await self.registry.get_register(session, definition.register_mnemonic)
            except G2PRegistryException:
                continue
            async with session.begin_nested():
                await periods.finalise(session, register)

    async def _process(self, session, outbox: G2PActivityOutbox) -> None:
        definition = await session.get(G2PRegisterDefinition, outbox.register_id)
        if definition is None:
            return
        register = await self.registry.get_register(session, definition.register_mnemonic)
        model = register.activity_model
        activity = (await session.execute(select(model).where(model.activity_id == outbox.activity_id))).scalar()
        if activity is None:
            return
        if definition.outgest_applicable:
            await self._outgest(session, definition, activity, outbox)
        domain = register.domain_service
        if outbox.event_type == ActivityOutboxEventEnum.APPENDED.value:
            enrichment = await domain.enrich(session, register, activity)
            if enrichment:
                await self._store_enrichment(session, register, activity, enrichment)
        for result in await domain.aggregate(session, register, activity, outbox.event_type) or []:
            await self._store_aggregate(session, register, activity, result, event_at=outbox.created_at)
        hook = getattr(domain, "on_activity_event", None)
        if hook is not None:
            await hook(session, outbox.event_type, activity)

    @staticmethod
    async def _store_enrichment(session, register, activity, enrichment: dict) -> None:
        stmt = insert(G2PActivityEnrichment).values(
            activity_id=activity.activity_id,
            register_id=register.register_id,
            enrichment=enrichment,
            enriched_at=datetime.utcnow(),
        )
        await session.execute(
            stmt.on_conflict_do_update(
                index_elements=["activity_id"],
                set_={"enrichment": stmt.excluded.enrichment, "enriched_at": stmt.excluded.enriched_at},
            )
        )

    @staticmethod
    async def _store_aggregate(session, register, activity, result, event_at=None) -> None:
        now = datetime.utcnow()
        values = {
            "register_id": register.register_id,
            "subject_type": result.subject_type,
            "subject_id": result.subject_id,
            "subject_internal_record_id": result.subject_internal_record_id,
            "subject_register_mnemonic": result.subject_register_mnemonic,
            "aggregate_type": result.aggregate_type,
            "period_key": result.period_key,
            "period_start": result.period_start,
            "period_end": result.period_end,
            "aggregate_value": _json_ready(result.aggregate_value),
            # Platform-owned, as in the Observations design: the activity's named
            # levels unless the domain chose the roll-up's own.
            "geo_dimensions": _json_ready(
                result.geo_dimensions
                if result.geo_dimensions is not None
                else getattr(activity, "geo_dimensions", None)
            ),
            "custom_dimensions": _json_ready(result.custom_dimensions),
            "computed_at": now,
            "source_activity_id": activity.activity_id,
            "value_changed_at": event_at or now,
        }
        stmt = insert(G2PActivityAggregate).values(aggregate_id=str(uuid.uuid4()), **values)
        # A final figure that is recomputed to a different value is no longer
        # final (an activity outside the locked window still fed it).
        unchanged = G2PActivityAggregate.__table__.c.aggregate_value == stmt.excluded.aggregate_value
        stmt = stmt.on_conflict_do_update(
            constraint="uq_activity_aggregate",
            set_={
                **{key: stmt.excluded[key] for key in values if key not in (
                    "register_id", "subject_type", "subject_id", "aggregate_type", "period_key", "value_changed_at")},
                "value_changed_at": case(
                    (unchanged, G2PActivityAggregate.__table__.c.value_changed_at), else_=stmt.excluded.value_changed_at
                ),
                "is_final": and_(G2PActivityAggregate.__table__.c.is_final, unchanged),
                "finalised_at": case((unchanged, G2PActivityAggregate.__table__.c.finalised_at), else_=None),
                "finalised_by": case((unchanged, G2PActivityAggregate.__table__.c.finalised_by), else_=None),
            },
        ).returning(G2PActivityAggregate.aggregate_id)
        aggregate_id = (await session.execute(stmt)).scalar_one()
        await session.execute(
            insert(G2PActivityAggregateHistory).values(
                history_id=str(uuid.uuid4()), aggregate_id=aggregate_id, **values
            )
        )

    async def _outgest(self, session, definition, activity, outbox) -> None:
        topics = (
            await session.execute(
                select(OutgoingTopic).where(
                    OutgoingTopic.register_id == definition.register_id, OutgoingTopic.is_active.is_(True)
                )
            )
        ).scalars().all()
        if not topics:
            return
        payload_id = f"activity:{activity.activity_id}:{outbox.event_type}"
        document = {key: _jsonable(value) for key, value in activity.to_dict().items() if key != "search_text"}
        document["event_type"] = outbox.event_type
        document["register_mnemonic"] = definition.register_mnemonic
        await session.execute(
            insert(OutgoingRawDataPayload)
            .values(payload_id=payload_id, raw_data_json=document)
            .on_conflict_do_nothing(index_elements=["payload_id"])
        )
        for topic in topics:
            outgest_id = f"{payload_id}:{topic.topic_id}"
            await session.execute(
                insert(OutgoingRawData)
                .values(
                    outgest_id=outgest_id,
                    payload_id=payload_id,
                    internal_record_id=activity.activity_id,
                    register_id=definition.register_id,
                    data_model_id=topic.data_model_id,
                    topic_id=topic.topic_id,
                    created_at=datetime.utcnow(),
                    changed_by=activity.status_changed_by or activity.recorded_by,
                    changed_at=activity.status_changed_at or activity.recorded_at,
                    approved_by=activity.verified_by,
                    approved_at=activity.verified_at,
                    changed_by_partner_id=activity.source_partner_id,
                    transformation_status=ProcessStatusEnum.PENDING.value,
                    transformation_number_of_attempts=0,
                    publish_number_of_attempts=0,
                )
                .on_conflict_do_nothing(index_elements=["outgest_id"])
            )

    async def reconcile(self) -> dict[str, int]:
        """Recompute projections whose row disagrees with the activities. Returns fixes per register."""
        fixed: dict[str, int] = {}
        async with self._session_maker()() as session:
            definitions = await self.registry.list_registers(session)
        for definition in definitions:
            async with self._session_maker()() as session:
                try:
                    register = await self.registry.get_register(session, definition.register_mnemonic)
                except G2PRegistryException as error:
                    _logger.warning("Skipping reconciliation of %s: %s", definition.register_mnemonic, error.message)
                    continue
                if register.projection_model is None:
                    continue
                model, projection = register.activity_model, register.projection_model
                actual = (
                    select(model.context_id.label("context_id"), func.count().label("n"),
                           func.max(model.recorded_at).label("last"))
                    .where(model.context_id.isnot(None), active_filter(model))
                    .group_by(model.context_id)
                    .subquery()
                )
                stale = select(actual.c.context_id).outerjoin(
                    projection, projection.context_id == actual.c.context_id
                ).where(
                    or_(
                        projection.context_id.is_(None),
                        projection.activity_count != actual.c.n,
                        projection.last_recorded_at != actual.c.last,
                    )
                )
                orphaned = select(projection.context_id).outerjoin(
                    actual, actual.c.context_id == projection.context_id
                ).where(actual.c.context_id.is_(None))
                context_ids = set((await session.execute(stale)).scalars()) | set(
                    (await session.execute(orphaned)).scalars()
                )
            for context_id in context_ids:
                # recompute (not rebuild): it also deletes projections whose
                # context has gone or has no current activities.
                async with self._session_maker()() as session:
                    async with session.begin():
                        await self.projections.recompute(session, register, context_id)
            if context_ids:
                _logger.warning("Reconciled %s projections for %s", len(context_ids), definition.register_mnemonic)
            fixed[definition.register_mnemonic] = len(context_ids)
        return fixed

    async def backlog(self) -> dict[str, object]:
        """Outbox health: pending/failed counts and the age of the oldest pending row."""
        async with self._session_maker()() as session:
            counts = dict(
                (
                    await session.execute(
                        select(G2PActivityOutbox.status, func.count()).group_by(G2PActivityOutbox.status)
                    )
                ).all()
            )
            oldest = (
                await session.execute(
                    select(func.min(G2PActivityOutbox.created_at)).where(
                        G2PActivityOutbox.status == ProcessStatusEnum.PENDING.value
                    )
                )
            ).scalar()
        return {
            "counts": counts,
            "oldest_pending_seconds": (datetime.utcnow() - oldest).total_seconds() if oldest else 0,
        }


def _json_ready(value):
    """Aggregate values may hold Decimals and dates from projections; JSONB wants plain JSON."""
    if isinstance(value, dict):
        return {key: _json_ready(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_ready(item) for item in value]
    return _jsonable(value)


def _jsonable(value):
    from datetime import date
    from decimal import Decimal

    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value
