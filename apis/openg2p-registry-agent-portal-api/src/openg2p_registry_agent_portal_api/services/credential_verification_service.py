import logging
from typing import Any, Dict, Optional

import re

import httpx
from openg2p_fastapi_common.service import BaseService

from ..config import Settings
from .cwt_claims import decode_claims

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)

# What the QR on a printed OpenG2P credential is: a claim-169 CWT
# (CBOR -> COSE_Sign1 -> tag 61, hex-encoded, zlib-compressed, Base45).
# verify-service selects its verifier from the Content-Type, and this is the one
# that means "claim-169 CWT".
#
# It expects the HEX, not the Base45 string printed in the QR. Posting the raw
# QR text is rejected with ERR_INVALID_HEX -- which reads like a bad credential
# rather than a wrongly-framed request, and cost a full debugging pass to pin
# down. The Agent Portal UI unwraps Base45(zlib(hex)) with PixelPass before
# calling this, so what arrives here is already hex.
CWT_CONTENT_TYPE = "application/vc+cwt"
# A whole JSON-LD credential, for the case where someone pastes one rather than
# scanning a card.
LDP_CONTENT_TYPE = "application/json"

# An even number of hex digits: the CWT as verify-service wants it.
_HEX = re.compile(r"(?:[0-9a-fA-F]{2})+")


class CredentialVerificationError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message


class CredentialVerificationService(BaseService):
    """Checks a credential against Inji Verify's `verify-service`.

    Deliberately thin. The decode chain (Base45 -> zlib -> CBOR -> COSE) and the
    signature check both live in verify-service, which carries the same
    PixelPass library Certify generates the QR with — so re-implementing either
    here would be a second, divergent implementation of a format we do not own.

    This service exists to keep verify-service off the public network: the
    browser talks to the Agent Portal API, which talks to verify-service
    in-cluster, exactly as it does for Certify.
    """

    async def verify(self, payload: str, *, is_credential_json: bool = False) -> Dict[str, Any]:
        base = (_config.verify_service_url or "").rstrip("/")
        if not base:
            raise CredentialVerificationError(
                "G2P-VC-503",
                "Credential verification is not configured "
                "(registry_agent_portal_api_verify_service_url is empty).",
            )

        payload = (payload or "").strip()
        if not payload:
            raise CredentialVerificationError(
                "G2P-VC-400", "No QR payload was supplied."
            )

        # Catch the Base45 QR string being sent straight through. verify-service
        # would answer ERR_INVALID_HEX, which an agent reads as "this credential
        # is fake" -- the one wrong thing to tell them about a card that may be
        # perfectly good.
        if not is_credential_json and not _HEX.fullmatch(payload):
            raise CredentialVerificationError(
                "G2P-VC-400",
                "The QR payload must be the hex-encoded CWT, not the raw Base45 "
                "string from the QR. Unwrap it with PixelPass first.",
            )

        content_type = LDP_CONTENT_TYPE if is_credential_json else CWT_CONTENT_TYPE
        url = f"{base}/vc-verification"

        try:
            async with httpx.AsyncClient(timeout=_config.verify_timeout_seconds) as client:
                response = await client.post(
                    url, content=payload.encode("utf-8"),
                    headers={"Content-Type": content_type},
                )
        except httpx.HTTPError as error:
            # The verifier being unreachable is an operational failure, not a
            # statement about the credential. Saying "invalid" here would tell an
            # agent to reject a card that may be perfectly good.
            _logger.exception("verify-service is unreachable at %s", url)
            raise CredentialVerificationError(
                "G2P-VC-502",
                f"The verification service could not be reached: {error}",
            ) from error

        if response.status_code >= 400:
            raise CredentialVerificationError(
                "G2P-VC-502",
                f"The verification service returned HTTP {response.status_code}.",
            )

        try:
            body = response.json()
        except ValueError as error:
            raise CredentialVerificationError(
                "G2P-VC-502", "The verification service returned a non-JSON response."
            ) from error

        status = self._status_of(body)
        verified = status == "SUCCESS"

        # verify-service answers with the verdict and nothing else -- no payload,
        # no claims -- so reading them off its response (as this did) always
        # yielded None and the screen showed a bare "Valid". An agent cannot act
        # on that: it says the card is genuine without saying whose it is.
        # Decode the CWT ourselves for display only; the verdict above is still
        # entirely verify-service's.
        claims = body.get("payload") or body.get("claims")
        if not claims and verified and not is_credential_json:
            # Only once verified. Rendering the contents of a token that failed
            # its signature check would put attacker-chosen text on screen next
            # to a red cross, which is asking to be misread.
            claims = decode_claims(payload)

        return {
            "verified": verified,
            "status": status,
            "claims": claims or None,
            "raw": body,
        }

    @staticmethod
    def _status_of(body: Dict[str, Any]) -> Optional[str]:
        """Normalise verify-service's verdict.

        It has more than one response shape across versions (`verificationStatus`
        on the v1 endpoint, `verificationResult` on v2), so read either rather
        than pinning one and silently reporting every credential invalid the day
        the shape changes.
        """
        for key in ("verificationStatus", "verificationResult", "status"):
            value = body.get(key)
            if isinstance(value, str):
                return value.upper()
            if isinstance(value, dict):
                nested = value.get("verificationStatus") or value.get("status")
                if isinstance(nested, str):
                    return nested.upper()
        return None
