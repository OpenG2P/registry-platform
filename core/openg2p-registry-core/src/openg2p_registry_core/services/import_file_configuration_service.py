import logging
from typing import List

from openg2p_fastapi_common.context import dbengine
from openg2p_fastapi_common.service import BaseService
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from ..models import G2PRegistryImportFileConfiguration
from ..schemas import ImportFileConfigurationData

_logger = logging.getLogger("import-file-configuration-service")


class ImportFileConfigurationService(BaseService):
    async def get_import_file_configuration_for_register(
        self, register_id: str
    ) -> List[ImportFileConfigurationData]:
        session_maker = async_sessionmaker(dbengine.get(), expire_on_commit=False)
        async with session_maker() as session:
            rows = (
                await session.execute(
                    select(G2PRegistryImportFileConfiguration).where(
                        G2PRegistryImportFileConfiguration.register_id == register_id
                    )
                )
            ).scalars().all()

            _logger.info(
                "Got %s import-file configurations for register_id=%s",
                len(rows),
                register_id,
            )
            return [ImportFileConfigurationData.model_validate(r) for r in rows]

