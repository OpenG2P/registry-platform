import logging

from fastapi import Request
from iam_core.user_auth.decorators import requires_auth
from openg2p_fastapi_common.controller import BaseController
from openg2p_fastapi_common.schemas import G2PResponse

from openg2p_registry_core.controller_services import G2PAweProxyControllerService
from openg2p_registry_core.errors import G2PRegistryErrorCodes, G2PRegistryException
from openg2p_registry_core.helpers.auth_token import bearer_from_request
from openg2p_registry_core.schemas.awe_proxy import (
    AweProxyDataResponse,
    AweProxyDataResponseBody,
    AweProxyDataResponsePayload,
    AweProxyListDataResponse,
    AweProxyListDataResponseBody,
    ClaimAweTaskRequest,
    GetAweRequestEventsRequest,
    GetAweRequestRequest,
    ListMyAweTasksRequest,
    ListTasksForRequestRequest,
    MyAweTaskStatsRequest,
    SubmitAweTaskDecisionRequest,
)

from ..config import Settings
from ..helpers import RequestResponseHelper

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class G2PAweProxyController(BaseController):
    """JWT-authenticated proxy to AWE for staff UI (tasks, requests, events)."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.router.tags += ["/awe"]
        self.router.prefix = "/awe"
        self.service = G2PAweProxyControllerService.get_component()
        self.helper = RequestResponseHelper.get_component()

        self.router.add_api_route(
            "/list_my_tasks",
            self.list_my_tasks,
            responses={200: {"model": AweProxyDataResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/list_tasks_for_request",
            self.list_tasks_for_request,
            responses={200: {"model": AweProxyDataResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/my_task_stats",
            self.my_task_stats,
            responses={200: {"model": AweProxyDataResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/submit_task_decision",
            self.submit_task_decision,
            responses={200: {"model": AweProxyDataResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/claim_task",
            self.claim_task,
            responses={200: {"model": AweProxyDataResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/get_request",
            self.get_request,
            responses={200: {"model": AweProxyDataResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/get_request_events",
            self.get_request_events,
            responses={200: {"model": AweProxyListDataResponse}},
            methods=["POST"],
        )

    def _bearer(self, request: Request) -> str:
        token = bearer_from_request(request)
        if not token:
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.AWE_BEARER_TOKEN_REQUIRED.value[1],
                message=G2PRegistryErrorCodes.AWE_BEARER_TOKEN_REQUIRED.value[0],
            )
        return token

    @requires_auth
    async def list_my_tasks(
        self,
        request: Request,
        g2p_request: ListMyAweTasksRequest,
    ) -> G2PResponse:
        try:
            data = await self.service.list_my_tasks(
                g2p_request.request_body.request_payload,
                bearer_token=self._bearer(request),
            )
            return self.helper.construct_success_response(
                AweProxyDataResponseBody(response_payload=AweProxyDataResponsePayload(data=data)),
                g2p_request,
            )
        except Exception as exc:
            _logger.error("Error in list_my_tasks: %s", exc)
            return self.helper.construct_error_response(exc, g2p_request)

    @requires_auth
    async def list_tasks_for_request(
        self,
        request: Request,
        g2p_request: ListTasksForRequestRequest,
    ) -> G2PResponse:
        try:
            data = await self.service.list_tasks_for_request(
                g2p_request.request_body.request_payload,
                bearer_token=self._bearer(request),
            )
            return self.helper.construct_success_response(
                AweProxyDataResponseBody(response_payload=AweProxyDataResponsePayload(data=data)),
                g2p_request,
            )
        except Exception as exc:
            _logger.error("Error in list_tasks_for_request: %s", exc)
            return self.helper.construct_error_response(exc, g2p_request)

    @requires_auth
    async def my_task_stats(
        self,
        request: Request,
        g2p_request: MyAweTaskStatsRequest,
    ) -> G2PResponse:
        try:
            data = await self.service.my_task_stats(
                g2p_request.request_body.request_payload,
                bearer_token=self._bearer(request),
            )
            return self.helper.construct_success_response(
                AweProxyDataResponseBody(response_payload=AweProxyDataResponsePayload(data=data)),
                g2p_request,
            )
        except Exception as exc:
            _logger.error("Error in my_task_stats: %s", exc)
            return self.helper.construct_error_response(exc, g2p_request)

    @requires_auth
    async def submit_task_decision(
        self,
        request: Request,
        g2p_request: SubmitAweTaskDecisionRequest,
    ) -> G2PResponse:
        try:
            data = await self.service.submit_task_decision(
                g2p_request.request_body.request_payload,
                bearer_token=self._bearer(request),
            )
            return self.helper.construct_success_response(
                AweProxyDataResponseBody(response_payload=AweProxyDataResponsePayload(data=data)),
                g2p_request,
            )
        except Exception as exc:
            _logger.error("Error in submit_task_decision: %s", exc)
            return self.helper.construct_error_response(exc, g2p_request)

    @requires_auth
    async def claim_task(
        self,
        request: Request,
        g2p_request: ClaimAweTaskRequest,
    ) -> G2PResponse:
        try:
            data = await self.service.claim_task(
                g2p_request.request_body.request_payload,
                bearer_token=self._bearer(request),
            )
            return self.helper.construct_success_response(
                AweProxyDataResponseBody(response_payload=AweProxyDataResponsePayload(data=data)),
                g2p_request,
            )
        except Exception as exc:
            _logger.error("Error in claim_task: %s", exc)
            return self.helper.construct_error_response(exc, g2p_request)

    @requires_auth
    async def get_request(
        self,
        request: Request,
        g2p_request: GetAweRequestRequest,
    ) -> G2PResponse:
        try:
            data = await self.service.get_request(
                g2p_request.request_body.request_payload,
                bearer_token=self._bearer(request),
            )
            return self.helper.construct_success_response(
                AweProxyDataResponseBody(response_payload=AweProxyDataResponsePayload(data=data)),
                g2p_request,
            )
        except Exception as exc:
            _logger.error("Error in get_request: %s", exc)
            return self.helper.construct_error_response(exc, g2p_request)

    @requires_auth
    async def get_request_events(
        self,
        request: Request,
        g2p_request: GetAweRequestEventsRequest,
    ) -> G2PResponse:
        try:
            data = await self.service.get_request_events(
                g2p_request.request_body.request_payload,
                bearer_token=self._bearer(request),
            )
            return self.helper.construct_success_response(
                AweProxyListDataResponseBody(response_payload=data),
                g2p_request,
            )
        except Exception as exc:
            _logger.error("Error in get_request_events: %s", exc)
            return self.helper.construct_error_response(exc, g2p_request)
