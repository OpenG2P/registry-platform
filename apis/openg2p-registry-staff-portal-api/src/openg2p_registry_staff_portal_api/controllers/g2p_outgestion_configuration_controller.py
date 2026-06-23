import logging
from openg2p_fastapi_common.controller import BaseController

from openg2p_registry_core.controller_services import G2POutgestionConfigurationControllerService
from openg2p_registry_core.schemas import (
    GetAllOutgoingTopicsRequest,
    GetAllOutgoingTemplatesRequest,
    OutgoingTopicData,
    OutgoingTopicIdRequest,
    OutgoingTopicRequest,
    OutgoingTopicsResponse,
    OutgoingTopicUpdateRequest,
    OutgoingTopicResponse,
    OutgoingTemplateData,
    OutgoingTemplateIdRequest,
    OutgoingTemplateRequest,
    OutgoingTemplatesResponse,
    OutgoingTemplateUpdateRequest,
    OutgoingTemplateResponse,
)
from iam_core.user_auth.decorators import require_permissions

from ..helpers import RequestResponseHelper
from ..config import Settings

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class G2POutgestionConfigurationController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.router.tags += ["/outgestion-config"]
        self.outgestion_config_service = G2POutgestionConfigurationControllerService.get_component()
        self.helper = RequestResponseHelper.get_component()
        self.router.prefix = "/outgestion-config"

        # Websub Topic endpoints
        self.router.add_api_route(
            "/create_topic",
            self.create_outgoing_topic,
            responses={200: {"model": OutgoingTopicResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_all_topics",
            self.get_all_outgoing_topics,
            responses={200: {"model": OutgoingTopicsResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_topic",
            self.get_outgoing_topic,
            responses={200: {"model": OutgoingTopicResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/update_topic",
            self.update_outgoing_topic,
            responses={200: {"model": OutgoingTopicResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/toggle_topicstatus",
            self.toggle_outgoing_topic_status,
            responses={200: {"model": OutgoingTopicResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/re_register_topic",
            self.re_register_outgoing_topic,
            responses={200: {"model": OutgoingTopicResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/delete_topic",
            self.delete_outgoing_topic,
            responses={200: {"model": OutgoingTopicResponse}},
            methods=["POST"],
        )

        # OutgoingTemplate endpoints
        self.router.add_api_route(
            "/create_template",
            self.create_template,
            responses={200: {"model": OutgoingTemplateResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_template",
            self.get_template,
            responses={200: {"model": OutgoingTemplateResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_all_templates",
            self.get_all_templates,
            responses={200: {"model": OutgoingTemplatesResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/update_template",
            self.update_template,
            responses={200: {"model": OutgoingTemplateResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/delete_template",
            self.delete_template,
            responses={200: {"model": OutgoingTemplateResponse}},
            methods=["POST"],
        )


    @require_permissions({"outgestTopic:create"})
    async def create_outgoing_topic(
        self, topic_request: OutgoingTopicRequest
    ) -> OutgoingTopicResponse:
        try:
            topic_data: OutgoingTopicData = await self.outgestion_config_service.create_outgoing_topic(
                topic_request.request_body.request_payload
            )
            return self.helper.construct_outgestion_config_success_response(
                topic_data, OutgoingTopicResponse, topic_request
            )
        except Exception as error:
            return self.helper.construct_error_response(error, topic_request)

    @require_permissions({"outgestTopic:view"})
    async def get_outgoing_topic(self, topic_request: OutgoingTopicIdRequest) -> OutgoingTopicResponse:
        try:
            topic_data: OutgoingTopicData = await self.outgestion_config_service.get_outgoing_topic(
                topic_request.request_body.request_payload.topic_id
            )
            return self.helper.construct_outgestion_config_success_response(
                topic_data, OutgoingTopicResponse, topic_request
            )
        except Exception as error:
            return self.helper.construct_error_response(error, topic_request)

    @require_permissions({"outgestTopic:view"})
    async def get_all_outgoing_topics(
        self, topic_request: GetAllOutgoingTopicsRequest
    ) -> OutgoingTopicsResponse:
        try:
            pagination_request = getattr(topic_request.request_body, "pagination_request", None)
            current_page = getattr(pagination_request, "current_page", None)
            page_size = getattr(pagination_request, "page_size", None)
            topics_data, total_items, number_of_pages = (
                await self.outgestion_config_service.get_all_outgoing_topics(
                    current_page,
                    page_size,
                )
            )
            return self.helper.construct_outgestion_config_success_response(
                topics_data,
                OutgoingTopicsResponse,
                topic_request,
                total_items,
                number_of_pages,
            )
        except Exception as error:
            return self.helper.construct_error_response(error, topic_request)

    @require_permissions({"outgestTopic:edit"})
    async def update_outgoing_topic(
        self, topic_update_request: OutgoingTopicUpdateRequest
    ) -> OutgoingTopicResponse:
        try:
            topic_data: OutgoingTopicData = await self.outgestion_config_service.update_outgoing_topic(
                topic_update_request.request_body.request_payload
            )
            return self.helper.construct_outgestion_config_success_response(
                topic_data, OutgoingTopicResponse, topic_update_request
            )
        except Exception as error:
            return self.helper.construct_error_response(error, topic_update_request)
        
    @require_permissions({"outgestTopic:edit"})
    async def toggle_outgoing_topic_status(
        self, topic_update_request: OutgoingTopicIdRequest
    ) -> OutgoingTopicResponse:
        try:
            topic_data = await self.outgestion_config_service.toggle_outgoing_topic_status(
                topic_update_request.request_body.request_payload.topic_id
            )
            return self.helper.construct_outgestion_config_success_response(
                topic_data, OutgoingTopicResponse, topic_update_request
            )
        except Exception as error:
            return self.helper.construct_error_response(error, topic_update_request)

    @require_permissions({"outgestTopic:edit"})
    async def re_register_outgoing_topic(
        self, topic_update_request: OutgoingTopicIdRequest
    ) -> OutgoingTopicResponse:
        try:
            topic_data = await self.outgestion_config_service.re_register_outgoing_topic(
                topic_update_request.request_body.request_payload.topic_id
            )
            return self.helper.construct_outgestion_config_success_response(
                topic_data, OutgoingTopicResponse, topic_update_request
            )
        except Exception as error:
            return self.helper.construct_error_response(error, topic_update_request)

    @require_permissions({"outgestTopic:delete"})
    async def delete_outgoing_topic(
        self, topic_update_request: OutgoingTopicIdRequest
    ) -> OutgoingTopicResponse:
        try:
            topic_data = await self.outgestion_config_service.delete_outgoing_topic(
                topic_update_request.request_body.request_payload.topic_id
            )
            return self.helper.construct_outgestion_config_success_response(
                topic_data, OutgoingTopicResponse, topic_update_request
            )
        except Exception as error:
            return self.helper.construct_error_response(error, topic_update_request)
    

    @require_permissions({"outgestTemplate:create"})
    async def create_template(
        self, template_request: OutgoingTemplateRequest
    ) -> OutgoingTemplateResponse:
        try:
            template_data: OutgoingTemplateData = await self.outgestion_config_service.create_template(
                template_request.request_body.request_payload
            )
            return self.helper.construct_outgestion_config_success_response(
                template_data, OutgoingTemplateResponse, template_request
            )
        except Exception as error:
            return self.helper.construct_error_response(error, template_request)

    @require_permissions({"outgestTemplate:view"})
    async def get_template(self, template_request: OutgoingTemplateIdRequest) -> OutgoingTemplateResponse:
        try:
            template_data: OutgoingTemplateData = await self.outgestion_config_service.get_template(
                template_request.request_body.request_payload.template_id
            )
            return self.helper.construct_outgestion_config_success_response(
                template_data, OutgoingTemplateResponse, template_request
            )
        except Exception as error:
            return self.helper.construct_error_response(error, template_request)

    @require_permissions({"outgestTemplate:view"})
    async def get_all_templates(
        self, template_request: GetAllOutgoingTemplatesRequest
    ) -> OutgoingTemplatesResponse:
        try:
            pagination_request = getattr(template_request.request_body, "pagination_request", None)
            current_page = getattr(pagination_request, "current_page", None)
            page_size = getattr(pagination_request, "page_size", None)
            template_data, total_items, number_of_pages = (
                await self.outgestion_config_service.get_all_templates(
                    current_page,
                    page_size,
                )
            )
            return self.helper.construct_outgestion_config_success_response(
                template_data,
                OutgoingTemplatesResponse,
                template_request,
                total_items,
                number_of_pages,
            )
        except Exception as error:
            return self.helper.construct_error_response(error, template_request)

    @require_permissions({"outgestTemplate:edit"})
    async def update_template(
        self, template_update_request: OutgoingTemplateUpdateRequest
    ) -> OutgoingTemplateResponse:
        try:
            template_data: OutgoingTemplateData = await self.outgestion_config_service.update_template(
                template_update_request.request_body.request_payload
            )
            return self.helper.construct_outgestion_config_success_response(
                template_data, OutgoingTemplateResponse, template_update_request
            )
        except Exception as error:
            return self.helper.construct_error_response(error, template_update_request)

    @require_permissions({"outgestTemplate:delete"})
    async def delete_template(self, template_delete_request: OutgoingTemplateIdRequest) -> OutgoingTemplateResponse:
        try:
            template_data: OutgoingTemplateData = await self.outgestion_config_service.delete_template(
                template_delete_request.request_body.request_payload.template_id
            )
            return self.helper.construct_outgestion_config_success_response(
                template_data, OutgoingTemplateResponse, template_delete_request
            )
        except Exception as error:
            return self.helper.construct_error_response(error, template_delete_request)
