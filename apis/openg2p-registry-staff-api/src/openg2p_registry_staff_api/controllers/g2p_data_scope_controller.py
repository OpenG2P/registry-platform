"""The registry's data scope catalogue for the staff portal (and, later, picking scopes in CM).

Read only: scopes come from register sections and the extension's catalogue
(see ``G2PDataScopeService``); they are published by the services themselves.
"""

import logging

from iam_core.user_auth.decorators import require_permissions
from openg2p_fastapi_common.controller import BaseController
from openg2p_fastapi_common.schemas import G2PResponseBody
from openg2p_registry_core.schemas import ActivityResponse, EmptyRequest
from openg2p_registry_core.services import G2PDataScopeService

from ..config import Settings
from ..helpers import RequestResponseHelper

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)

VIEW = {"registerSection:view"}


class G2PDataScopeController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.router.tags += ["/data_scopes"]
        self.router.prefix = "/data_scopes"
        self.helper = RequestResponseHelper.get_component()
        self.data_scopes = G2PDataScopeService.get_component() or G2PDataScopeService()
        self.router.add_api_route("", self.list_data_scopes, methods=["GET"])
        self.router.add_api_route(
            "/get_data_scopes", self.get_data_scopes, responses={200: {"model": ActivityResponse}}, methods=["POST"]
        )

    async def _catalogue(self) -> dict:
        controller = self.data_scopes.controller_id()
        return {"data_controller": controller or None, "data_scopes": await self.data_scopes.list_scopes()}

    @require_permissions(VIEW)
    async def list_data_scopes(self) -> dict:
        return await self._catalogue()

    @require_permissions(VIEW)
    async def get_data_scopes(self, request: EmptyRequest) -> ActivityResponse:
        try:
            return self.helper.construct_success_response(
                G2PResponseBody(response_payload=await self._catalogue()), request
            )
        except Exception as error:
            _logger.error("Data scope catalogue request failed: %s", error)
            return self.helper.construct_error_response(error, request)
