import logging
from openg2p_fastapi_common.service import BaseService

from .. helpers import MinioClient
from ..services import G2PRegisterChangeRequestService, G2PRegisterService
from ..schemas import (
    UploadDocumentsResponseData,
    UploadRecordImageData,
    SectionDocumentsData,
    ChangeRequestDocumentsData,
    GetSectionDocumentsRequest,
    GetSectionDocumentsForChangeRequestRequest,
    FileUrlRequest, FileUrlData
)

_logger = logging.getLogger('g2p-document-controller-service')


class G2PDocumentControllerService(BaseService):
    """
    Controller service for handling document-related operations.
    This service acts as an intermediary between the controller and the register service
    for all document upload and management operations.
    """

    async def upload_documents(
        self,
        document_label: str,
        documents: list  # List of documents
    ) -> UploadDocumentsResponseData:
        """
        Upload documents to MinIO storage.

        Args:
            document_label: Label for the documents
            documents: List of documents to upload

        Returns:
            UploadDocumentsResponseData with list of uploaded document info
        """
        _logger.info(f"Uploading {len(documents)} documents with label: {document_label}")
        g2p_register_service = G2PRegisterService.get_component()
        upload_response: UploadDocumentsResponseData = await g2p_register_service.upload_documents(
            document_label=document_label,
            documents=documents
        )
        return upload_response

    async def get_section_documents(
        self,
        request: GetSectionDocumentsRequest
    ) -> SectionDocumentsData:
        """
        Get documents for a section record.

        Args:
            request: Request containing register_id, record_id, and section_id

        Returns:
            SectionDocumentsData with list of documents (label, document_store_id)
        """
        payload = request.request_body.request_payload
        register_id = payload.register_id
        record_id = payload.record_id
        section_id = payload.section_id
        _logger.info(f"Getting section documents for register_id: {register_id}, record_id: {record_id}, section_id: {section_id}")
        g2p_register_service = G2PRegisterService.get_component()
        return await g2p_register_service.get_section_documents(register_id, record_id, section_id)

    async def get_change_request_documents(
        self,
        request: GetSectionDocumentsForChangeRequestRequest
    ) -> ChangeRequestDocumentsData:
        """
        Get documents for a change request.

        Args:
            request: Request containing change_request_id

        Returns:
            ChangeRequestDocumentsData with list of documents (label, document_store_id)
        """
        payload = request.request_body.request_payload
        change_request_id = payload.change_request_id
        _logger.info(f"Getting documents for change_request_id: {change_request_id}")
        change_request_service = G2PRegisterChangeRequestService.get_component()
        return await change_request_service.get_change_request_documents(change_request_id)

    async def get_file_url(
        self,
        request: FileUrlRequest
    ) -> FileUrlData:
        """
        Get the URL for a file.

        Args:
            request: Request containing file_name and bucket_name

        Returns:
            FileUrlData with URL for the specified file
        """
        payload = request.request_body.request_payload

        minio_client = MinioClient.get_component()
        file_url = minio_client.get_url(object_name=payload.document_store_id)
        return FileUrlData(file_url=file_url)
