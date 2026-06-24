import logging

from fastapi import File, UploadFile
from iam_core.user_auth.decorators import require_permissions
from openg2p_fastapi_common.controller import BaseController

from openg2p_registry_core.controller_services import G2PTemplateFileControllerService
from openg2p_registry_core.schemas import (
    DeleteFileData,
    DeleteFileResponse,
    FileUrlData,
    FileUrlRequest,
    FileUrlResponse,
    UploadDocumentsResponse,
    UploadDocumentsResponseData,
)

from ..config import Settings
from ..helpers import RequestResponseHelper

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class G2PTemplateFileController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.router.tags += ["/templates"]
        self.router.prefix = "/templates"
        self.g2p_template_file_controller_service = G2PTemplateFileControllerService.get_component()
        self.helper = RequestResponseHelper.get_component()

        self.router.add_api_route(
            "/upload_template",
            self.upload_template,
            responses={200: {"model": UploadDocumentsResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_file_url",
            self.get_file_url,
            responses={200: {"model": FileUrlResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/delete_template",
            self.delete_template,
            responses={200: {"model": DeleteFileResponse}},
            methods=["POST"],
        )

    @require_permissions({"dataModel:edit"})
    async def upload_template(
        self,
        template_file: UploadFile = File(..., description="Template file to upload"),
    ) -> UploadDocumentsResponse:
        try:
            upload_template_data: UploadDocumentsResponseData = (
                await self.g2p_template_file_controller_service.upload_template(template_file)
            )
            return self.helper.construct_upload_documents_success_response(
                upload_response_data=upload_template_data
            )
        except Exception as error_exception:
            _logger.error("Error in upload_template: %s", str(error_exception))
            return self.helper.construct_upload_documents_error_response(error_exception)

    @require_permissions({"dataModel:view"})
    async def get_file_url(
        self, file_url_request: FileUrlRequest
    ) -> FileUrlResponse:
        try:
            file_url_data: FileUrlData = (
                await self.g2p_template_file_controller_service.get_file_url(
                    file_url_request.request_body.request_payload.document_store_id
                )
            )
            return self.helper.construct_file_url_success_response(
                file_url_data=file_url_data,
                g2p_request=file_url_request,
            )
        except Exception as error_exception:
            _logger.error("Error in template get_file_url: %s", str(error_exception))
            return self.helper.construct_file_url_error_response(error_exception)

    @require_permissions({"dataModel:edit"})
    async def delete_template(
        self, delete_template_request: FileUrlRequest
    ) -> DeleteFileResponse:
        try:
            delete_file_data: DeleteFileData = (
                await self.g2p_template_file_controller_service.delete_template(
                    delete_template_request.request_body.request_payload.document_store_id
                )
            )
            return self.helper.construct_delete_file_success_response(
                delete_file_data=delete_file_data,
                g2p_request=delete_template_request,
            )
        except Exception as error_exception:
            _logger.error("Error in delete_template: %s", str(error_exception))
            return self.helper.construct_delete_file_error_response(error_exception)
