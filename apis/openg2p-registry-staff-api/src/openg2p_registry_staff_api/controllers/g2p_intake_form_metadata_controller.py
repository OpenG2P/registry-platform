import logging

from iam_core.user_auth.decorators import require_permissions
from openg2p_fastapi_common.controller import BaseController
from openg2p_fastapi_common.schemas import G2PResponse

from openg2p_registry_core.controller_services import G2PIntakeFormMetadataControllerService
from openg2p_registry_core.schemas import (
    AddIntakeFormSectionRequest,
    CreateIntakeFormRequest,
    CreateIntakeFormTabRequest,
    DeleteIntakeFormRequest,
    DeleteIntakeFormTabRequest,
    GetAllIntakeFormsRequest,
    GetAllIntakeFormSectionsRequest,
    GetAllIntakeFormTabsRequest,
    GetIntakeFormRequest,
    GetIntakeFormTabRequest,
    IntakeFormDefinitionDataResponse,
    IntakeFormDefinitionDataResponseBody,
    IntakeFormDefinitionListResponse,
    IntakeFormDefinitionListResponseBody,
    IntakeFormUITabDataResponse,
    IntakeFormUITabDataResponseBody,
    IntakeFormUITabListResponse,
    IntakeFormUITabListResponseBody,
    IntakeFormUITabSectionDataResponse,
    IntakeFormUITabSectionDataResponseBody,
    IntakeFormUITabSectionListResponse,
    IntakeFormUITabSectionListResponseBody,
    RemoveIntakeFormSectionRequest,
    RenderIntakeFormDataResponse,
    RenderIntakeFormDataResponseBody,
    RenderIntakeFormRequest,
    UpdateIntakeFormRequest,
    UpdateIntakeFormSectionRequest,
    UpdateIntakeFormTabRequest,
)

