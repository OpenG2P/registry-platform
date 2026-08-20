import logging
from datetime import datetime, timezone
from typing import Optional, Tuple

from openg2p_fastapi_common.service import BaseService
from openg2p_registry_core.models import AuthenticationStatusEnum, G2PRegistrantAuthentication
from openg2p_registry_core.services import G2PRegistrantAuthenticationService

from ..config import Settings

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class BeneficiaryAuthError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


class BeneficiaryAuthService(BaseService):
    """The beneficiary's own authentication, as the gate on issuance.

    This is a thin policy layer over the registry's existing
    *registrant-authentication* subsystem — the same one staff use — because that
    is exactly what is happening here: an operator initiates, and the registrant
    authenticates in person to authorise the operator's action
    (`initiated_by_staff_id` is the agent).

    Two things this layer adds, and one it deliberately does not:

    * **Its own time window.** A completed authentication is given a long
      `expiry_at` (days) for other consumers. Authorising a credential must be a
      matter of minutes, so the VC window is measured from `completed_at` and
      configured here — the shared record is read, never rewritten.
    * **An explicit authorisation decision** the caller can act on.
    * **Not the subject binding.** Core already refuses to complete an
      authentication whose token subject does not equal the record's
      `foundational_id`, so `SUCCESS` already means "this person is that record".
      Re-checking it here would duplicate a guarantee we would then have to keep
      in step.
    """

    @property
    def auth_service(self) -> G2PRegistrantAuthenticationService:
        # Resolved on use rather than in __init__: the core service opens a DB
        # engine when it is constructed, so binding to it at import/'initialize'
        # time would couple us to component construction order.
        return G2PRegistrantAuthenticationService.get_component()

    async def _resolve_provider_id(self, register_id: str) -> str:
        if _config.vc_auth_provider_id:
            return _config.vc_auth_provider_id
        providers = await self.auth_service.get_available_providers(register_id)
        if not providers:
            raise BeneficiaryAuthError(
                "G2P-VC-412",
                "No active registrant-authentication provider is configured for this "
                "register. A credential cannot be issued without authenticating the "
                "beneficiary.",
            )
        return providers[0].provider_id

    async def start(
        self, *, register_id: str, internal_record_id: str, agent_id: str,
        provider_id: Optional[str] = None,
    ) -> Tuple[str, str, str]:
        """Begin the beneficiary's authentication; returns (id, url, provider)."""
        resolved = provider_id or await self._resolve_provider_id(register_id)
        _, authorization_url, provider_name = await self.auth_service.start_authentication(
            register_id=register_id,
            internal_record_id=internal_record_id,
            provider_id=resolved,
            initiated_by_staff_id=agent_id,
        )
        auth = await self.auth_service.get_authentication_status(
            internal_record_id=internal_record_id
        )
        if auth is None:
            raise BeneficiaryAuthError(
                "G2P-VC-500", "Authentication was started but no record was created."
            )
        return auth.authentication_id, authorization_url, provider_name

    async def authorisation(
        self, *, internal_record_id: str, authentication_id: Optional[str] = None
    ) -> Tuple[Optional[G2PRegistrantAuthentication], bool, Optional[str], Optional[int]]:
        """Decide whether issuance may proceed for this record.

        Returns (auth, authorised, reason, seconds_remaining).
        """
        auth = await self.auth_service.get_authentication_status(
            internal_record_id=internal_record_id
        )
        if auth is None:
            return None, False, "No authentication has been started for this record.", None

        # Always judge the *latest* authentication. If the caller names a
        # different one it is stale — accepting it would let an old, already-used
        # authentication authorise a fresh issuance.
        if authentication_id and auth.authentication_id != authentication_id:
            return (
                auth,
                False,
                "A newer authentication exists for this record; re-authenticate the beneficiary.",
                None,
            )

        if auth.status != AuthenticationStatusEnum.success.value:
            reason = auth.failure_reason or f"Authentication is {auth.status}."
            return auth, False, reason, None

        if not auth.completed_at:
            return auth, False, "Authentication has no completion time.", None

        elapsed = (
            datetime.now(tz=timezone.utc).replace(tzinfo=None) - auth.completed_at
        ).total_seconds()
        remaining = int(_config.vc_auth_window_seconds - elapsed)
        if remaining <= 0:
            return (
                auth,
                False,
                "The beneficiary's authentication has expired for issuance; "
                "re-authenticate to continue.",
                0,
            )
        return auth, True, None, remaining
