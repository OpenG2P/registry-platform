"""
Data-policy middleware (tactical 1.2.0).

Runs after ResolvePermissionMiddleware. Parses DP_ prefixed roles from the access token
and stores resolved policy mnemonics on request.state for downstream handlers.
"""

import logging

from fastapi import Request
from openg2p_registry_core.helpers.data_policy_role_helper import (
    extract_data_policy_mnemonics_from_roles,
)
from starlette.middleware.base import BaseHTTPMiddleware

_logger = logging.getLogger(__name__)

DATA_POLICY_MNEMONICS_STATE_KEY = "data_policy_mnemonics"


class DataPolicyMiddleware(BaseHTTPMiddleware):
    """
    Extract data-policy role mnemonics from the authenticated principal.

    Register inside ResolvePermissionMiddleware (closer to the app) so request.state.auth
    is populated before this middleware runs.
    """

    def __init__(
        self,
        app,
        *,
        client_id: str | None = None,
        state_key: str = DATA_POLICY_MNEMONICS_STATE_KEY,
        auth_state_key: str = "auth",
    ):
        super().__init__(app)
        self._client_id = (client_id or "").strip()
        self._state_key = state_key
        self._auth_state_key = auth_state_key

    async def dispatch(self, request: Request, call_next):
        mnemonics: list[str] = []
        principal = getattr(request.state, self._auth_state_key, None)
        if principal and principal.client_roles and self._client_id:
            client_roles = list(principal.client_roles.get(self._client_id, []))
            mnemonics = extract_data_policy_mnemonics_from_roles(client_roles)
            if mnemonics:
                _logger.debug(
                    "Data policy mnemonics for %s: %s",
                    request.url.path,
                    mnemonics,
                )

        setattr(request.state, self._state_key, mnemonics)
        return await call_next(request)
