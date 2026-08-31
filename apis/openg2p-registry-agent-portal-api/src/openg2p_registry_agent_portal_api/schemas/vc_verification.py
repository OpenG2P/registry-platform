from typing import Any, Dict, Optional

from openg2p_fastapi_common.schemas import (
    G2PRequest,
    G2PRequestBody,
    G2PResponse,
    G2PResponseBody,
)
from pydantic import BaseModel


class VerifyCredentialPayload(BaseModel):
    """What the agent presents for checking.

    `qr_payload` is the Base45 string read out of the QR. The browser does that
    reading — from an uploaded PDF or photo — and sends only the payload, so no
    image ever reaches the server and the API stays a thin pass-through to the
    verifier.

    `credential_json` is the escape hatch for a whole JSON-LD credential pasted
    directly, which verifies through a different code path in verify-service.
    """

    qr_payload: Optional[str] = None
    credential_json: Optional[str] = None


class VerifyCredentialRequestBody(G2PRequestBody):
    request_payload: VerifyCredentialPayload


class VerifyCredentialRequest(G2PRequest):
    request_body: VerifyCredentialRequestBody


class VerifyCredentialResultPayload(BaseModel):
    # The single fact the agent is standing there to learn.
    verified: bool
    # The verifier's own word for it, passed through rather than collapsed into
    # the boolean, so an operator reading a log can tell EXPIRED from a bad
    # signature.
    status: Optional[str] = None
    # Claims the verifier decoded, when it returns them. Shown so the agent can
    # confirm the card belongs to the person in front of them — a valid
    # signature on someone else's credential is still the wrong card.
    claims: Optional[Dict[str, Any]] = None


class VerifyCredentialResponseBody(G2PResponseBody):
    response_payload: Optional[VerifyCredentialResultPayload] = None


class VerifyCredentialResponse(G2PResponse):
    response_body: Optional[VerifyCredentialResponseBody] = None
