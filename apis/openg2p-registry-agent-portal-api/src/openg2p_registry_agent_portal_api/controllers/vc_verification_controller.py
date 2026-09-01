import logging

from fastapi import Request
from iam_core.user_auth.decorators import require_permissions
from openg2p_fastapi_common.controller import BaseController

from ..audit_context import set_audit
from ..config import Settings
from ..helpers import RequestResponseHelper
from ..schemas import (
    VerifyCredentialRequest,
    VerifyCredentialResponse,
    VerifyCredentialResponseBody,
    VerifyCredentialResultPayload,
)
from ..services import (
    CredentialVerificationError,
    CredentialVerificationService,
    subject_id,
)

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)

# Separate from register:issue_credential on purpose. Checking a card someone
# presents and creating a new one are different acts with different risk, and a
# deployment may well want staff who can do the first and not the second.
VERIFY_PERMISSION = "register:verify_credential"


class VcVerificationController(BaseController):
    """Agent-facing credential verification.

    One call. The browser reads the QR out of the uploaded PDF or photo and
    sends the payload; this forwards it to Inji Verify's verify-service
    in-cluster and returns the verdict.

    Nothing is stored. A verification is a question about a credential someone
    is holding, not a record we own — the audit event is the trace, not a copy
    of the citizen's data.
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.router.tags += ["Agent Portal - VC Verification"]
        self.router.prefix += "/agent_portal/vc"

        self.verification_service = CredentialVerificationService.get_component()
        self.helper = RequestResponseHelper.get_component()

        self.router.add_api_route(
            "/verify",
            self.verify,
            responses={200: {"model": VerifyCredentialResponse}},
            methods=["POST"],
        )

    @require_permissions({VERIFY_PERMISSION})
    async def verify(
        self, request: Request, verify_request: VerifyCredentialRequest
    ) -> VerifyCredentialResponse:
        payload = verify_request.request_body.request_payload

        qr = (payload.qr_payload or "").strip()
        credential = (payload.credential_json or "").strip()

        set_audit(
            request,
            action="verify_credential",
            resource_type="verifiable_credential",
        )

        if not qr and not credential:
            set_audit(request, outcome="failure",
                      detail={"reason": "no payload supplied"})
            return self.helper.error(
                VerifyCredentialResponse,
                VerifyCredentialResponseBody,
                "G2P-VC-400",
                "Supply either qr_payload or credential_json.",
                verify_request,
            )

        try:
            result = await self.verification_service.verify(
                credential or qr, is_credential_json=bool(credential)
            )
        except CredentialVerificationError as error:
            # An unreachable or erroring verifier is NOT "this credential is
            # invalid" — reporting it that way would have an agent turn away a
            # citizen holding a perfectly good card. The audit has to keep them
            # apart too, or an outage reads as a wave of forged credentials.
            set_audit(request, outcome="failure",
                      detail={"error_code": error.code, "reason": error.message})
            return self.helper.error(
                VerifyCredentialResponse,
                VerifyCredentialResponseBody,
                error.code,
                error.message,
                verify_request,
            )

        # What was actually checked, and what the answer was. Without this the
        # trail cannot distinguish a genuine credential from a forged one: both
        # are HTTP 200.
        claims = result.get("claims")
        set_audit(
            request,
            resource_id=subject_id(claims),
            outcome="success" if result["verified"] else "failure",
            detail={
                "verification_status": result["status"],
                "verified": result["verified"],
                # Enough to tie the event to a card without copying the
                # citizen's details into the audit store.
                "credential_issuer": (claims or {}).get("Issuer"),
            },
        )

        return self.helper.success(
            VerifyCredentialResponse,
            VerifyCredentialResponseBody,
            VerifyCredentialResultPayload(
                verified=result["verified"],
                status=result["status"],
                claims=result["claims"],
            ),
            verify_request,
        )
