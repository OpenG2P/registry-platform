"""Request-level operations for activity registers, shared by the staff, partner and agent APIs."""

import logging
from typing import Optional

from openg2p_fastapi_common.context import dbengine
from openg2p_fastapi_common.schemas import G2PPaginationResponse
from openg2p_fastapi_common.service import BaseService
from sqlalchemy.ext.asyncio import async_sessionmaker

from ..errors import G2PRegistryErrorCodes, G2PRegistryException
from ..schemas.activity import ActivityRegisterData, ActivityTypeData
from ..services import (
    G2PActivityIndicatorService,
    G2PActivityProjectionService,
    G2PActivityRegistryService,
    G2PActivityService,
)

_logger = logging.getLogger("g2p-activity-controller-service")


def pagination_response(total: int, pagination) -> Optional[G2PPaginationResponse]:
    if pagination is None:
        return G2PPaginationResponse(number_of_items=total, number_of_pages=1 if total else 0)
    pages = (total + pagination.page_size - 1) // pagination.page_size if total else 0
    return G2PPaginationResponse(number_of_items=total, number_of_pages=pages)


class G2PActivityControllerService(BaseService):
    def __init__(self, name=""):
        super().__init__(name)
        self.registry = G2PActivityRegistryService.get_component() or G2PActivityRegistryService()
        self.activities = G2PActivityService.get_component() or G2PActivityService()
        self.indicators = G2PActivityIndicatorService.get_component() or G2PActivityIndicatorService()
        self.projections = G2PActivityProjectionService.get_component() or G2PActivityProjectionService()

    @staticmethod
    def _session_maker():
        return async_sessionmaker(dbengine.get(), expire_on_commit=False)

    async def get_activity_registers(self) -> list[ActivityRegisterData]:
        async with self._session_maker()() as session:
            result = []
            for definition in await self.registry.list_registers(session):
                _, projection = self.registry.resolve_classes(definition.register_mnemonic)
                result.append(
                    ActivityRegisterData(
                        register_id=definition.register_id,
                        register_mnemonic=definition.register_mnemonic,
                        register_subject=definition.register_subject,
                        register_description=definition.register_description,
                        master_register_id=definition.master_register_id,
                        register_icon=definition.register_icon,
                        has_projection=projection is not None,
                    )
                )
            return result

    async def get_activity_types(self, register_mnemonic: str) -> list[ActivityTypeData]:
        """Activity types with their schemas, rules and the options for code-list fields."""
        from ..services import G2PActivityReferenceService

        references = G2PActivityReferenceService.get_component() or G2PActivityReferenceService()
        async with self._session_maker()() as session:
            register = await self.registry.get_register(session, register_mnemonic)
            rows = await self.registry.list_activity_types(session, register.register_id)
            result = []
            for row in rows:
                data = ActivityTypeData.model_validate(row, from_attributes=True)
                for field, rule in (row.reference_rules or {}).items():
                    if str(rule.get("kind", "")).upper() == "ATTRIBUTE" and rule.get("attribute"):
                        labels = await references._attribute_labels(session, rule["attribute"])
                        data.reference_options[field] = [
                            {"code": code, "label": label} for code, label in labels.items()
                        ]
                result.append(data)
            return result

    async def get_projection(self, register_mnemonic: str, context_id: str, data_policies=None) -> dict:
        rows, _ = await self.search_projections(register_mnemonic, {"context_id": context_id}, None, data_policies)
        if not rows:
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.REGISTER_DATA_NOT_FOUND.value[1],
                message=f"No projection for context {context_id}",
            )
        return rows[0]

    async def search_projections(self, register_mnemonic: str, filters: Optional[dict], pagination,
                                 data_policies=None) -> tuple[list[dict], int]:
        from sqlalchemy import func, select

        from ..repositories import ActivityPolicyRepository

        async with self._session_maker()() as session:
            register = await self.registry.get_register(session, register_mnemonic)
            projection = register.projection_model
            if projection is None:
                raise G2PRegistryException(
                    code=G2PRegistryErrorCodes.ACTIVITY_PROJECTION_NOT_CONFIGURED.value[1],
                    message=f"{register_mnemonic} has no projection",
                )
            stmt = select(projection)
            for name, value in (filters or {}).items():
                column = projection.__table__.columns.get(name)
                if column is None:
                    raise G2PRegistryException(
                        code=G2PRegistryErrorCodes.REQUEST_VALIDATION_ERROR.value[1],
                        message=f"{name} is not a projection column",
                    )
                stmt = stmt.where(column.in_(value) if isinstance(value, list) else column == value)
            if pagination and pagination.search_text:
                stmt = stmt.where(projection.context_key.ilike(f"%{pagination.search_text}%"))
            if data_policies:
                from iam_core.helpers.data_policy_helper import DataPolicyHelper

                expression = DataPolicyHelper.resolve_register_record_policy(data_policies, register.register_id)
                condition = ActivityPolicyRepository(projection).build_policy_condition(expression) if expression else None
                if condition is not None:
                    stmt = stmt.where(condition)
            total = (await session.execute(select(func.count()).select_from(stmt.subquery()))).scalar() or 0
            sort = pagination.sort_by if pagination and pagination.sort_by else "-last_occurred_at"
            column = projection.__table__.columns.get(sort.lstrip("-"))
            if column is not None:
                stmt = stmt.order_by(column.desc() if sort.startswith("-") else column.asc())
            if pagination:
                stmt = stmt.offset((pagination.current_page - 1) * pagination.page_size).limit(pagination.page_size)
            rows = [row.to_dict() for row in (await session.execute(stmt)).scalars()]
            return rows, total

    async def rebuild_projections(self, register_mnemonic: str, context_id: Optional[str]) -> int:
        async with self._session_maker()() as session:
            register = await self.registry.get_register(session, register_mnemonic)
        return await self.projections.rebuild(register, context_id)
