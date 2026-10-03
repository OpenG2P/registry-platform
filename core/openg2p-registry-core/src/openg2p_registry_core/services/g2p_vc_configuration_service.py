import logging
import uuid
from typing import List, Optional, Tuple

from openg2p_fastapi_common.service import BaseService
from openg2p_fastapi_common.context import get_async_session_maker

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select

from ..models import (
    DataModel,
    G2PIntakeFormDefinition,
    G2PRegisterDefinition,
    G2PRegistryVcConfiguration,
)
from ..schemas import (
    VcConfigurationData,
)
from ..errors import G2PRegistryErrorCodes, G2PRegistryException

_logger = logging.getLogger("g2p-vc-configuration-service")


class G2PVcConfigurationService(BaseService):

    async def get_vc_configuration_for_register(
        self,
        register_id: str,
        current_page: Optional[int] = None,
        page_size: Optional[int] = None,
    ) -> Tuple[List[VcConfigurationData], int]:
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            await self._validate_register_exists(register_id, session)
            _logger.info("validation Register exists")
            vc_configuration_data, total_items = (
                await self._fetch_vc_configuration_data_list(
                    session,
                    register_id=register_id,
                    current_page=current_page,
                    page_size=page_size,
                )
            )
            _logger.info(
                "Got %s vc configurations for register id %s (total=%s)",
                len(vc_configuration_data),
                register_id,
                total_items,
            )
            return vc_configuration_data, total_items

    async def get_all_vc_configurations(
        self,
        current_page: Optional[int] = None,
        page_size: Optional[int] = None,
        register_id: Optional[str] = None,
    ) -> Tuple[List[VcConfigurationData], int]:
        """Get registry vc configurations, optionally filtered by register_id."""
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            if register_id:
                await self._validate_register_exists(register_id, session)
            vc_configuration_data, total_items = (
                await self._fetch_vc_configuration_data_list(
                    session,
                    register_id=register_id or None,
                    current_page=current_page,
                    page_size=page_size,
                )
            )
            _logger.info(
                "Got %s vc configurations (total=%s, register_id=%s)",
                len(vc_configuration_data),
                total_items,
                register_id,
            )
            return vc_configuration_data, total_items

    async def create_vc_configuration(
        self,
        register_id: str,
        vc_mnemonic: str,
        descriptor_schema: dict,
        intake_form_id: Optional[str] = None,
        data_model_id: Optional[str] = None,
    ) -> List[VcConfigurationData]:
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            await self._validate_register_exists(register_id, session)
            _logger.info("validation Register exists")

            g2p_register_vc_configuration = G2PRegistryVcConfiguration(
                vc_config_id=str(uuid.uuid4()),
                register_id=register_id,
                intake_form_id=intake_form_id,
                data_model_id=data_model_id,
                vc_mnemonic=vc_mnemonic,
                descriptor_schema=descriptor_schema,
            )
            session.add(g2p_register_vc_configuration)
            await session.commit()

            return [VcConfigurationData.model_validate(g2p_register_vc_configuration)]

    async def update_vc_configuration(
        self,
        vc_config_id: str,
        descriptor_schema: Optional[dict] = None,
        intake_form_id: Optional[str] = None,
        data_model_id: Optional[str] = None,
        vc_mnemonic: Optional[str] = None,
    ) -> List[VcConfigurationData]:
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            g2p_register_vc_configuration: G2PRegistryVcConfiguration = (
                await self._get_vc_configuration(vc_config_id, session)
            )

            if descriptor_schema is not None:
                g2p_register_vc_configuration.descriptor_schema = descriptor_schema
            if intake_form_id is not None:
                g2p_register_vc_configuration.intake_form_id = intake_form_id
            if data_model_id is not None:
                g2p_register_vc_configuration.data_model_id = data_model_id
            if vc_mnemonic is not None:
                g2p_register_vc_configuration.vc_mnemonic = vc_mnemonic

            await session.commit()
            await session.refresh(g2p_register_vc_configuration)
            return [VcConfigurationData.model_validate(g2p_register_vc_configuration)]

    async def delete_vc_configuration(
        self,
        vc_config_id: str,
    ) -> List[VcConfigurationData]:
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            g2p_register_vc_configuration = await self._get_vc_configuration(
                vc_config_id, session
            )
            data = VcConfigurationData.model_validate(g2p_register_vc_configuration)
            await session.delete(g2p_register_vc_configuration)
            await session.commit()
            return [data]

    async def _fetch_vc_configuration_data_list(
        self,
        session: AsyncSession,
        register_id: Optional[str] = None,
        current_page: Optional[int] = None,
        page_size: Optional[int] = None,
    ) -> Tuple[List[VcConfigurationData], int]:
        count_query = select(func.count()).select_from(G2PRegistryVcConfiguration)
        if register_id is not None:
            count_query = count_query.where(
                G2PRegistryVcConfiguration.register_id == register_id
            )
        total_items = (await session.execute(count_query)).scalar_one()

        stmt = (
            select(
                G2PRegistryVcConfiguration,
                G2PIntakeFormDefinition.form_mnemonic,
                DataModel.data_model_mnemonic,
            )
            .outerjoin(
                G2PIntakeFormDefinition,
                G2PRegistryVcConfiguration.intake_form_id
                == G2PIntakeFormDefinition.form_id,
            )
            .outerjoin(
                DataModel,
                G2PRegistryVcConfiguration.data_model_id == DataModel.data_model_id,
            )
        )
        if register_id is not None:
            stmt = stmt.where(G2PRegistryVcConfiguration.register_id == register_id)

        if current_page is not None and page_size is not None:
            offset = (current_page - 1) * page_size
            stmt = stmt.offset(offset).limit(page_size)

        rows = (await session.execute(stmt)).all()
        return [
            VcConfigurationData(
                vc_config_id=vc.vc_config_id,
                register_id=vc.register_id,
                intake_form_id=vc.intake_form_id,
                intake_form_mnemonic=intake_form_mnemonic,
                data_model_id=vc.data_model_id,
                data_model_mnemonic=data_model_mnemonic,
                vc_mnemonic=vc.vc_mnemonic,
                descriptor_schema=vc.descriptor_schema,
            )
            for vc, intake_form_mnemonic, data_model_mnemonic in rows
        ], total_items

    async def _validate_register_exists(self, register_id: str, session: AsyncSession):
        """Validate that a register exists."""
        register_definition = await session.get(G2PRegisterDefinition, register_id)

        if not register_definition:
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.REGISTER_NOT_FOUND.value[1],
                message=f"Register with id {register_id} not found",
            )

    async def _get_vc_configuration(
        self, vc_config_id: str, session: AsyncSession
    ) -> G2PRegistryVcConfiguration:
        g2p_register_vc_configuration = await session.get(
            G2PRegistryVcConfiguration, vc_config_id
        )

        if not g2p_register_vc_configuration:
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.VC_CONFIGURATION_NOT_FOUND.value[1],
                message=f"VC configuration with id {vc_config_id} not found",
            )
        return g2p_register_vc_configuration
