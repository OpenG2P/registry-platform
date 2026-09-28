import logging
from typing import Any, Awaitable, Optional

from fastapi import Request
from iam_core.user_auth.decorators import data_policy, require_permissions
from openg2p_fastapi_common.controller import BaseController
from openg2p_fastapi_common.schemas import G2PPaginationResponse, G2PRequest, G2PResponseBody
from openg2p_registry_core.controller_services import G2PActivityControllerService, pagination_response
from openg2p_registry_core.models import ActivityChannelEnum
from openg2p_registry_core.schemas import (
    ActivityResponse,
    ActivityStatusChangeRequest,
    ActivityTimelineRequest,
    ActivityTypeSchemaRequest,
    AggregateHistoryRequest,
    AppendActivitiesRequest,
    AppendActivityRequest,
    ComputeIndicatorRequest,
    EmptyRequest,
    ContextStatusChangeRequest,
    GetActivityRequest,
    GetProjectionRequest,
    LatestActivityRequest,
    LockPeriodRequest,
    OpenContextRequest,
    RebuildProjectionsRequest,
    RegisterMnemonicRequest,
    ResolveTemporaryReferenceRequest,
    SearchActivitiesRequest,
    SearchAggregatesRequest,
    SearchContextsRequest,
    SearchProjectionsRequest,
    SubjectActivitiesRequest,
    SupersedeActivityRequest,
    UnlockPeriodRequest,
    WorkListRequest,
)
from openg2p_registry_core.services import G2PActivityIndicatorService, G2PActivityService

from ..config import Settings
from ..helpers import RequestResponseHelper
from ..helpers.data_policy_request_helper import get_data_policies

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)

VIEW = {"activity:view"}
CREATE = {"activity:create"}
CORRECT = {"activity:correct"}
VERIFY = {"activity:verify"}
CONFIGURE = {"activity:configure"}


def _actor(request: Request) -> str:
    auth = getattr(request.state, "auth", None)
    return (
        getattr(auth, "preferred_username", None)
        or getattr(auth, "name", None)
        or getattr(auth, "sub", None)
        or "unknown"
    )


