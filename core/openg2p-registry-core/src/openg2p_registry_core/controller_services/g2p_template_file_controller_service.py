from fastapi import UploadFile
from openg2p_fastapi_common.service import BaseService

from ..schemas import DeleteFileData, FileUrlData, UploadDocumentsResponseData
from ..services import G2PTemplateFileService


class G2PTemplateFileControllerService(BaseService):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.g2p_template_file_service = G2PTemplateFileService.get_component()

    async def upload_template(self, template_file: UploadFile) -> UploadDocumentsResponseData:
        return await self.g2p_template_file_service.upload_template(template_file)

    async def get_file_url(self, document_store_id: str) -> FileUrlData:
        return await self.g2p_template_file_service.get_file_url(document_store_id)

    async def delete_template(self, document_store_id: str) -> DeleteFileData:
        return await self.g2p_template_file_service.delete_template(document_store_id)
