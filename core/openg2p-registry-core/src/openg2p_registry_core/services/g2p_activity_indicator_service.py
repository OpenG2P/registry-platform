"""Configured indicators computed over a register's projection table.

An indicator definition names an aggregate, the projection column it applies
to, optional group-by columns and filters. Column names are checked against
the projection model, so configuration can never inject SQL.
"""

import logging
from decimal import Decimal
from typing import Any, Optional

from openg2p_fastapi_common.context import dbengine
from openg2p_fastapi_common.service import BaseService
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from ..errors import G2PRegistryErrorCodes, G2PRegistryException
from ..models import G2PActivityIndicator
from ..repositories import ActivityPolicyRepository
from ..schemas.activity import IndicatorData, IndicatorResultData
from .g2p_activity_registry_service import G2PActivityRegistryService

_logger = logging.getLogger("g2p-activity-indicator-service")

_AGGREGATES = {
    "count": lambda column: func.count(column),
    "count_distinct": lambda column: func.count(func.distinct(column)),
    "sum": func.sum,
    "avg": func.avg,
    "min": func.min,
    "max": func.max,
}


def _error(code: G2PRegistryErrorCodes, message: str) -> G2PRegistryException:
    return G2PRegistryException(code=code.value[1], message=message)


class G2PActivityIndicatorService(BaseService):
    def __init__(self, name=""):
        super().__init__(name)
        self.registry = G2PActivityRegistryService.get_component() or G2PActivityRegistryService()

    @staticmethod
    def _session_maker():
        return async_sessionmaker(dbengine.get(), expire_on_commit=False)

    async def list_indicators(self, register_mnemonic: str) -> list[IndicatorData]:
        async with self._session_maker()() as session:
            register = await self.registry.get_register(session, register_mnemonic)
            rows = (
                await session.execute(
                    select(G2PActivityIndicator)
                    .where(
                        G2PActivityIndicator.register_id == register.register_id,
                        G2PActivityIndicator.is_active.is_(True),
                    )
                    .order_by(G2PActivityIndicator.display_order, G2PActivityIndicator.indicator_code)
                )
            ).scalars()
            return [IndicatorData.model_validate(row, from_attributes=True) for row in rows]

    async def compute(
        self,
        register_mnemonic: str,
        indicator_code: str,
        filters: Optional[dict[str, Any]] = None,
        data_policies: Optional[list[dict]] = None,
    ) -> IndicatorResultData:
        async with self._session_maker()() as session:
            register = await self.registry.get_register(session, register_mnemonic)
            projection = register.projection_model
            if projection is None:
                raise _error(
                    G2PRegistryErrorCodes.ACTIVITY_PROJECTION_NOT_CONFIGURED,
                    f"{register_mnemonic} has no projection to compute indicators on",
                )
            indicator = (
                await session.execute(
                    select(G2PActivityIndicator).where(
                        G2PActivityIndicator.register_id == register.register_id,
                        G2PActivityIndicator.indicator_code == indicator_code,
                        G2PActivityIndicator.is_active.is_(True),
                    )
                )
            ).scalar()
            if indicator is None:
                raise _error(G2PRegistryErrorCodes.ACTIVITY_INDICATOR_NOT_FOUND, f"Unknown indicator {indicator_code}")

            definition = indicator.definition or {}
            measure = definition.get("measure") or {}
            fn = str(measure.get("fn") or "count").lower()
            if fn not in _AGGREGATES:
                raise _error(G2PRegistryErrorCodes.ACTIVITY_INDICATOR_INVALID, f"Unsupported aggregate {fn}")
            measure_column = self._column(projection, measure.get("field") or "context_id")
            group_by = [self._column(projection, name) for name in definition.get("group_by") or []]

            stmt = select(*group_by, _AGGREGATES[fn](measure_column).label("value"))
            for name, value in {**(definition.get("filters") or {}), **(filters or {})}.items():
                column = self._column(projection, name)
                stmt = stmt.where(column.in_(value) if isinstance(value, list) else column == value)
            if data_policies:
                from iam_core.helpers.data_policy_helper import DataPolicyHelper

                expression = DataPolicyHelper.resolve_register_record_policy(data_policies, register.register_id)
                if expression:
                    condition = ActivityPolicyRepository(projection).build_policy_condition(expression)
                    if condition is not None:
                        stmt = stmt.where(condition)
            if group_by:
                stmt = stmt.group_by(*group_by).order_by(*group_by)

            rows = []
            for row in (await session.execute(stmt)).mappings():
                rows.append({key: float(val) if isinstance(val, Decimal) else val for key, val in row.items()})
            return IndicatorResultData(
                indicator_code=indicator.indicator_code,
                display_name=indicator.display_name,
                unit=indicator.unit,
                group_by=[column.key for column in group_by],
                rows=rows,
            )

    @staticmethod
    def _column(projection, name: str):
        column = projection.__table__.columns.get(name)
        if column is None:
            raise _error(
                G2PRegistryErrorCodes.ACTIVITY_INDICATOR_INVALID,
                f"{name} is not a column of {projection.__tablename__}",
            )
        return column
