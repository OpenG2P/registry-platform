from fastapi import UploadFile
from openg2p_fastapi_common.context import dbengine
from openg2p_fastapi_common.service import BaseService
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from ..errors import G2PRegistryErrorCodes, G2PRegistryException
from ..models import G2PRegistryDocument
from ..schemas import DeleteFileData, FileUrlData, UploadDocumentsResponseData, UploadedDocumentData
from .g2p_template_service import G2PTemplateService

_TEMPLATE_DOCUMENT_LABEL = "jinja-template"


class G2PTemplateFileService(BaseService):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.g2p_template_service = G2PTemplateService.get_component()

    async def upload_template(self, template_file: UploadFile) -> UploadDocumentsResponseData:
        session_maker = async_sessionmaker(dbengine.get(), expire_on_commit=False)
        async with session_maker() as session:
            document_store_id = await self.g2p_template_service.upload_template_file(template_file)
            template = G2PRegistryDocument(
                document_store_id=document_store_id,
                document_label=_TEMPLATE_DOCUMENT_LABEL,
                filename=template_file.filename,
            )
            session.add(template)
            await session.commit()
            file_url = await self.g2p_template_service.get_template_file_url(document_store_id)
            return UploadDocumentsResponseData(
                uploaded_documents=[
                    UploadedDocumentData(
                        document_store_id=document_store_id,
                        document_label=template.document_label,
                        filename=template.filename,
                        document_url=file_url,
                    )
                ]
            )
    
    async def delete_template(self, document_store_id: str) -> DeleteFileData:
        session_maker = async_sessionmaker(dbengine.get(), expire_on_commit=False)
        async with session_maker() as session:
            template = await self._get_template(session, document_store_id)
            await self.g2p_template_service.delete_template_file(document_store_id)
            await session.delete(template)
            await session.commit()
            return DeleteFileData(document_store_id=document_store_id)

    async def get_file_url(self, document_store_id: str) -> FileUrlData:
        session_maker = async_sessionmaker(dbengine.get(), expire_on_commit=False)
        async with session_maker() as session:
            await self._get_template(session, document_store_id)
            file_url = await self.g2p_template_service.get_template_file_url(document_store_id)
            return FileUrlData(file_url=file_url)

    async def _get_template(
        self, session: AsyncSession, document_store_id: str
    ) -> G2PRegistryDocument:
        template_result = await session.execute(
            select(G2PRegistryDocument).where(
                G2PRegistryDocument.document_store_id == document_store_id,
                G2PRegistryDocument.document_label == _TEMPLATE_DOCUMENT_LABEL,
            )
        )
        template = template_result.scalar_one_or_none()
        if not template:
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.TEMPLATE_NOT_FOUND.value[1],
                message=G2PRegistryErrorCodes.TEMPLATE_NOT_FOUND.value[0],
            )
        return template
