import logging
from typing import List
from fastapi import UploadFile, File, Form

from openg2p_fastapi_common.controller import BaseController

from openg2p_registry_core.controller_services import G2PDocumentControllerService
from openg2p_registry_core.schemas import (
    UploadDocumentsResponse, UploadDocumentsResponseData,
    UploadRecordImageResponse, UploadRecordImageData,
    GetDocumentLabelsForSectionRequest,
    GetSectionDocumentsRequest,
    GetSectionDocumentsForChangeRequestRequest,
    SectionDocumentsResponse, SectionDocumentsData,
    ChangeRequestDocumentsResponse, ChangeRequestDocumentsData,
    FileUrlResponse, FileUrlData, FileUrlRequest
)
from iam_core.user_auth.decorators import require_permissions

from ..helpers import RequestResponseHelper
from ..config import Settings

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class G2PDocumentController(BaseController):
    """
    Controller for handling document-related operations.
    Provides endpoints for uploading and managing documents for change requests.
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.router.tags += ["/documents"]
        self.g2p_document_controller_service = G2PDocumentControllerService.get_component()
        self.helper = RequestResponseHelper.get_component()
        self.router.prefix = "/documents"

        self.router.add_api_route(
            "/upload_documents",
            self.upload_documents,
            responses={200: {"model": UploadDocumentsResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_section_documents",
            self.get_section_documents,
            responses={200: {"model": SectionDocumentsResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_change_request_documents",
            self.get_change_request_documents,
            responses={200: {"model": ChangeRequestDocumentsResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_file_url",
            self.get_file_url,
            responses={200: {"model": FileUrlResponse}},
            methods=["POST"],
        )

    @require_permissions({"changeRequest:create"})
    async def upload_documents(
        self,
        document_label: str = Form(..., description="Document label for the files"),
        documents: List[UploadFile] = File(..., description="List of documents to upload")
    ) -> UploadDocumentsResponse:
        """
        Upload multiple documents to MinIO storage with the specified document label.
        """
        try:
            upload_response_data: UploadDocumentsResponseData = await self.g2p_document_controller_service.upload_documents(
                document_label=document_label,
                documents=documents,
            )
            upload_response: UploadDocumentsResponse = self.helper.construct_upload_documents_success_response(
                upload_response_data=upload_response_data
            )
            return upload_response
        except Exception as error_exception:
            _logger.error(f"Error in upload_documents: {str(error_exception)}")
            error_response: UploadDocumentsResponse = self.helper.construct_upload_documents_error_response(error_exception)
            return error_response


    @require_permissions({"register:view"})
    async def get_section_documents(
        self,
        request: GetSectionDocumentsRequest
    ) -> SectionDocumentsResponse:
        """
        Get documents for a section record.

        Returns the list of documents (label, document_store_id) for the specified record and section.
        """
        try:
            section_documents_data: SectionDocumentsData = await self.g2p_document_controller_service.get_section_documents(request)
            response: SectionDocumentsResponse = self.helper.construct_section_documents_success_response(
                section_documents_data=section_documents_data,
                g2p_request=request
            )
            return response
        except Exception as error_exception:
            _logger.error(f"Error in get_section_documents: {str(error_exception)}")
            error_response: SectionDocumentsResponse = self.helper.construct_section_documents_error_response(error_exception)
            return error_response

    @require_permissions({"changeRequest:view"})
    async def get_change_request_documents(
        self,
        request: GetSectionDocumentsForChangeRequestRequest
    ) -> ChangeRequestDocumentsResponse:
        """
        Get documents for a change request.

        Returns the list of documents (label, document_store_id) attached to the specified change request.
        """
        try:
            change_request_documents_data: ChangeRequestDocumentsData = await self.g2p_document_controller_service.get_change_request_documents(request)
            response: ChangeRequestDocumentsResponse = self.helper.construct_change_request_documents_success_response(
                change_request_documents_data=change_request_documents_data,
                g2p_request=request
            )
            return response
        except Exception as error_exception:
            _logger.error(f"Error in get_section_documents_for_change_request: {str(error_exception)}")
            error_response: ChangeRequestDocumentsResponse = self.helper.construct_change_request_documents_error_response(error_exception)
            return error_response

    @require_permissions({"changeRequest:view"})
    async def get_file_url(
        self,
        file_url_request: FileUrlRequest
    ) -> FileUrlResponse:
        """
        Get the URL for a file.

        Returns the URL for the specified file.
        """
        try:
            file_url_data: FileUrlData = await self.g2p_document_controller_service.get_file_url(file_url_request)
            file_url_response: FileUrlResponse = self.helper.construct_file_url_success_response(
                file_url_data=file_url_data,
                g2p_request=file_url_request
            )
            return file_url_response
        except Exception as error_exception:
            _logger.error(f"Error in get_file_url: {str(error_exception)}")
            error_response: FileUrlResponse = self.helper.construct_file_url_error_response(error_exception)
            return error_response