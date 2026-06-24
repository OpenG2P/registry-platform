import logging

from iam_core.user_auth.decorators import require_permissions
from openg2p_fastapi_common.controller import BaseController
from openg2p_registry_core.controller_services import G2PAttributeControllerService
from openg2p_registry_core.schemas import (
    CreateAttributeRequest,
    CreateAttributeResponse,
    CreateAttributeResponseBody,
    CreateAttributeValueRequest,
    CreateAttributeValueResponse,
    CreateAttributeValueResponseBody,
    DeleteAttributeRequest,
    DeleteAttributeResponse,
    DeleteAttributeResponseBody,
    DeleteAttributeValueRequest,
    DeleteAttributeValueResponse,
    DeleteAttributeValueResponseBody,
    GetAttributeRequest,
    GetAttributeResponse,
    GetAttributeResponseBody,
    GetAttributesRequest,
    GetAttributesResponse,
    GetAttributesResponseBody,
    GetAttributeValuesRequest,
    GetAttributeValuesResponse,
    GetAttributeValuesResponseBody,
    UpdateAttributeRequest,
    UpdateAttributeResponse,
    UpdateAttributeResponseBody,
    UpdateAttributeValueRequest,
    UpdateAttributeValueResponse,
    UpdateAttributeValueResponseBody,
)

from ..config import Settings
from ..helpers import RequestResponseHelper

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class G2PAttributeController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.router.tags += ["/attributes"]
        self.g2p_attribute_controller_service = G2PAttributeControllerService.get_component()
        self.helper = RequestResponseHelper.get_component()
        self.router.prefix = "/attributes"

        self.router.add_api_route(
            "/get_attributes",
            self.get_attributes,
            responses={200: {"model": GetAttributesResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/get_attribute",
            self.get_attribute,
            responses={200: {"model": GetAttributeResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/create_attribute",
            self.create_attribute,
            responses={200: {"model": CreateAttributeResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/update_attribute",
            self.update_attribute,
            responses={200: {"model": UpdateAttributeResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/delete_attribute",
            self.delete_attribute,
            responses={200: {"model": DeleteAttributeResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/get_attribute_values",
            self.get_attribute_values,
            responses={200: {"model": GetAttributeValuesResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/create_attribute_value",
            self.create_attribute_value,
            responses={200: {"model": CreateAttributeValueResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/update_attribute_value",
            self.update_attribute_value,
            responses={200: {"model": UpdateAttributeValueResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/delete_attribute_value",
            self.delete_attribute_value,
            responses={200: {"model": DeleteAttributeValueResponse}},
            methods=["POST"],
        )

    @require_permissions({"referenceData:view"})
    async def get_attributes(self, request: GetAttributesRequest) -> GetAttributesResponse:
        try:
            attributes, pagination = await self.g2p_attribute_controller_service.get_attributes(request)
            return self.helper.construct_success_response(
                GetAttributesResponseBody(response_payload=attributes),
                request,
                pagination_response=pagination,
            )
        except Exception as error_exception:
            _logger.error("Error in get_attributes: %s", error_exception, exc_info=True)
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"referenceData:view"})
    async def get_attribute(self, request: GetAttributeRequest) -> GetAttributeResponse:
        try:
            attribute = await self.g2p_attribute_controller_service.get_attribute(request)
            return self.helper.construct_success_response(
                GetAttributeResponseBody(response_payload=attribute),
                request,
            )
        except Exception as error_exception:
            _logger.error("Error in get_attribute: %s", error_exception, exc_info=True)
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"referenceData:create"})
    async def create_attribute(self, request: CreateAttributeRequest) -> CreateAttributeResponse:
        try:
            payload = await self.g2p_attribute_controller_service.create_attribute(request)
            return self.helper.construct_success_response(
                CreateAttributeResponseBody(response_payload=payload),
                request,
            )
        except Exception as error_exception:
            _logger.error("Error in create_attribute: %s", error_exception, exc_info=True)
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"referenceData:edit"})
    async def update_attribute(self, request: UpdateAttributeRequest) -> UpdateAttributeResponse:
        try:
            payload = await self.g2p_attribute_controller_service.update_attribute(request)
            return self.helper.construct_success_response(
                UpdateAttributeResponseBody(response_payload=payload),
                request,
            )
        except Exception as error_exception:
            _logger.error("Error in update_attribute: %s", error_exception, exc_info=True)
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"referenceData:delete"})
    async def delete_attribute(self, request: DeleteAttributeRequest) -> DeleteAttributeResponse:
        try:
            payload = await self.g2p_attribute_controller_service.delete_attribute(request)
            return self.helper.construct_success_response(
                DeleteAttributeResponseBody(response_payload=payload),
                request,
            )
        except Exception as error_exception:
            _logger.error("Error in delete_attribute: %s", error_exception, exc_info=True)
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"referenceData:view"})
    async def get_attribute_values(
        self,
        request: GetAttributeValuesRequest,
    ) -> GetAttributeValuesResponse:
        try:
            attribute_values, pagination = await self.g2p_attribute_controller_service.get_attribute_values(
                request
            )
            return self.helper.construct_success_response(
                GetAttributeValuesResponseBody(response_payload=attribute_values),
                request,
                pagination_response=pagination,
            )
        except Exception as error_exception:
            _logger.error("Error in get_attribute_values: %s", error_exception, exc_info=True)
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"referenceData:create"})
    async def create_attribute_value(
        self, request: CreateAttributeValueRequest
    ) -> CreateAttributeValueResponse:
        try:
            payload = await self.g2p_attribute_controller_service.create_attribute_value(request)
            return self.helper.construct_success_response(
                CreateAttributeValueResponseBody(response_payload=payload),
                request,
            )
        except Exception as error_exception:
            _logger.error("Error in create_attribute_value: %s", error_exception, exc_info=True)
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"referenceData:edit"})
    async def update_attribute_value(
        self, request: UpdateAttributeValueRequest
    ) -> UpdateAttributeValueResponse:
        try:
            payload = await self.g2p_attribute_controller_service.update_attribute_value(request)
            return self.helper.construct_success_response(
                UpdateAttributeValueResponseBody(response_payload=payload),
                request,
            )
        except Exception as error_exception:
            _logger.error("Error in update_attribute_value: %s", error_exception, exc_info=True)
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"referenceData:delete"})
    async def delete_attribute_value(
        self, request: DeleteAttributeValueRequest
    ) -> DeleteAttributeValueResponse:
        try:
            payload = await self.g2p_attribute_controller_service.delete_attribute_value(request)
            return self.helper.construct_success_response(
                DeleteAttributeValueResponseBody(response_payload=payload),
                request,
            )
        except Exception as error_exception:
            _logger.error("Error in delete_attribute_value: %s", error_exception, exc_info=True)
            return self.helper.construct_error_response(error_exception, request)
