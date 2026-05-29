import logging
import uuid
from datetime import datetime
from typing import Optional

import httpx
from fastapi import UploadFile

from openg2p_fastapi_common.service import BaseService
from openg2p_fastapi_common.context import dbengine

from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession
from sqlalchemy import select

from ..models import (
    IncomingTemplate,
    OutgoingTemplate
)
from ..schemas import (
    IncomingTemplatePayload,
    IncomingTemplateUpdatePayload,
    IncomingTemplateData,
    OutgoingTemplatePayload,
    OutgoingTemplateUpdatePayload,
    OutgoingTemplateData,
)
from ..config import Settings
from ..helpers import MinioClient, TemplateHelper
from ..errors import G2PRegistryErrorCodes, G2PRegistryException

_logger = logging.getLogger("g2p-template-service")
_config = Settings.get_config()

class G2PTemplateService(BaseService):

    # IncomingTemplate Methods
    async def create_incoming_template(
        self, template_payload: IncomingTemplatePayload, template_file: UploadFile
    ) -> IncomingTemplateData:
        """Create a new template"""
        session_maker = async_sessionmaker(dbengine.get(), expire_on_commit=False)
        async with session_maker() as session:
            await self._check_incoming_template_exists(session, template_payload)

            file_id = await self.upload_template_file(template_file, template_payload.template_file_id)

            template_id = template_payload.template_id or str(uuid.uuid4())
            template = IncomingTemplate(
                template_id=template_id,
                register_id=template_payload.register_id,
                data_model_id=template_payload.data_model_id,
                template_file_id=file_id,
            )
            session.add(template)
            await session.commit()
            await session.refresh(template)
            return IncomingTemplateData.model_validate(template)

    async def get_incoming_template(self, template_id: str) -> IncomingTemplateData:
        """Get template by ID"""
        session_maker = async_sessionmaker(dbengine.get(), expire_on_commit=False)
        async with session_maker() as session:
            template_obj = await self._get_incoming_template(session, template_id)
            return IncomingTemplateData.model_validate(template_obj)

    async def update_incoming_template(
        self, template_update_payload: IncomingTemplateUpdatePayload, template_file: Optional[UploadFile] = None 
    ) -> IncomingTemplateData:
        """Update template - only updates provided fields"""
        session_maker = async_sessionmaker(dbengine.get(), expire_on_commit=False)
        async with session_maker() as session:
            template_obj = await self._get_incoming_template(session, template_update_payload.template_id)

            if template_file:
                if template_obj.template_file_id:
                    await self.delete_template_file(template_obj.template_file_id)
                template_obj.template_file_id = await self.upload_template_file(template_file, template_update_payload.template_file_id)
            if template_update_payload.register_id:
                template_obj.register_id = template_update_payload.register_id
            if template_update_payload.data_model_id:
                template_obj.data_model_id = template_update_payload.data_model_id

            await session.commit()
            await session.refresh(template_obj)
            return IncomingTemplateData.model_validate(template_obj)
    
    async def delete_incoming_template(self, template_id: str) -> None:
        """Delete template by ID"""
        session_maker = async_sessionmaker(dbengine.get(), expire_on_commit=False)
        async with session_maker() as session:
            template_obj = await self._get_incoming_template(session, template_id)

            await self.delete_template_file(template_obj.template_file_id)

            await session.delete(template_obj)
            await session.commit()
            return IncomingTemplateData.model_validate(template_obj)

    # OutgoingTemplate Methods
    async def create_outgoing_template(
        self, template_payload: OutgoingTemplatePayload, template_file: UploadFile
    ) -> OutgoingTemplateData:
        """Create a new template"""
        session_maker = async_sessionmaker(dbengine.get(), expire_on_commit=False)
        async with session_maker() as session:
            await self._check_outgoing_template_exists(session, template_payload)

            file_id = await self.upload_template_file(template_file, template_payload.template_file_id)

            template_id = template_payload.template_id or str(uuid.uuid4())
            template = OutgoingTemplate(
                template_id=template_id,
                register_id=template_payload.register_id,
                data_model_id=template_payload.data_model_id,
                template_file_id=file_id,
            )
            session.add(template)
            await session.commit()
            await session.refresh(template)
            return OutgoingTemplateData.model_validate(template)

    async def get_outgoing_template(self, template_id: str) -> OutgoingTemplateData:
        """Get template by ID"""
        session_maker = async_sessionmaker(dbengine.get(), expire_on_commit=False)
        async with session_maker() as session:
            template_obj = await self._get_outgoing_template(session, template_id)
            return OutgoingTemplateData.model_validate(template_obj)

    async def update_outgoing_template(
        self, template_update_payload: OutgoingTemplateUpdatePayload, template_file: Optional[UploadFile] = None 
    ) -> OutgoingTemplateData:
        """Update template - only updates provided fields"""
        session_maker = async_sessionmaker(dbengine.get(), expire_on_commit=False)
        async with session_maker() as session:
            template_obj = await self._get_outgoing_template(session, template_update_payload.template_id)

            if template_file:
                if template_obj.template_file_id:
                    await self.delete_template_file(template_obj.template_file_id)
                template_obj.template_file_id = await self.upload_template_file(template_file, template_update_payload.template_file_id)
            if template_update_payload.register_id:
                template_obj.register_id = template_update_payload.register_id
            if template_update_payload.data_model_id:
                template_obj.data_model_id = template_update_payload.data_model_id

            await session.commit()
            await session.refresh(template_obj)
            return OutgoingTemplateData.model_validate(template_obj)
        
    async def delete_outgoing_template(self, template_id: str) -> OutgoingTemplateData:
        """Delete template"""
        session_maker = async_sessionmaker(dbengine.get(), expire_on_commit=False)
        async with session_maker() as session:
            template_obj = await self._get_outgoing_template(session, template_id)

            await self.delete_template_file(template_obj.template_file_id)

            await session.delete(template_obj)
            await session.commit()
            return OutgoingTemplateData.model_validate(template_obj)

    # Template Methods
    async def _get_incoming_template(self, session: AsyncSession, template_id: str) -> IncomingTemplate:
        if not template_id:
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.INVALID_REQUEST.value[1],
                message=G2PRegistryErrorCodes.INVALID_REQUEST.value[0],
            )
        template = await session.execute(
            select(IncomingTemplate).where(IncomingTemplate.template_id == template_id)
        )
        template_obj = template.scalar_one_or_none()
        if not template_obj:
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.TEMPLATE_NOT_FOUND.value[1],
                message=G2PRegistryErrorCodes.TEMPLATE_NOT_FOUND.value[0],
            )
        return template_obj

    async def _get_outgoing_template(self, session: AsyncSession, template_id: str) -> OutgoingTemplate:
        if not template_id:
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.INVALID_REQUEST.value[1],
                message=G2PRegistryErrorCodes.INVALID_REQUEST.value[0],
            )
        template = await session.execute(
            select(OutgoingTemplate).where(OutgoingTemplate.template_id == template_id)
        )
        template_obj = template.scalar_one_or_none()
        if not template_obj:
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.TEMPLATE_NOT_FOUND.value[1],
                message=G2PRegistryErrorCodes.TEMPLATE_NOT_FOUND.value[0],
            )
        return template_obj
    
    async def _check_incoming_template_exists(self, session: AsyncSession, template_payload: IncomingTemplatePayload) -> None:
        if not template_payload.data_model_id or not template_payload.register_id:
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.INVALID_REQUEST.value[1],
                message=G2PRegistryErrorCodes.INVALID_REQUEST.value[0],
            )
        existing_template = await session.execute(
            select(IncomingTemplate).where(
                IncomingTemplate.data_model_id == template_payload.data_model_id,
                IncomingTemplate.register_id == template_payload.register_id,
            )
        )
        existing_template_obj = existing_template.scalar_one_or_none()
        if existing_template_obj:
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.TEMPLATE_ALREADY_EXISTS.value[1],
                message=G2PRegistryErrorCodes.TEMPLATE_ALREADY_EXISTS.value[0],
            )

    async def _check_outgoing_template_exists(self, session: AsyncSession, template_payload: OutgoingTemplatePayload) -> None:
        if not template_payload.data_model_id or not template_payload.register_id:
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.INVALID_REQUEST.value[1],
                message=G2PRegistryErrorCodes.INVALID_REQUEST.value[0],
            )
        existing_template = await session.execute(
            select(OutgoingTemplate).where(
                OutgoingTemplate.data_model_id == template_payload.data_model_id,
                OutgoingTemplate.register_id == template_payload.register_id,
            )
        )
        existing_template_obj = existing_template.scalar_one_or_none()
        if existing_template_obj:
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.TEMPLATE_ALREADY_EXISTS.value[1],
                message=G2PRegistryErrorCodes.TEMPLATE_ALREADY_EXISTS.value[0],
            )


    async def upload_template_file(self, template_file: UploadFile, template_file_id: Optional[str] = None) -> str:
        minio_client = MinioClient.get_component()
        template_helper = TemplateHelper.get_component()

        template_text = (await template_file.read()).decode("utf-8")
        file_id = template_helper.put_template(
            minio_client=minio_client,
            template_file_id=template_file_id,
            template=template_text
        )
        return file_id

    async def get_template_file_url(self, template_file_id: str) -> str:
        minio_client = MinioClient.get_component()
        template_helper = TemplateHelper.get_component()
        return template_helper.get_template_url(minio_client, template_file_id)
    
    async def delete_template_file(self, template_file_id: str) -> None:
        minio_client = MinioClient.get_component()
        template_helper = TemplateHelper.get_component()

        template_helper.delete_template(minio_client, template_file_id)
