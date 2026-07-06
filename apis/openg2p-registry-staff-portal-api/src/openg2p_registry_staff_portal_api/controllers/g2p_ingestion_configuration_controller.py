import logging
from openg2p_fastapi_common.controller import BaseController

from openg2p_registry_core.controller_services import G2PIngestionConfigurationControllerService
from openg2p_registry_core.schemas import (
    IncomingModelKeyPathRequest,
    IncomingModelKeyPathResponse,
    IncomingModelKeyPathListResponse,
    IncomingModelKeyPathIdRequest,
    IncomingModelKeyPathUpdateRequest,
    GetAllIncomingKeyPathsRequest,
    IncomingModelSemanticPatternRequest,
    IncomingModelSemanticPatternIdRequest,
    GetAllIncomingSemanticPatternsRequest,
    IncomingModelSemanticPatternUpdateRequest,
    IncomingModelSemanticPatternResponse,
    IncomingModelSemanticPatternsResponse,
    IncomingModelRegisterSemanticPatternRequest,
    IncomingModelRegisterSemanticPatternIdRequest,
    GetAllIncomingRegisterSemanticPatternsRequest,
    IncomingModelRegisterSemanticPatternUpdateRequest,
    IncomingModelRegisterSemanticPatternResponse,
    IncomingModelRegisterSemanticPatternsResponse,
    IncomingTemplateRequest,
    IncomingTemplateIdRequest,
    GetAllIncomingTemplatesRequest,
    IncomingTemplateUpdateRequest,
    IncomingTemplateResponse,
    IncomingTemplatesResponse,
    SubscriptionActivityLogRequest,
    GetAllSubscriptionActivityLogsRequest,
    SubscriptionActivityLogsResponse,
)
from iam_core.user_auth.decorators import require_permissions

