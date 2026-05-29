import logging
from typing import List

from openg2p_fastapi_common.service import BaseService

from ..schemas import (
    ImportFileConfigurationData,
    ImportFileConfigurationRequest,
)
from ..services import ImportFileConfigurationService

_logger = logging.getLogger("import-file-configuration-controller-service")


class ImportFileConfigurationControllerService(BaseService):
    async def get_import_file_configuration(self, request: ImportFileConfigurationRequest) -> List[ImportFileConfigurationData]:
        _logger.info("Fetching import-file configuration through controller service")
        import_file_configuration_service = ImportFileConfigurationService.get_component()
        import_file_configuration_data: List[ImportFileConfigurationData] = await import_file_configuration_service.get_import_file_configuration_for_register(
            register_id=request.request_body.request_payload.register_id
        )
        return import_file_configuration_data

