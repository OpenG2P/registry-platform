"""Data policy CRUD and detail-view record-level enforcement."""

import logging
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from openg2p_fastapi_common.context import dbengine
from openg2p_fastapi_common.service import BaseService

from ..errors import G2PRegistryErrorCodes, G2PRegistryException
from ..helpers.data_policy_helper import merge_policy_filter_expressions
from ..models import G2PRegistryDataPolicy
from ..models.enum import RegistryDataPolicyTypeEnum
from ..schemas.g2p_data_policy import (
    PolicyFilterGroup,
    RegistryDataPolicyData,
    RegistryDataPolicyType,
)

_logger = logging.getLogger("g2p-data-policy-service")


class G2PDataPolicyService(BaseService):
    # -------------------------------------------------------------------------
    # Policy definition (CRUD / merge)
    # -------------------------------------------------------------------------

    def _to_policy_data(self, policy: G2PRegistryDataPolicy) -> RegistryDataPolicyData:
        return RegistryDataPolicyData(
            policy_id=policy.policy_id,
            policy_mnemonic=policy.policy_mnemonic,
            policy_description=policy.policy_description,
            register_id=policy.register_id,
            policy_type=RegistryDataPolicyType(policy.policy_type),
            policy_filter_expression=policy.policy_filter_expression,
        )

    def validate_policy_filter_expression(self, expression: dict) -> dict:
        """Validate and normalize a GROUP/CONDITION policy filter tree."""
        if not isinstance(expression, dict):
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.INVALID_REQUEST.value[1],
                message="policy_filter_expression must be a JSON object",
            )
        if expression.get("type") == "CONDITION":
            from ..schemas.g2p_data_policy import PolicyFilterCondition

            validated = PolicyFilterCondition.model_validate(expression)
            return validated.model_dump(mode="json")
        validated_group = PolicyFilterGroup.model_validate(expression)
        return validated_group.model_dump(mode="json")

    async def get_policies_for_register(
        self,
        register_id: str,
        session: AsyncSession,
    ) -> list[RegistryDataPolicyData]:
        result = await session.execute(
            select(G2PRegistryDataPolicy)
            .where(G2PRegistryDataPolicy.register_id == register_id)
            .order_by(G2PRegistryDataPolicy.policy_mnemonic)
        )
        policies = result.scalars().all()
        return [self._to_policy_data(policy) for policy in policies]

    async def _get_policies_by_mnemonics(
        self,
        register_id: str,
        policy_mnemonics: Sequence[str],
        session: AsyncSession,
    ) -> list[G2PRegistryDataPolicy]:
        if not policy_mnemonics:
            return []

        result = await session.execute(
            select(G2PRegistryDataPolicy).where(
                G2PRegistryDataPolicy.register_id == register_id,
                G2PRegistryDataPolicy.policy_mnemonic.in_(list(policy_mnemonics)),
            )
        )
        return list(result.scalars().all())

    async def build_merged_policy_expression_for_roles(
        self,
        register_id: str,
        policy_mnemonics: Sequence[str],
        session: AsyncSession,
    ) -> dict | None:
        policies = await self._get_policies_by_mnemonics(
            register_id=register_id,
            policy_mnemonics=policy_mnemonics,
            session=session,
        )
        if not policies:
            return None

        allow_expressions: list[dict] = []
        disallow_expressions: list[dict] = []
        for policy in policies:
            if policy.policy_type == RegistryDataPolicyTypeEnum.ALLOW.value:
                allow_expressions.append(policy.policy_filter_expression)
            elif policy.policy_type == RegistryDataPolicyTypeEnum.DISALLOW.value:
                disallow_expressions.append(policy.policy_filter_expression)

        return merge_policy_filter_expressions(allow_expressions, disallow_expressions)

    async def add_policy(
        self,
        policy_mnemonic: str,
        policy_description: str | None,
        register_id: str,
        policy_type: RegistryDataPolicyType,
        policy_filter_expression: dict,
        session: AsyncSession,
    ) -> RegistryDataPolicyData:
        normalized_expression = self.validate_policy_filter_expression(policy_filter_expression)

        existing = await session.execute(
            select(G2PRegistryDataPolicy).where(
                G2PRegistryDataPolicy.register_id == register_id,
                G2PRegistryDataPolicy.policy_mnemonic == policy_mnemonic,
            )
        )
        if existing.scalar_one_or_none():
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.INVALID_REQUEST.value[1],
                message=f"Policy mnemonic '{policy_mnemonic}' already exists for this register",
            )

        policy = G2PRegistryDataPolicy(
            policy_mnemonic=policy_mnemonic,
            policy_description=policy_description,
            register_id=register_id,
            policy_type=policy_type.value,
            policy_filter_expression=normalized_expression,
        )
        session.add(policy)
        await session.flush()
        await session.refresh(policy)
        return self._to_policy_data(policy)

    async def remove_policy(
        self,
        policy_id: str,
        session: AsyncSession,
    ) -> tuple[str, str]:
        result = await session.execute(
            select(G2PRegistryDataPolicy).where(G2PRegistryDataPolicy.policy_id == policy_id)
        )
        policy = result.scalar_one_or_none()
        if not policy:
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.REGISTER_DATA_NOT_FOUND.value[1],
                message=f"Data policy not found: {policy_id}",
            )

        deleted_id = policy.policy_id
        policy_mnemonic = policy.policy_mnemonic
        await session.delete(policy)
        return deleted_id, policy_mnemonic

    # -------------------------------------------------------------------------
    # Detail-view enforcement
    # -------------------------------------------------------------------------

    async def resolve_merged_policy_filter(
        self,
        register_id: str,
        policy_mnemonics: Sequence[str] | None,
        session: AsyncSession | None = None,
    ) -> dict | None:
        if not policy_mnemonics:
            return None

        if session is not None:
            return await self.build_merged_policy_expression_for_roles(
                register_id, policy_mnemonics, session
            )

        session_maker = async_sessionmaker(dbengine.get(), expire_on_commit=False)
        async with session_maker() as owned_session:
            return await self.build_merged_policy_expression_for_roles(
                register_id, policy_mnemonics, owned_session
            )

    async def ensure_record_access(
        self,
        register_id: str,
        internal_record_id: str,
        policy_mnemonics: Sequence[str] | None,
        session: AsyncSession | None = None,
    ) -> None:
        """Raise RECORD_ACCESS_DENIED when the record is outside merged ALLOW policies."""
        if not policy_mnemonics:
            return

        if session is not None:
            await self._ensure_record_access(
                register_id, internal_record_id, policy_mnemonics, session
            )
            return

        session_maker = async_sessionmaker(dbengine.get(), expire_on_commit=False)
        async with session_maker() as owned_session:
            await self._ensure_record_access(
                register_id, internal_record_id, policy_mnemonics, owned_session
            )

    async def _ensure_record_access(
        self,
        register_id: str,
        internal_record_id: str,
        policy_mnemonics: Sequence[str],
        session: AsyncSession,
    ) -> None:
        merged = await self.resolve_merged_policy_filter(
            register_id, policy_mnemonics, session=session
        )
        if not merged:
            return

        from .g2p_register_service import G2PRegisterService

        await G2PRegisterService.get_component().ensure_record_allowed_by_data_policies(
            register_id=register_id,
            internal_record_id=internal_record_id,
            data_policy_merged=merged,
            session=session,
        )