from ..config import Settings
from ..helpers import RequestResponseHelper

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class G2PIntakeFormMetadataController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.router.tags += ["/intake-form-metadata"]
        self.service = G2PIntakeFormMetadataControllerService.get_component()
        self.helper = RequestResponseHelper.get_component()
        self.router.prefix = "/intake-form-metadata"

        self.router.add_api_route(
            "/create_intake_form",
            self.create_intake_form,
            responses={200: {"model": IntakeFormDefinitionDataResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/get_intake_form",
            self.get_intake_form,
            responses={200: {"model": IntakeFormDefinitionDataResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/render_intake_form",
            self.render_intake_form,
            responses={200: {"model": RenderIntakeFormDataResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/get_all_intake_forms",
            self.get_all_intake_forms,
            responses={200: {"model": IntakeFormDefinitionListResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/update_intake_form",
            self.update_intake_form,
            responses={200: {"model": IntakeFormDefinitionDataResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/delete_intake_form",
            self.delete_intake_form,
            responses={200: {"model": IntakeFormDefinitionDataResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/create_tab",
            self.create_tab,
            responses={200: {"model": IntakeFormUITabDataResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/get_tab",
            self.get_tab,
            responses={200: {"model": IntakeFormUITabDataResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/get_all_tabs",
            self.get_all_tabs,
            responses={200: {"model": IntakeFormUITabListResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/update_tab",
            self.update_tab,
            responses={200: {"model": IntakeFormUITabDataResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/delete_tab",
            self.delete_tab,
            responses={200: {"model": IntakeFormUITabDataResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/add_section",
            self.add_section,
            responses={200: {"model": IntakeFormUITabSectionDataResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/get_all_sections",
            self.get_all_sections,
            responses={200: {"model": IntakeFormUITabSectionListResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/update_section",
            self.update_section,
            responses={200: {"model": IntakeFormUITabSectionDataResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/remove_section",
            self.remove_section,
            responses={200: {"model": IntakeFormUITabSectionDataResponse}},
            methods=["POST"],
        )

    @require_permissions({"intakeFormDefinition:edit"})
    async def create_intake_form(self, request: CreateIntakeFormRequest) -> G2PResponse:
        try:
            request_payload = request.request_body.request_payload
            pagination_request = request.request_body.pagination_request
            data, _ = await self.service.create_intake_form(request_payload, pagination_request)
            response_body = IntakeFormDefinitionDataResponseBody(response_payload=data)
            return self.helper.construct_success_response(response_body, request)
        except Exception as error_exception:
            _logger.error(f"Error in create_intake_form: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"intakeFormDefinition:edit"})
    async def update_intake_form(self, request: UpdateIntakeFormRequest) -> G2PResponse:
        try:
            request_payload = request.request_body.request_payload
            pagination_request = request.request_body.pagination_request
            data, _ = await self.service.update_intake_form(request_payload, pagination_request)
            response_body = IntakeFormDefinitionDataResponseBody(response_payload=data)
            return self.helper.construct_success_response(response_body, request)
        except Exception as error_exception:
            _logger.error(f"Error in update_intake_form: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"intakeFormDefinition:edit"})
    async def delete_intake_form(self, request: DeleteIntakeFormRequest) -> G2PResponse:
        try:
            request_payload = request.request_body.request_payload
            pagination_request = request.request_body.pagination_request
            _, _ = await self.service.delete_intake_form(request_payload, pagination_request)
            response_body = IntakeFormDefinitionDataResponseBody(response_payload=None)
            return self.helper.construct_success_response(response_body, request)
        except Exception as error_exception:
            _logger.error(f"Error in delete_intake_form: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"intakeFormDefinition:view"})
    async def get_all_intake_forms(self, request: GetAllIntakeFormsRequest) -> G2PResponse:
        try:
            request_payload = request.request_body.request_payload
            pagination_request = request.request_body.pagination_request
            data, pagination_response = await self.service.get_all_intake_forms(request_payload, pagination_request)
            response_body = IntakeFormDefinitionListResponseBody(response_payload=data)
            return self.helper.construct_success_response(
                response_body,
                request,
                pagination_response=pagination_response,
            )
        except Exception as error_exception:
            _logger.error(f"Error in get_all_intake_forms: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"intakeFormDefinition:view"})
    async def get_intake_form(self, request: GetIntakeFormRequest) -> G2PResponse:
        try:
            request_payload = request.request_body.request_payload
            pagination_request = request.request_body.pagination_request
            data, _ = await self.service.get_intake_form(request_payload, pagination_request)
            response_body = IntakeFormDefinitionDataResponseBody(response_payload=data)
            return self.helper.construct_success_response(response_body, request)
        except Exception as error_exception:
            _logger.error(f"Error in get_intake_form: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"intakeFormDefinition:view"})
    async def render_intake_form(self, request: RenderIntakeFormRequest) -> G2PResponse:
        try:
            request_payload = request.request_body.request_payload
            pagination_request = request.request_body.pagination_request
            data, _ = await self.service.render_intake_form(request_payload, pagination_request)
            response_body = RenderIntakeFormDataResponseBody(response_payload=data)
            return self.helper.construct_success_response(response_body, request)
        except Exception as error_exception:
            _logger.error(f"Error in render_intake_form: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"intakeFormDefinition:edit"})
    async def create_tab(self, request: CreateIntakeFormTabRequest) -> G2PResponse:
        try:
            request_payload = request.request_body.request_payload
            pagination_request = request.request_body.pagination_request
            data, _ = await self.service.create_tab(request_payload, pagination_request)
            response_body = IntakeFormUITabDataResponseBody(response_payload=data)
            return self.helper.construct_success_response(response_body, request)
        except Exception as error_exception:
            _logger.error(f"Error in create_tab: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"intakeFormDefinition:edit"})
    async def delete_tab(self, request: DeleteIntakeFormTabRequest) -> G2PResponse:
        try:
            request_payload = request.request_body.request_payload
            pagination_request = request.request_body.pagination_request
            _, _ = await self.service.delete_tab(request_payload, pagination_request)
            response_body = IntakeFormUITabDataResponseBody(response_payload=None)
            return self.helper.construct_success_response(response_body, request)
        except Exception as error_exception:
            _logger.error(f"Error in delete_tab: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"intakeFormDefinition:edit"})
    async def update_tab(self, request: UpdateIntakeFormTabRequest) -> G2PResponse:
        try:
            request_payload = request.request_body.request_payload
            pagination_request = request.request_body.pagination_request
            data, _ = await self.service.update_tab(request_payload, pagination_request)
            response_body = IntakeFormUITabDataResponseBody(response_payload=data)
            return self.helper.construct_success_response(response_body, request)
        except Exception as error_exception:
            _logger.error(f"Error in update_tab: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"intakeFormDefinition:view"})
    async def get_tab(self, request: GetIntakeFormTabRequest) -> G2PResponse:
        try:
            request_payload = request.request_body.request_payload
            pagination_request = request.request_body.pagination_request
            data, _ = await self.service.get_tab(request_payload, pagination_request)
            response_body = IntakeFormUITabDataResponseBody(response_payload=data)
            return self.helper.construct_success_response(response_body, request)
        except Exception as error_exception:
            _logger.error(f"Error in get_tab: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"intakeFormDefinition:view"})
    async def get_all_tabs(self, request: GetAllIntakeFormTabsRequest) -> G2PResponse:
        try:
            request_payload = request.request_body.request_payload
            pagination_request = request.request_body.pagination_request
            data, pagination_response = await self.service.get_all_tabs(request_payload, pagination_request)
            response_body = IntakeFormUITabListResponseBody(response_payload=data)
            return self.helper.construct_success_response(
                response_body,
                request,
                pagination_response=pagination_response,
            )
        except Exception as error_exception:
            _logger.error(f"Error in get_all_tabs: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"intakeFormDefinition:edit"})
    async def add_section(self, request: AddIntakeFormSectionRequest) -> G2PResponse:
        try:
            request_payload = request.request_body.request_payload
            pagination_request = request.request_body.pagination_request
            data, _ = await self.service.add_section(request_payload, pagination_request)
            response_body = IntakeFormUITabSectionDataResponseBody(response_payload=data)
            return self.helper.construct_success_response(response_body, request)
        except Exception as error_exception:
            _logger.error(f"Error in add_section: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"intakeFormDefinition:edit"})
    async def remove_section(self, request: RemoveIntakeFormSectionRequest) -> G2PResponse:
        try:
            request_payload = request.request_body.request_payload
            pagination_request = request.request_body.pagination_request
            _, _ = await self.service.remove_section(request_payload, pagination_request)
            response_body = IntakeFormUITabSectionDataResponseBody(response_payload=None)
            return self.helper.construct_success_response(response_body, request)
        except Exception as error_exception:
            _logger.error(f"Error in remove_section: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"intakeFormDefinition:edit"})
    async def update_section(self, request: UpdateIntakeFormSectionRequest) -> G2PResponse:
        try:
            request_payload = request.request_body.request_payload
            pagination_request = request.request_body.pagination_request
            data, _ = await self.service.update_section(request_payload, pagination_request)
            response_body = IntakeFormUITabSectionDataResponseBody(response_payload=data)
            return self.helper.construct_success_response(response_body, request)
        except Exception as error_exception:
            _logger.error(f"Error in update_section: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"intakeFormDefinition:view"})
    async def get_all_sections(self, request: GetAllIntakeFormSectionsRequest) -> G2PResponse:
        try:
            request_payload = request.request_body.request_payload
            pagination_request = request.request_body.pagination_request
            data, pagination_response = await self.service.get_all_sections(request_payload, pagination_request)
            response_body = IntakeFormUITabSectionListResponseBody(response_payload=data)
            return self.helper.construct_success_response(
                response_body,
                request,
                pagination_response=pagination_response,
            )
        except Exception as error_exception:
            _logger.error(f"Error in get_all_sections: {str(error_exception)}")
            return self.helper.construct_error_response(error_exception, request)
