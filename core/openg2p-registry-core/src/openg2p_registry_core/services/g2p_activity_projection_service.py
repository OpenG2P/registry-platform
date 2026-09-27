"""Current-state projections: one row per activity context, recomputed from its activities.

``recompute`` runs inside the transaction that wrote the activity, so a
per-context projection is never out of step with the activities it summarises.
``rebuild`` recomputes every context of a register (after a projection bug fix
or a new projection column) and doubles as reconciliation.
"""

import logging
from datetime import datetime
from typing import Optional

from openg2p_fastapi_common.context import dbengine
from openg2p_fastapi_common.service import BaseService
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import async_sessionmaker

from ..models import G2PActivityContext
from .g2p_activity_registry_service import ActivityRegister
from .g2p_activity_rule_service import active_filter

_logger = logging.getLogger("g2p-activity-projection-service")

_BASE_COLUMNS = {
    "context_id",
    "context_key",
    "subject_type",
    "subject_id",
    "context_status",
    "activity_count",
    "last_activity_id",
    "last_activity_type",
    "last_occurred_at",
    "last_recorded_at",
    "projected_at",
    "geo_code_hierarchy_json",
}


class G2PActivityProjectionService(BaseService):
    async def current_activities(self, session, register: ActivityRegister, context_id: str) -> list:
        model = register.activity_model
        return list(
            (
                await session.execute(
                    select(model)
                    .where(model.context_id == context_id, active_filter(model))
                    .order_by(model.occurred_at, model.recorded_at)
                )
            ).scalars()
        )

    async def recompute(self, session, register: ActivityRegister, context_id: Optional[str]) -> Optional[dict]:
        projection_model = register.projection_model
        if projection_model is None or not context_id:
            return None
        context = await session.get(G2PActivityContext, context_id)
        activities = await self.current_activities(session, register, context_id)
        if context is None or not activities:
            await session.execute(delete(projection_model).where(projection_model.context_id == context_id))
            return None

        values = dict(register.domain_service.project(context, activities) or {})
        latest = activities[-1]
        values.update(
            context_id=context.context_id,
            context_key=context.context_key,
            subject_type=context.subject_type,
            subject_id=context.subject_id,
            context_status=context.status,
            activity_count=len(activities),
            last_activity_id=latest.activity_id,
            last_activity_type=latest.activity_type,
            last_occurred_at=latest.occurred_at,
            last_recorded_at=max(a.recorded_at for a in activities),
            projected_at=datetime.utcnow(),
        )
        if values.get("geo_code_hierarchy_json") is None:
            for activity in reversed(activities):
                geo = getattr(activity, "geo_code_hierarchy_json", None)
                if geo:
                    values["geo_code_hierarchy_json"] = geo
                    break

        columns = set(projection_model.__table__.columns.keys())
        unknown = set(values) - columns
        if unknown:
            _logger.warning("Projection values not in %s ignored: %s", projection_model.__tablename__, sorted(unknown))
        row = {key: value for key, value in values.items() if key in columns}
        stmt = insert(projection_model).values(**row)
        stmt = stmt.on_conflict_do_update(
            index_elements=[projection_model.context_id],
            set_={key: stmt.excluded[key] for key in row if key != "context_id"},
        )
        await session.execute(stmt)
        return row

    async def rebuild(self, register: ActivityRegister, context_id: Optional[str] = None, batch_size: int = 500) -> int:
        """Recompute projections for one context or the whole register. Returns contexts processed."""
        if register.projection_model is None:
            return 0
        session_maker = async_sessionmaker(dbengine.get(), expire_on_commit=False)
        processed = 0
        last_id = ""
        while True:
            async with session_maker() as session:
                async with session.begin():
                    stmt = select(G2PActivityContext.context_id).where(
                        G2PActivityContext.register_id == register.register_id
                    )
                    if context_id:
                        stmt = stmt.where(G2PActivityContext.context_id == context_id)
                    else:
                        stmt = stmt.where(G2PActivityContext.context_id > last_id)
                    ids = list(
                        (await session.execute(stmt.order_by(G2PActivityContext.context_id).limit(batch_size))).scalars()
                    )
                    for cid in ids:
                        await self.recompute(session, register, cid)
            processed += len(ids)
            if context_id or len(ids) < batch_size:
                return processed
            last_id = ids[-1]