class G2PActivityController(BaseController):
    """Activity registers: append-only records of things that happened (sowing, attendance, …)."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.router.tags += ["/activity"]
        self.router.prefix = "/activity"
        self.helper = RequestResponseHelper.get_component()
        self.controller_service = G2PActivityControllerService.get_component()
        self.activities = G2PActivityService.get_component()
        self.indicators = G2PActivityIndicatorService.get_component()

        routes = [
            ("/get_activity_registers", self.get_activity_registers),
            ("/get_activity_types", self.get_activity_types),
            ("/append_activity", self.append_activity),
            ("/append_activities", self.append_activities),
            ("/supersede_activity", self.supersede_activity),
            ("/void_activity", self.void_activity),
            ("/verify_activity", self.verify_activity),
            ("/reject_activity", self.reject_activity),
            ("/get_activity", self.get_activity),
            ("/search_activities", self.search_activities),
            ("/get_timeline", self.get_timeline),
            ("/search_contexts", self.search_contexts),
            ("/open_context", self.open_context),
            ("/close_context", self.close_context),
            ("/reopen_context", self.reopen_context),
            ("/get_work_list", self.get_work_list),
            ("/get_projection", self.get_projection),
            ("/search_projections", self.search_projections),
            ("/get_indicators", self.get_indicators),
            ("/compute_indicator", self.compute_indicator),
            ("/lock_period", self.lock_period),
            ("/unlock_period", self.unlock_period),
            ("/get_period_locks", self.get_period_locks),
            ("/get_temporary_references", self.get_temporary_references),
            ("/resolve_temporary_reference", self.resolve_temporary_reference),
            ("/rebuild_projections", self.rebuild_projections),
            ("/get_subject_activities", self.get_subject_activities),
            ("/get_latest_activity", self.get_latest_activity),
            ("/search_aggregates", self.search_aggregates),
            ("/get_aggregate_history", self.get_aggregate_history),
            ("/get_activity_type_schemas", self.get_activity_type_schemas),
        ]
        for path, endpoint in routes:
            self.router.add_api_route(path, endpoint, responses={200: {"model": ActivityResponse}}, methods=["POST"])

    async def _respond(
        self,
        g2p_request: G2PRequest,
        work: Awaitable[Any],
        paginated: bool = False,
    ) -> ActivityResponse:
        try:
            result = await work
            pagination: Optional[G2PPaginationResponse] = None
            if paginated:
                result, total = result
                pagination = pagination_response(total, g2p_request.request_body.pagination_request)
            return self.helper.construct_success_response(
                G2PResponseBody(response_payload=result), g2p_request, pagination
            )
        except Exception as error:
            _logger.error("Activity request failed: %s", error)
            return self.helper.construct_error_response(error, g2p_request)

    # ---------------------------------------------------------------- metadata

    @require_permissions(VIEW)
    async def get_activity_registers(self, request: EmptyRequest) -> ActivityResponse:
        return await self._respond(request, self.controller_service.get_activity_registers())

    @require_permissions(VIEW)
    async def get_activity_types(self, request: RegisterMnemonicRequest) -> ActivityResponse:
        return await self._respond(
            request, self.controller_service.get_activity_types(request.request_body.request_payload.register_mnemonic)
        )

    # ----------------------------------------------------------------- writing

    @require_permissions(CREATE)
    async def append_activity(self, http_request: Request, request: AppendActivityRequest) -> ActivityResponse:
        async def work():
            data, outcome = await self.activities.append(
                request.request_body.request_payload, _actor(http_request), ActivityChannelEnum.STAFF_PORTAL.value
            )
            return {"outcome": outcome, "activity": data}

        return await self._respond(request, work())

    @require_permissions(CREATE)
    async def append_activities(self, http_request: Request, request: AppendActivitiesRequest) -> ActivityResponse:
        payload = request.request_body.request_payload
        return await self._respond(
            request,
            self.activities.append_many(
                payload.activities, _actor(http_request), ActivityChannelEnum.STAFF_PORTAL.value,
                atomic=payload.atomic, submission_id=payload.submission_id,
            ),
        )

    @require_permissions(CORRECT)
    async def supersede_activity(self, http_request: Request, request: SupersedeActivityRequest) -> ActivityResponse:
        p = request.request_body.request_payload
        return await self._respond(
            request,
            self.activities.supersede(
                p.register_mnemonic, p.activity_id, p.reason, _actor(http_request),
                ActivityChannelEnum.STAFF_PORTAL.value, p.occurred_at, p.occurred_on_ec, p.payload, p.idempotency_key,
            ),
        )

    @require_permissions(CORRECT)
    async def void_activity(self, http_request: Request, request: ActivityStatusChangeRequest) -> ActivityResponse:
        p = request.request_body.request_payload
        return await self._respond(
            request, self.activities.void(p.register_mnemonic, p.activity_id, p.reason, _actor(http_request))
        )

    @require_permissions(VERIFY)
    async def verify_activity(self, http_request: Request, request: ActivityStatusChangeRequest) -> ActivityResponse:
        p = request.request_body.request_payload
        return await self._respond(
            request, self.activities.verify(p.register_mnemonic, p.activity_id, _actor(http_request), p.reason, True)
        )

    @require_permissions(VERIFY)
    async def reject_activity(self, http_request: Request, request: ActivityStatusChangeRequest) -> ActivityResponse:
        p = request.request_body.request_payload
        return await self._respond(
            request, self.activities.verify(p.register_mnemonic, p.activity_id, _actor(http_request), p.reason, False)
        )

    # ----------------------------------------------------------------- reading

    @require_permissions(VIEW)
    @data_policy
    async def get_activity(self, http_request: Request, request: GetActivityRequest) -> ActivityResponse:
        p = request.request_body.request_payload
        return await self._respond(
            request, self.activities.get(p.register_mnemonic, p.activity_id, get_data_policies(http_request))
        )

    @require_permissions(VIEW)
    @data_policy
    async def search_activities(self, http_request: Request, request: SearchActivitiesRequest) -> ActivityResponse:
        return await self._respond(
            request,
            self.activities.search(
                request.request_body.request_payload,
                request.request_body.pagination_request,
                get_data_policies(http_request),
            ),
            paginated=True,
        )

    @require_permissions(VIEW)
    @data_policy
    async def get_timeline(self, http_request: Request, request: ActivityTimelineRequest) -> ActivityResponse:
        p = request.request_body.request_payload
        return await self._respond(
            request,
            self.activities.timeline(
                p.register_mnemonic, p.context_id, p.subject_id, p.include_inactive, get_data_policies(http_request)
            ),
        )

    # ---------------------------------------------------------------- contexts

    @require_permissions(VIEW)
    async def search_contexts(self, request: SearchContextsRequest) -> ActivityResponse:
        return await self._respond(
            request,
            self.activities.search_contexts(
                request.request_body.request_payload, request.request_body.pagination_request
            ),
            paginated=True,
        )

    @require_permissions(CREATE)
    async def open_context(self, http_request: Request, request: OpenContextRequest) -> ActivityResponse:
        return await self._respond(
            request, self.activities.open_context(request.request_body.request_payload, _actor(http_request))
        )

    @require_permissions(CORRECT)
    async def close_context(self, http_request: Request, request: ContextStatusChangeRequest) -> ActivityResponse:
        p = request.request_body.request_payload
        return await self._respond(
            request,
            self.activities.set_context_status(p.register_mnemonic, p.context_id, True, _actor(http_request), p.reason),
        )

    @require_permissions(CORRECT)
    async def reopen_context(self, http_request: Request, request: ContextStatusChangeRequest) -> ActivityResponse:
        p = request.request_body.request_payload
        return await self._respond(
            request,
            self.activities.set_context_status(p.register_mnemonic, p.context_id, False, _actor(http_request), p.reason),
        )

    # ------------------------------------------------ work lists / projections

    @require_permissions(VIEW)
    @data_policy
    async def get_work_list(self, http_request: Request, request: WorkListRequest) -> ActivityResponse:
        return await self._respond(
            request,
            self.activities.work_list(
                request.request_body.request_payload,
                request.request_body.pagination_request,
                get_data_policies(http_request),
            ),
            paginated=True,
        )

    @require_permissions(VIEW)
    @data_policy
    async def get_projection(self, http_request: Request, request: GetProjectionRequest) -> ActivityResponse:
        p = request.request_body.request_payload
        return await self._respond(
            request,
            self.controller_service.get_projection(p.register_mnemonic, p.context_id, get_data_policies(http_request)),
        )

    @require_permissions(VIEW)
    @data_policy
    async def search_projections(self, http_request: Request, request: SearchProjectionsRequest) -> ActivityResponse:
        p = request.request_body.request_payload
        return await self._respond(
            request,
            self.controller_service.search_projections(
                p.register_mnemonic, p.filters, request.request_body.pagination_request, get_data_policies(http_request)
            ),
            paginated=True,
        )

    @require_permissions(VIEW)
    async def get_indicators(self, request: RegisterMnemonicRequest) -> ActivityResponse:
        return await self._respond(
            request, self.indicators.list_indicators(request.request_body.request_payload.register_mnemonic)
        )

    @require_permissions(VIEW)
    @data_policy
    async def compute_indicator(self, http_request: Request, request: ComputeIndicatorRequest) -> ActivityResponse:
        p = request.request_body.request_payload
        return await self._respond(
            request,
            self.indicators.compute(p.register_mnemonic, p.indicator_code, p.filters, get_data_policies(http_request)),
        )

    # ------------------------------------------------------------ configuring

    @require_permissions(CONFIGURE)
    async def lock_period(self, http_request: Request, request: LockPeriodRequest) -> ActivityResponse:
        return await self._respond(
            request, self.activities.lock_period(request.request_body.request_payload, _actor(http_request))
        )

    @require_permissions(CONFIGURE)
    async def unlock_period(self, http_request: Request, request: UnlockPeriodRequest) -> ActivityResponse:
        p = request.request_body.request_payload
        return await self._respond(
            request, self.activities.unlock_period(p.register_mnemonic, p.lock_id, p.reason, _actor(http_request))
        )

    @require_permissions(VIEW)
    async def get_period_locks(self, request: RegisterMnemonicRequest) -> ActivityResponse:
        return await self._respond(
            request, self.activities.list_period_locks(request.request_body.request_payload.register_mnemonic)
        )

    @require_permissions(VIEW)
    async def get_temporary_references(self, request: RegisterMnemonicRequest) -> ActivityResponse:
        return await self._respond(
            request, self.activities.list_temporary_references(request.request_body.request_payload.register_mnemonic)
        )

    @require_permissions(CONFIGURE)
    async def resolve_temporary_reference(
        self, http_request: Request, request: ResolveTemporaryReferenceRequest
    ) -> ActivityResponse:
        return await self._respond(
            request,
            self.activities.resolve_temporary_reference(request.request_body.request_payload, _actor(http_request)),
        )

    @require_permissions(CONFIGURE)
    async def rebuild_projections(self, request: RebuildProjectionsRequest) -> ActivityResponse:
        p = request.request_body.request_payload

        async def work():
            return {"contexts_rebuilt": await self.controller_service.rebuild_projections(p.register_mnemonic, p.context_id)}

        return await self._respond(request, work())

    # ------------------------------------------------ subjects, defaults, roll-ups

    @require_permissions(VIEW)
    @data_policy
    async def get_subject_activities(self, http_request: Request, request: SubjectActivitiesRequest) -> ActivityResponse:
        """A record's activities (and its child records'), per activity register — the profile tab."""
        return await self._respond(
            request,
            self.activities.subject_activities(request.request_body.request_payload, get_data_policies(http_request)),
        )

    @require_permissions(VIEW)
    @data_policy
    async def get_latest_activity(self, http_request: Request, request: LatestActivityRequest) -> ActivityResponse:
        """The latest current activity of a type for a context or subject, to pre-fill a new one."""
        return await self._respond(
            request,
            self.activities.latest_activity(request.request_body.request_payload, get_data_policies(http_request)),
        )

    @require_permissions(VIEW)
    async def search_aggregates(self, request: SearchAggregatesRequest) -> ActivityResponse:
        return await self._respond(request, self.activities.search_aggregates(request.request_body.request_payload))

    @require_permissions(VIEW)
    async def get_aggregate_history(self, request: AggregateHistoryRequest) -> ActivityResponse:
        return await self._respond(request, self.activities.aggregate_history(request.request_body.request_payload))

    @require_permissions(VIEW)
    async def get_activity_type_schemas(self, request: ActivityTypeSchemaRequest) -> ActivityResponse:
        return await self._respond(
            request, self.activities.activity_type_schemas(request.request_body.request_payload)
        )
