"""Final figures: aggregates become final when their period is closed.

A period lock already stops activities in a period from being written or
corrected. When a lock for all activity types covers an aggregate's whole
period, and every activity event in that period has been processed by the
outbox worker, the aggregate is marked final (with when and by whose lock).
That is the figure a payment or official statistic can rely on.

* Only the aggregate types a register lists in its domain service's
  ``final_on_period_lock`` are finalised.
* Finalising runs when a period is locked, and after each outbox batch (so a
  lock taken while events were still pending finalises once they are done).
* Reopening the lock makes the aggregates provisional again, unless another
  active lock still covers them.
* If a final aggregate is recomputed to a different value (an activity outside
  the locked window still feeds it), it becomes provisional, and stays so
  until the period is reopened and locked again: final reflects what was
  recorded up to the lock, so a figure is never final and wrong, and a change
  after payment is visible. Registers whose aggregates draw on activities
  outside the period should lock the wider window.
"""

import logging
from datetime import datetime

from openg2p_fastapi_common.service import BaseService
from sqlalchemy import Date, and_, cast, exists, func, select, update
from sqlalchemy.orm import aliased

from ..models import G2PActivityAggregate, G2PActivityOutbox, G2PActivityPeriodLock, ProcessStatusEnum

_logger = logging.getLogger("g2p-activity-period-service")


class G2PActivityPeriodService(BaseService):
    @staticmethod
    def _covering_lock(aggregate=G2PActivityAggregate, exclude_lock_id=None):
        lock = aliased(G2PActivityPeriodLock)
        conditions = [
            lock.register_id == aggregate.register_id,
            lock.is_active.is_(True),
            lock.activity_type.is_(None),
            lock.period_start <= aggregate.period_start,
            lock.period_end >= aggregate.period_end,
        ]
        if exclude_lock_id:
            conditions.append(lock.lock_id != exclude_lock_id)
        return lock, and_(*conditions)

    async def finalise(self, session, register) -> int:
        """Mark this register's eligible aggregates final. Returns how many."""
        types = tuple(getattr(register.domain_service, "final_on_period_lock", ()) or ())
        model = register.activity_model
        if not types or model is None:
            return 0
        # Final reflects what was recorded up to the lock: an aggregate whose
        # value was last changed by an event raised after it (a late change
        # outside the window) stays provisional until the period is reopened
        # and locked again.
        lock, covered = self._covering_lock()
        covered = and_(
            covered, lock.locked_at >= func.coalesce(G2PActivityAggregate.value_changed_at, lock.locked_at)
        )
        locked_by = select(lock.locked_by).where(covered).order_by(lock.locked_at).limit(1).scalar_subquery()
        # An event not yet processed for an activity in the period: the
        # aggregate may still change, so it waits for the outbox worker.
        pending = exists(
            select(G2PActivityOutbox.outbox_id)
            .join(model, model.activity_id == G2PActivityOutbox.activity_id)
            .where(
                G2PActivityOutbox.register_id == register.register_id,
                G2PActivityOutbox.status != ProcessStatusEnum.PROCESSED.value,
                cast(model.occurred_at, Date) >= G2PActivityAggregate.period_start,
                cast(model.occurred_at, Date) <= G2PActivityAggregate.period_end,
            )
        )
        result = await session.execute(
            update(G2PActivityAggregate)
            .where(
                G2PActivityAggregate.register_id == register.register_id,
                G2PActivityAggregate.is_final.is_(False),
                G2PActivityAggregate.aggregate_type.in_(types),
                G2PActivityAggregate.period_start.is_not(None),
                G2PActivityAggregate.period_end.is_not(None),
                exists(select(lock.lock_id).where(covered)),
                ~pending,
            )
            .values(is_final=True, finalised_at=datetime.utcnow(), finalised_by=locked_by)
            .execution_options(synchronize_session=False)
        )
        if result.rowcount:
            _logger.info("Finalised %s aggregates of %s", result.rowcount, register.mnemonic)
        return result.rowcount or 0

    async def unfinalise(self, session, reopened_lock) -> int:
        """Aggregates the reopened lock covered become provisional, unless another active lock still covers them."""
        lock, still_covered = self._covering_lock(exclude_lock_id=reopened_lock.lock_id)
        result = await session.execute(
            update(G2PActivityAggregate)
            .where(
                G2PActivityAggregate.register_id == reopened_lock.register_id,
                G2PActivityAggregate.is_final.is_(True),
                G2PActivityAggregate.period_start >= reopened_lock.period_start,
                G2PActivityAggregate.period_end <= reopened_lock.period_end,
                ~exists(select(lock.lock_id).where(still_covered)),
            )
            .values(is_final=False, finalised_at=None, finalised_by=None)
            .execution_options(synchronize_session=False)
        )
        return result.rowcount or 0
