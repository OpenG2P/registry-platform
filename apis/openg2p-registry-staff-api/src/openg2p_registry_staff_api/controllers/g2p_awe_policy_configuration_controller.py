import logging

from iam_core.user_auth.decorators import require_permissions
from openg2p_fastapi_common.controller import BaseController
from openg2p_fastapi_common.schemas import G2PResponse

from openg2p_registry_core.controller_services import G2PAwePolicyConfigurationControllerService
from openg2p_registry_core.schemas import (
    AwePolicyConfigurationDataResponse,
    AwePolicyConfigurationDataResponseBody,
    AwePolicyConfigurationListResponse,
    AwePolicyConfigurationListResponseBody,
    CreateAwePolicyConfigurationRequest,
    DeleteAwePolicyConfigurationRequest,
    GetAllAwePolicyConfigurationsRequest,
    GetAwePolicyConfigurationRequest,
    UpdateAwePolicyConfigurationRequest,
)

from ..config import Settings
from ..helpers import RequestResponseHelper

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class G2PAwePolicyConfigurationController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.router.tags += ["/awe-policy-config"]
        self.service = G2PAwePolicyConfigurationControllerService.get_component()
        self.helper = RequestResponseHelper.get_component()
        self.router.prefix = "/awe-policy-config"

        self.router.add_api_route(
            "/get_all_awe_policy_configurations",
            self.get_all_awe_policy_configurations,
            responses={200: {"model": AwePolicyConfigurationListResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/get_awe_policy_configuration",
            self.get_awe_policy_configuration,
            responses={200: {"model": AwePolicyConfigurationDataResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/create_awe_policy_configuration",
            self.create_awe_policy_configuration,
            responses={200: {"model": AwePolicyConfigurationDataResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/update_awe_policy_configuration",
            self.update_awe_policy_configuration,
            responses={200: {"model": AwePolicyConfigurationDataResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/delete_awe_policy_configuration",
            self.delete_awe_policy_configuration,
            responses={200: {"model": AwePolicyConfigurationDataResponse}},
            methods=["POST"],
        )

    @require_permissions({"registerDefinition:view"})
    async def get_all_awe_policy_configurations(
        self,
        request: GetAllAwePolicyConfigurationsRequest,
    ) -> G2PResponse:
        try:
            data, pagination_response = await self.service.get_all_awe_policy_configurations(
                request.request_body.request_payload,
                request.request_body.pagination_request,
            )
            response_body = AwePolicyConfigurationListResponseBody(response_payload=data)
            return self.helper.construct_success_response(
                response_body,
                request,
                pagination_response=pagination_response,
            )
        except Exception as error_exception:
            _logger.error("Error in get_all_awe_policy_configurations: %s", str(error_exception))
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"registerDefinition:view"})
    async def get_awe_policy_configuration(
        self,
        request: GetAwePolicyConfigurationRequest,
    ) -> G2PResponse:
        try:
            data = await self.service.get_awe_policy_configuration(request.request_body.request_payload)
            response_body = AwePolicyConfigurationDataResponseBody(response_payload=data)
            return self.helper.construct_success_response(response_body, request)
        except Exception as error_exception:
            _logger.error("Error in get_awe_policy_configuration: %s", str(error_exception))
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"registerDefinition:create"})
    async def create_awe_policy_configuration(
        self,
        request: CreateAwePolicyConfigurationRequest,
    ) -> G2PResponse:
        try:
            data = await self.service.create_awe_policy_configuration(request.request_body.request_payload)
            response_body = AwePolicyConfigurationDataResponseBody(response_payload=data)
            return self.helper.construct_success_response(response_body, request)
        except Exception as error_exception:
            _logger.error("Error in create_awe_policy_configuration: %s", str(error_exception))
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"registerDefinition:edit"})
    async def update_awe_policy_configuration(
        self,
        request: UpdateAwePolicyConfigurationRequest,
    ) -> G2PResponse:
        try:
            data = await self.service.update_awe_policy_configuration(request.request_body.request_payload)
            response_body = AwePolicyConfigurationDataResponseBody(response_payload=data)
            return self.helper.construct_success_response(response_body, request)
        except Exception as error_exception:
            _logger.error("Error in update_awe_policy_configuration: %s", str(error_exception))
            return self.helper.construct_error_response(error_exception, request)

    @require_permissions({"registerDefinition:edit"})
    async def delete_awe_policy_configuration(
        self,
        request: DeleteAwePolicyConfigurationRequest,
    ) -> G2PResponse:
        try:
            await self.service.delete_awe_policy_configuration(request.request_body.request_payload)
            response_body = AwePolicyConfigurationDataResponseBody(response_payload=None)
            return self.helper.construct_success_response(response_body, request)
        except Exception as error_exception:
            _logger.error("Error in delete_awe_policy_configuration: %s", str(error_exception))
            return self.helper.construct_error_response(error_exception, request)