from ..helpers import RequestResponseHelper
from ..config import Settings

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class G2PIngestionConfigurationController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.router.tags += ["/ingestion-config"]
        self.ingestion_config_service = G2PIngestionConfigurationControllerService.get_component()
        self.helper = RequestResponseHelper.get_component()
        self.router.prefix = "/ingestion-config"

        # IncomingModelKeyPath endpoints
        self.router.add_api_route(
            "/create_incoming_key_path",
            self.create_incoming_key_path,
            responses={200: {"model": IncomingModelKeyPathResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_incoming_key_path",
            self.get_incoming_key_path,
            responses={200: {"model": IncomingModelKeyPathResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_all_incoming_key_paths",
            self.get_all_incoming_key_paths,
            responses={200: {"model": IncomingModelKeyPathListResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/update_incoming_key_path",
            self.update_incoming_key_path,
            responses={200: {"model": IncomingModelKeyPathResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/delete_incoming_key_path",
            self.delete_incoming_key_path,
            responses={200: {"model": IncomingModelKeyPathResponse}},
            methods=["POST"],
        )

        # IncomingModelSemanticPattern endpoints
        self.router.add_api_route(
            "/create_semantic_pattern",
            self.create_semantic_pattern,
            responses={200: {"model": IncomingModelSemanticPatternResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_semantic_pattern",
            self.get_semantic_pattern,
            responses={200: {"model": IncomingModelSemanticPatternResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/update_semantic_pattern",
            self.update_semantic_pattern,
            responses={200: {"model": IncomingModelSemanticPatternResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_all_semantic_patterns",
            self.get_all_semantic_patterns,
            responses={200: {"model": IncomingModelSemanticPatternsResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/delete_semantic_pattern",
            self.delete_semantic_pattern,
            responses={200: {"model": IncomingModelSemanticPatternResponse}},
            methods=["POST"],
        )

        # IncomingModelRegisterSemanticPattern
        self.router.add_api_route(
            "/create_register_semantic_pattern",
            self.create_register_semantic_pattern,
            responses={200: {"model": IncomingModelRegisterSemanticPatternResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/get_register_semantic_pattern",
            self.get_register_semantic_pattern,
            responses={200: {"model": IncomingModelRegisterSemanticPatternResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/update_register_semantic_pattern",
            self.update_register_semantic_pattern,
            responses={200: {"model": IncomingModelRegisterSemanticPatternResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/get_all_register_semantic_patterns",
            self.get_all_register_semantic_patterns,
            responses={200: {"model": IncomingModelRegisterSemanticPatternsResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/delete_register_semantic_pattern",
            self.delete_register_semantic_pattern,
            responses={200: {"model": IncomingModelRegisterSemanticPatternResponse}},
            methods=["POST"],
        )

        # IncomingTemplate endpoints
        self.router.add_api_route(
            "/create_template",
            self.create_template,
            responses={200: {"model": IncomingTemplateResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_template",
            self.get_template,
            responses={200: {"model": IncomingTemplateResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_all_templates",
            self.get_all_templates,
            responses={200: {"model": IncomingTemplatesResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/update_template",
            self.update_template,
            responses={200: {"model": IncomingTemplateResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/delete_template",
            self.delete_template,
            responses={200: {"model": IncomingTemplateResponse}},
            methods=["POST"],
        )

        # SubscriptionActivityLog endpoints
        self.router.add_api_route(
            "/create_subscription_activity_log",
            self.create_subscription_activity_log,
            responses={200: {"model": SubscriptionActivityLogsResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_subscription_activity_logs_by_partner",
            self.get_subscription_activity_logs_by_partner,
            responses={200: {"model": SubscriptionActivityLogsResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_all_subscription_activity_logs",
            self.get_all_subscription_activity_logs,
            responses={200: {"model": SubscriptionActivityLogsResponse}},
            methods=["POST"],
        )

    # IncomingModelKeyPath Methods
    @require_permissions({"ingestKeyPath:create"})
    async def create_incoming_key_path(
        self, pattern_request: IncomingModelKeyPathRequest
    ) -> IncomingModelKeyPathResponse:
        try:
            pattern_data = await self.ingestion_config_service.create_incoming_key_path(
                pattern_request.request_body.request_payload
            )
            return self.helper.construct_ingestion_config_success_response(
                pattern_data, IncomingModelKeyPathResponse, pattern_request
            )
        except Exception as error:
            return self.helper.construct_error_response(error, pattern_request)

    @require_permissions({"ingestKeyPath:view"})
    async def get_incoming_key_path(
        self, pattern_request: IncomingModelKeyPathIdRequest
    ) -> IncomingModelKeyPathResponse:
        try:
            key_path_data = await self.ingestion_config_service.get_incoming_key_path(
                pattern_request.request_body.request_payload.key_path_id
            )
            return self.helper.construct_ingestion_config_success_response(
                key_path_data, IncomingModelKeyPathResponse, pattern_request
            )
        except Exception as error:
            return self.helper.construct_error_response(error, pattern_request)

    @require_permissions({"ingestKeyPath:view"})
    async def get_all_incoming_key_paths(
        self, pattern_request: GetAllIncomingKeyPathsRequest
    ) -> IncomingModelKeyPathListResponse:
        try:
            pagination_request = getattr(pattern_request.request_body, "pagination_request", None)
            current_page = getattr(pagination_request, "current_page", None)
            page_size = getattr(pagination_request, "page_size", None)
            key_paths_data, total_items, number_of_pages = (
                await self.ingestion_config_service.get_all_incoming_key_paths(
                    current_page,
                    page_size,
                )
            )
            return self.helper.construct_ingestion_config_success_response(
                key_paths_data,
                IncomingModelKeyPathListResponse,
                pattern_request,
                total_items,
                number_of_pages,
            )
        except Exception as error:
            return self.helper.construct_error_response(error, pattern_request)

    @require_permissions({"ingestKeyPath:delete"})
    async def delete_incoming_key_path(
        self, pattern_request: IncomingModelKeyPathIdRequest
    ) -> IncomingModelKeyPathResponse:
        try:
            key_path_data = await self.ingestion_config_service.delete_incoming_key_path(
                pattern_request.request_body.request_payload.key_path_id
            )
            return self.helper.construct_ingestion_config_success_response(
                key_path_data, IncomingModelKeyPathResponse, pattern_request
            )
        except Exception as error:
            return self.helper.construct_error_response(error, pattern_request)

    @require_permissions({"ingestKeyPath:edit"})
    async def update_incoming_key_path(
        self, pattern_request: IncomingModelKeyPathUpdateRequest
    ) -> IncomingModelKeyPathResponse:
        try:
            pattern_data = await self.ingestion_config_service.update_incoming_key_path(
                pattern_request.request_body.request_payload.key_path_id,
                pattern_request.request_body.request_payload,
            )
            return self.helper.construct_ingestion_config_success_response(
                pattern_data, IncomingModelKeyPathResponse, pattern_request
            )
        except Exception as error:
            return self.helper.construct_error_response(error, pattern_request)

    @require_permissions({"ingestExpression:create"})
    async def create_semantic_pattern(
        self, pattern_request: IncomingModelSemanticPatternRequest
    ) -> IncomingModelSemanticPatternResponse:
        try:
            pattern_data = await self.ingestion_config_service.create_semantic_pattern(
                pattern_request.request_body.request_payload
            )
            return self.helper.construct_ingestion_config_success_response(
                pattern_data, IncomingModelSemanticPatternResponse, pattern_request
            )
        except Exception as error:
            return self.helper.construct_error_response(error, pattern_request)

    @require_permissions({"ingestExpression:view"})
    async def get_semantic_pattern(
        self, pattern_request: IncomingModelSemanticPatternIdRequest
    ) -> IncomingModelSemanticPatternResponse:
        try:
            pattern_data = await self.ingestion_config_service.get_semantic_pattern(
                pattern_request.request_body.request_payload.semantic_pattern_id
            )
            return self.helper.construct_ingestion_config_success_response(
                pattern_data, IncomingModelSemanticPatternResponse, pattern_request
            )
        except Exception as error:
            return self.helper.construct_error_response(error, pattern_request)

    @require_permissions({"ingestExpression:edit"})
    async def update_semantic_pattern(
        self, pattern_request: IncomingModelSemanticPatternUpdateRequest
    ) -> IncomingModelSemanticPatternResponse:
        try:
            pattern_data = await self.ingestion_config_service.update_semantic_pattern(
                pattern_request.request_body.request_payload.semantic_pattern_id,
                pattern_request.request_body.request_payload
            )
            return self.helper.construct_ingestion_config_success_response(
                pattern_data, IncomingModelSemanticPatternResponse, pattern_request
            )
        except Exception as error:
            return self.helper.construct_error_response(error, pattern_request)

    @require_permissions({"ingestExpression:view"})
    async def get_all_semantic_patterns(
        self, pattern_request: GetAllIncomingSemanticPatternsRequest
    ) -> IncomingModelSemanticPatternsResponse:
        try:
            pagination_request = getattr(pattern_request.request_body, "pagination_request", None)
            current_page = getattr(pagination_request, "current_page", None)
            page_size = getattr(pagination_request, "page_size", None)
            pattern_data, total_items, number_of_pages = (
                await self.ingestion_config_service.get_all_semantic_patterns(
                    current_page,
                    page_size,
                )
            )
            return self.helper.construct_ingestion_config_success_response(
                pattern_data,
                IncomingModelSemanticPatternsResponse,
                pattern_request,
                total_items,
                number_of_pages,
            )
        except Exception as error:
            return self.helper.construct_error_response(error, pattern_request)

    @require_permissions({"ingestExpression:delete"})
    async def delete_semantic_pattern(
        self, pattern_request: IncomingModelSemanticPatternIdRequest
    ) -> IncomingModelSemanticPatternResponse:
        try:
            pattern_data = await self.ingestion_config_service.delete_semantic_pattern(
                pattern_request.request_body.request_payload.semantic_pattern_id
            )
            return self.helper.construct_ingestion_config_success_response(
                pattern_data, IncomingModelSemanticPatternResponse, pattern_request
            )
        except Exception as error:
            return self.helper.construct_error_response(error, pattern_request)

    @require_permissions({"ingestExpression:create"})
    async def create_register_semantic_pattern(
        self, pattern_request: IncomingModelRegisterSemanticPatternRequest
    ) -> IncomingModelRegisterSemanticPatternResponse:
        try:
            pattern_data = await self.ingestion_config_service.create_register_semantic_pattern(
                pattern_request.request_body.request_payload
            )
            return self.helper.construct_ingestion_config_success_response(
                pattern_data, IncomingModelRegisterSemanticPatternResponse, pattern_request
            )
        except Exception as error:
            return self.helper.construct_error_response(error, pattern_request)

    @require_permissions({"ingestExpression:view"})
    async def get_register_semantic_pattern(
        self, pattern_request: IncomingModelRegisterSemanticPatternIdRequest
    ) -> IncomingModelRegisterSemanticPatternResponse:
        try:
            pattern_data = await self.ingestion_config_service.get_register_semantic_pattern(
                pattern_request.request_body.request_payload.register_semantic_pattern_id
            )
            return self.helper.construct_ingestion_config_success_response(
                pattern_data, IncomingModelRegisterSemanticPatternResponse, pattern_request
            )
        except Exception as error:
            return self.helper.construct_error_response(error, pattern_request)

    @require_permissions({"ingestExpression:edit"})
    async def update_register_semantic_pattern(
        self, pattern_request: IncomingModelRegisterSemanticPatternUpdateRequest
    ) -> IncomingModelRegisterSemanticPatternResponse:
        try:
            pattern_data = await self.ingestion_config_service.update_register_semantic_pattern(
                pattern_request.request_body.request_payload
            )
            return self.helper.construct_ingestion_config_success_response(
                pattern_data, IncomingModelRegisterSemanticPatternResponse, pattern_request
            )
        except Exception as error:
            return self.helper.construct_error_response(error, pattern_request)

    @require_permissions({"ingestExpression:view"})
    async def get_all_register_semantic_patterns(
        self, pattern_request: GetAllIncomingRegisterSemanticPatternsRequest
    ) -> IncomingModelRegisterSemanticPatternsResponse:
        try:
            pagination_request = getattr(pattern_request.request_body, "pagination_request", None)
            current_page = getattr(pagination_request, "current_page", None)
            page_size = getattr(pagination_request, "page_size", None)
            pattern_data, total_items, number_of_pages = (
                await self.ingestion_config_service.get_all_register_semantic_patterns(
                    current_page,
                    page_size,
                )
            )
            return self.helper.construct_ingestion_config_success_response(
                pattern_data,
                IncomingModelRegisterSemanticPatternsResponse,
                pattern_request,
                total_items,
                number_of_pages,
            )
        except Exception as error:
            return self.helper.construct_error_response(error, pattern_request)

    @require_permissions({"ingestExpression:delete"})
    async def delete_register_semantic_pattern(
        self, pattern_request: IncomingModelRegisterSemanticPatternIdRequest
    ) -> IncomingModelRegisterSemanticPatternResponse:
        try:
            pattern_data = await self.ingestion_config_service.delete_register_semantic_pattern(
                pattern_request.request_body.request_payload.register_semantic_pattern_id
            )
            return self.helper.construct_ingestion_config_success_response(
                pattern_data, IncomingModelRegisterSemanticPatternResponse, pattern_request
            )
        except Exception as error:
            return self.helper.construct_error_response(error, pattern_request)

    @require_permissions({"ingestTemplate:create"})
    async def create_template(
        self, template_request: IncomingTemplateRequest
    ) -> IncomingTemplateResponse:
        try:
            template_data = await self.ingestion_config_service.create_template(
                template_request.request_body.request_payload
            )
            return self.helper.construct_ingestion_config_success_response(
                template_data, IncomingTemplateResponse, template_request
            )
        except Exception as error:
            return self.helper.construct_error_response(error, template_request)

    @require_permissions({"ingestTemplate:view"})
    async def get_template(self, template_request: IncomingTemplateIdRequest) -> IncomingTemplateResponse:
        try:
            template_data = await self.ingestion_config_service.get_template(
                template_request.request_body.request_payload.template_id
            )
            return self.helper.construct_ingestion_config_success_response(
                template_data, IncomingTemplateResponse, template_request
            )
        except Exception as error:
            return self.helper.construct_error_response(error, template_request)

    @require_permissions({"ingestTemplate:view"})
    async def get_all_templates(
        self, template_request: GetAllIncomingTemplatesRequest
    ) -> IncomingTemplatesResponse:
        try:
            pagination_request = getattr(template_request.request_body, "pagination_request", None)
            current_page = getattr(pagination_request, "current_page", None)
            page_size = getattr(pagination_request, "page_size", None)
            template_data, total_items, number_of_pages = (
                await self.ingestion_config_service.get_all_templates(
                    current_page,
                    page_size,
                )
            )
            return self.helper.construct_ingestion_config_success_response(
                template_data,
                IncomingTemplatesResponse,
                template_request,
                total_items,
                number_of_pages,
            )
        except Exception as error:
            return self.helper.construct_error_response(error, template_request)

    @require_permissions({"ingestTemplate:edit"})
    async def update_template(
        self, template_update_request: IncomingTemplateUpdateRequest
    ) -> IncomingTemplateResponse:
        try:
            template_data = await self.ingestion_config_service.update_template(
                template_update_request.request_body.request_payload
            )
            return self.helper.construct_ingestion_config_success_response(
                template_data, IncomingTemplateResponse, template_update_request
            )
        except Exception as error:
            return self.helper.construct_error_response(error, template_update_request)
    
    @require_permissions({"ingestTemplate:delete"})
    async def delete_template(self, template_delete_request: IncomingTemplateIdRequest) -> IncomingTemplateResponse:
        try:
            template_data = await self.ingestion_config_service.delete_template(
                template_delete_request.request_body.request_payload.template_id
            )
            return self.helper.construct_ingestion_config_success_response(
                template_data, IncomingTemplateResponse, template_delete_request
            )
        except Exception as error:
            return self.helper.construct_error_response(error, template_delete_request)

    @require_permissions({"ingestSubscription:create"})
    async def create_subscription_activity_log(
        self, subscription_activity_log_request: SubscriptionActivityLogRequest
    ) -> SubscriptionActivityLogsResponse:
        try:
            activity_log_data = await self.ingestion_config_service.create_subscription_activity_log(
                subscription_activity_log_request.request_body.request_payload
            )
            return self.helper.construct_ingestion_config_success_response(
                [activity_log_data], SubscriptionActivityLogsResponse, subscription_activity_log_request
            )
        except Exception as error:
            return self.helper.construct_error_response(error, subscription_activity_log_request)

    @require_permissions({"ingestSubscription:view"})
    async def get_subscription_activity_logs_by_partner(
        self, activity_log_request: SubscriptionActivityLogRequest
    ) -> SubscriptionActivityLogsResponse:
        try:
            activity_logs_data = await self.ingestion_config_service.get_subscription_activity_logs_by_partner(
                activity_log_request.request_body.request_payload.partner_id
            )
            return self.helper.construct_ingestion_config_success_response(
                activity_logs_data, SubscriptionActivityLogsResponse, activity_log_request
            )
        except Exception as error:
            return self.helper.construct_error_response(error, activity_log_request)

    @require_permissions({"ingestSubscription:view"})
    async def get_all_subscription_activity_logs(
        self, activity_log_request: GetAllSubscriptionActivityLogsRequest
    ) -> SubscriptionActivityLogsResponse:
        try:
            pagination_request = getattr(activity_log_request.request_body, "pagination_request", None)
            current_page = getattr(pagination_request, "current_page", None)
            page_size = getattr(pagination_request, "page_size", None)
            activity_logs_data, total_items, number_of_pages = (
                await self.ingestion_config_service.get_all_subscription_activity_logs(
                    current_page,
                    page_size,
                )
            )
            return self.helper.construct_ingestion_config_success_response(
                activity_logs_data,
                SubscriptionActivityLogsResponse,
                activity_log_request,
                total_items,
                number_of_pages,
            )
        except Exception as error:
            return self.helper.construct_error_response(error, activity_log_request)
