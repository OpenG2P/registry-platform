"""Asynchronous work after an activity is written, and projection reconciliation.

The outbox row is committed in the same transaction as the activity, so no
event is ever lost. A worker claims pending rows with SKIP LOCKED (several
workers can run), publishes to outgest topics, runs the register's aggregate
hook, and marks the row processed — in one transaction, so a crash means the
row is simply picked up again. Every step is idempotent.
"""

import logging
from datetime import datetime

from openg2p_fastapi_common.context import dbengine
from openg2p_fastapi_common.service import BaseService
from sqlalchemy import and_, func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import async_sessionmaker

from ..config import Settings
from ..errors import G2PRegistryException
from ..models import (
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
        return done

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
        hook = getattr(register.domain_service, "on_activity_event", None)
        if hook is not None:
            await hook(session, outbox.event_type, activity)

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


def _jsonable(value):
    from datetime import date
    from decimal import Decimal

    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value
