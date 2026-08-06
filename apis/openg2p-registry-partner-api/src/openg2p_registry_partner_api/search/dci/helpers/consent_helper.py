import logging
from typing import Any, Dict, List, Optional

import httpx
from openg2p_fastapi_common.service import BaseService

from ....config import Settings

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class DciConsentHelper(BaseService):
    """Client for the Consent Manager (PDP) ``/validate`` endpoint.

    The registry is a Policy Enforcement Point (PEP): it does NOT interpret
    consent. It forwards the partner-signed consent object — a compact JWS
    embedded by the partner at ``search_criteria.authorize.consent_jws`` — to
    the Consent Manager, which verifies the JWS against Partner Management keys,
    evaluates the partner's data-share policy, and returns a decision plus the
    ``effective_data_scopes`` the registry must clamp the response to.

    Fail-closed: any transport error, non-2xx, or a missing consent JWS yields
    a synthetic ``deny`` so a failure never leaks data.
    """

    @property
    def _validate_url(self) -> str:
        base = (_config.consent_manager_url or "").rstrip("/")
        return f"{base}/consent/v1/validate"

    @staticmethod
    def _deny(reason: str, detail: str = "") -> Dict[str, Any]:
        return {
            "decision": "deny",
            "reason_code": reason,
            "detail": detail,
            "effective_data_scopes": [],
        }

    async def validate(
        self,
        consent_jws: Optional[str],
        sender_id: str,
        requested_scopes: Optional[List[str]] = None,
        subject_id: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Call CM ``/validate`` and return its Decision dict (fail-closed).

        ``consent_jws`` is the compact JWS exactly as the partner sent it. It is
        self-contained (its signed bytes travel in the payload segment), so the
        registry forwards it verbatim — no reshaping needed.
        """
        if not consent_jws:
            _logger.warning("Consent enforcement: no consent JWS present in request")
            return self._deny("missing_consent", "no consent JWS embedded in request")

        if not _config.consent_manager_url:
            _logger.error("Consent enforcement enabled but consent_manager_url is not configured")
            return self._deny("cm_not_configured", "consent_manager_url is empty")

        request_context: Dict[str, Any] = {}
        if requested_scopes:
            request_context["requested_scopes"] = requested_scopes
        if subject_id:
            request_context["subject_id"] = subject_id

        body: Dict[str, Any] = {
            "consent_jws": consent_jws,
            "partner_id": sender_id,
        }
        if request_context:
            body["request_context"] = request_context

        try:
            async with httpx.AsyncClient(timeout=_config.consent_manager_timeout) as client:
                response = await client.post(self._validate_url, json=body)
        except Exception as exc:  # network / timeout — fail closed
            _logger.exception("Consent Manager /validate call failed")
            return self._deny("cm_unreachable", str(exc))

        if response.status_code != 200:
            _logger.error("Consent Manager /validate returned %s: %s", response.status_code, response.text)
            return self._deny("cm_error", f"HTTP {response.status_code}")

        try:
            decision: Dict[str, Any] = response.json()
        except Exception as exc:
            _logger.exception("Consent Manager /validate returned non-JSON")
            return self._deny("cm_error", str(exc))

        _logger.info(
            "Consent decision for partner '%s': %s (%s)",
            sender_id,
            decision.get("decision"),
            decision.get("reason_code"),
        )
        return decision
