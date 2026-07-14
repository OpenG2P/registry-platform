import logging
from typing import List

from fastapi import Request, UploadFile, File, Form

from openg2p_fastapi_common.controller import BaseController

from openg2p_registry_core.controller_services import G2PDocumentControllerService
from openg2p_registry_core.helpers.document import DocumentBucket
from openg2p_registry_core.schemas import (
    DocumentsResponse, DocumentsData,
    DeleteDocumentsResponse, DeleteDocumentsData,
    GetDocumentsRequest,
    DeleteDocumentsRequest,
    GetChangeRequestDocumentsRequest,
    GetIntakeFormDocumentsRequest,
    GetSectionDocumentsRequest,
    ChangeRequestDocumentsResponse, ChangeRequestDocumentsData,
    IntakeFormDocumentsResponse, IntakeFormDocumentsData,
    SectionDocumentsResponse, SectionDocumentsData,
    UploadDocumentsRequestPayload,
)
from iam_core.user_auth.decorators import require_permissions

from ..helpers import RequestResponseHelper
from ..config import Settings

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class G2PDocumentController(BaseController):
    """
    Controller for document operations backed by the central document catalog
    (g2p_registry_documents) and the pluggable document storage handler.
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
            responses={200: {"model": DocumentsResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/delete_documents",
            self.delete_documents,
            responses={200: {"model": DeleteDocumentsResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_documents",
            self.get_documents,
            responses={200: {"model": DocumentsResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_change_request_documents",
            self.get_change_request_documents,
            responses={200: {"model": ChangeRequestDocumentsResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_intake_form_documents",
            self.get_intake_form_documents,
            responses={200: {"model": IntakeFormDocumentsResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_section_documents",
            self.get_section_documents,
            responses={200: {"model": SectionDocumentsResponse}},
            methods=["POST"],
        )

    @require_permissions({"changeRequest:create"})
    async def upload_documents(
        self,
        request: Request,
        documents: List[UploadFile] = File(..., description="List of documents to upload"),
        bucket: DocumentBucket = Form(DocumentBucket.DOCUMENTS, description="Target document bucket"),
    ) -> DocumentsResponse:
        """
        Upload documents to object storage and register them in the document
        catalog. Returns the catalog entries with presigned URLs.
        """
        try:
            upload_payload = UploadDocumentsRequestPayload(
                bucket=bucket,
                created_by=getattr(request.state.auth, "name", "Unknown"),
            )
            documents_data: DocumentsData = await self.g2p_document_controller_service.upload_documents(
                documents=documents,
                payload=upload_payload,
            )
            return self.helper.construct_documents_success_response(
                documents_data=documents_data
            )
        except Exception as error_exception:
            _logger.error(f"Error in upload_documents: {str(error_exception)}")
            return self.helper.construct_documents_error_response(error_exception)

    @require_permissions({"changeRequest:create"})
    async def delete_documents(
        self,
        request: DeleteDocumentsRequest
    ) -> DeleteDocumentsResponse:
        """
        Delete documents: removes the stored objects and all catalog /
        junction table references (hard cascade).
        """
        try:
            delete_documents_data: DeleteDocumentsData = await self.g2p_document_controller_service.delete_documents(request)
            return self.helper.construct_delete_documents_success_response(
                delete_documents_data=delete_documents_data,
                g2p_request=request
            )
        except Exception as error_exception:
            _logger.error(f"Error in delete_documents: {str(error_exception)}")
            return self.helper.construct_delete_documents_error_response(error_exception)

    @require_permissions({"register:view"})
    async def get_documents(
        self,
        request: GetDocumentsRequest
    ) -> DocumentsResponse:
        """
        Get catalog entries (with presigned URLs) for the given document_ids.
        """
        try:
            documents_data: DocumentsData = await self.g2p_document_controller_service.get_documents(request)
            return self.helper.construct_documents_success_response(
                documents_data=documents_data,
                g2p_request=request
            )
        except Exception as error_exception:
            _logger.error(f"Error in get_documents: {str(error_exception)}")
            return self.helper.construct_documents_error_response(error_exception)

    @require_permissions({"changeRequest:view"})
    async def get_change_request_documents(
        self,
        request: GetChangeRequestDocumentsRequest
    ) -> ChangeRequestDocumentsResponse:
        """
        Get documents attached to the specified change request.
        """
        try:
            change_request_documents_data: ChangeRequestDocumentsData = await self.g2p_document_controller_service.get_change_request_documents(request)
            return self.helper.construct_change_request_documents_success_response(
                change_request_documents_data=change_request_documents_data,
                g2p_request=request
            )
        except Exception as error_exception:
            _logger.error(f"Error in get_change_request_documents: {str(error_exception)}")
            return self.helper.construct_change_request_documents_error_response(error_exception)

    @require_permissions({"intakeSubmission:view"})
    async def get_intake_form_documents(
        self,
        request: GetIntakeFormDocumentsRequest
    ) -> IntakeFormDocumentsResponse:
        """
        Get documents attached to the specified intake form submission.
        """
        try:
            intake_form_documents_data: IntakeFormDocumentsData = await self.g2p_document_controller_service.get_intake_form_documents(request)
            return self.helper.construct_intake_form_documents_success_response(
                intake_form_documents_data=intake_form_documents_data,
                g2p_request=request
            )
        except Exception as error_exception:
            _logger.error(f"Error in get_intake_form_documents: {str(error_exception)}")
            return self.helper.construct_intake_form_documents_error_response(error_exception)

    @require_permissions({"register:view"})
    async def get_section_documents(
        self,
        request: GetSectionDocumentsRequest
    ) -> SectionDocumentsResponse:
        """
        Get documents attached to the specified live register record.
        """
        try:
            section_documents_data: SectionDocumentsData = await self.g2p_document_controller_service.get_section_documents(request)
            return self.helper.construct_section_documents_success_response(
                section_documents_data=section_documents_data,
                g2p_request=request
            )
        except Exception as error_exception:
            _logger.error(f"Error in get_section_documents: {str(error_exception)}")
            return self.helper.construct_section_documents_error_response(error_exception)
