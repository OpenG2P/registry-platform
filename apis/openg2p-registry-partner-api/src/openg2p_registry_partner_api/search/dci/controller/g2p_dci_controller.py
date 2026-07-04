import logging
from typing import Any, Dict, List, Optional

from fastapi import Request
from openg2p_fastapi_common.controller import BaseController
from openg2p_registry_core.errors import G2PRegistryException, G2PRegistryErrorCodes

from ..schemas import (
    DciSearchRequestEnvelope,
    DciSearchResponseEnvelope,
    DciRequestHeader,
    DciSearchResponseItem,
    DciSearchRequest,
)
from ..helpers import (
    DciRequestResponseHelper,
    DciKeymanagerHelper,
    DciConsentHelper,
)
from ..services import G2PDciService
from ....config import Settings

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)

_SIGNATURE_DISABLED_MARKER = "signature_validation_disabled"


class G2PDciController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.router.tags += ["/dci/registry"]
        self.g2p_dci_service = G2PDciService()
        self.request_response_helper = DciRequestResponseHelper()
        self.keymanager_helper = DciKeymanagerHelper()
        self.consent_helper = DciConsentHelper()
        self.router.prefix = "/dci/registry"

        self.router.add_api_route(
            "/sync/search",
            self.search,
            responses={200: {"model": DciSearchResponseEnvelope}},
            methods=["POST"],
        )

    async def search(
        self, dci_search_request_env: DciSearchRequestEnvelope, request: Request
    ) -> DciSearchResponseEnvelope:
        try:
            _logger.info("DCI search request received")

            signature: str = dci_search_request_env.signature
            header: DciRequestHeader = dci_search_request_env.header
            message: DciSearchRequest = dci_search_request_env.message

            # --- 1. Partner signature (transport auth) ----------------------
            if _config.signature_validation_enabled:
                await self.keymanager_helper.validate_signature(signature, header, message)
            else:
                _logger.warning(
                    "signature_validation_enabled=false — SKIPPING DCI envelope "
                    "signature verification (testing bypass; do not use in production)"
                )

            # --- 2. Consent (authorisation) ---------------------------------
            # scopes_by_ref maps reference_id -> effective_data_scopes to clamp
            # the response to. None (whole map) => enforcement disabled, no clamp.
            scopes_by_ref: Optional[Dict[str, Optional[List[str]]]] = None
            if _config.consent_enforcement_enabled:
                raw_body: Dict[str, Any] = await request.json()
                scopes_by_ref = await self._enforce_consent(raw_body, header, message)
            else:
                _logger.warning(
                    "consent_enforcement_enabled=false — SKIPPING Consent Manager "
                    "validation, returning ALL fields (testing bypass; do not use in production)"
                )

            # --- 3. Search (with field clamp when enforcing) ----------------
            dci_search_response_items: list[DciSearchResponseItem] = await self.g2p_dci_service.search(
                signature, header, message, consent_scopes_by_ref=scopes_by_ref
            )

            dci_search_response_env: DciSearchResponseEnvelope = (
                self.request_response_helper.construct_dci_search_success_response(
                    dci_search_response_items, dci_search_request_env
                )
            )

            # --- 4. Stamp enforcement posture + sign ------------------------
            self._stamp_enforcement_meta(dci_search_response_env)
            dci_search_response_env.signature = await self._sign_response(dci_search_response_env)

            return dci_search_response_env

        except Exception as error_exception:
            _logger.error(f"Error in search: {str(error_exception)}")
            error_response: DciSearchResponseEnvelope = self.request_response_helper.construct_error_response(
                error_exception, dci_search_request_env
            )
            self._stamp_enforcement_meta(error_response)
            error_response.signature = await self._sign_response(error_response)
            return error_response

    async def _enforce_consent(
        self, raw_body: Dict[str, Any], header: DciRequestHeader, message: DciSearchRequest
    ) -> Dict[str, Optional[List[str]]]:
        """Validate the embedded consent object for each search item against the
        Consent Manager and return {reference_id -> effective_data_scopes}.

        Fail-closed: a missing consent object or any non-permit decision raises,
        rejecting the whole request (no partial data leak).
        """
        raw_items = ((raw_body or {}).get("message") or {}).get("search_request") or []
        raw_by_ref: Dict[str, Dict[str, Any]] = {
            item.get("reference_id"): item for item in raw_items if isinstance(item, dict)
        }

        scopes_by_ref: Dict[str, Optional[List[str]]] = {}
        for search_request_item in message.search_request:
            reference_id = search_request_item.reference_id
            raw_item = raw_by_ref.get(reference_id, {})
            consent_jws = self._extract_consent_jws(raw_item)

            decision = await self.consent_helper.validate(
                consent_jws=consent_jws,
                sender_id=header.sender_id,
            )
            if decision.get("decision") != "permit":
                raise G2PRegistryException(
                    code=G2PRegistryErrorCodes.REQUEST_VALIDATION_ERROR.value[1],
                    message=(
                        f"Consent denied for reference_id '{reference_id}': "
                        f"{decision.get('reason_code')} - {decision.get('detail') or ''}"
                    ).strip(),
                )
            scopes_by_ref[reference_id] = decision.get("effective_data_scopes") or []

        return scopes_by_ref

    @staticmethod
    def _extract_consent_jws(raw_item: Dict[str, Any]) -> Optional[str]:
        """The partner embeds the CM consent object as a compact JWS at
        ``search_criteria.authorize.consent_jws`` (self-contained, verbatim)."""
        authorize = ((raw_item or {}).get("search_criteria") or {}).get("authorize") or {}
        consent_jws = authorize.get("consent_jws")
        return consent_jws if isinstance(consent_jws, str) else None

    @staticmethod
    def _stamp_enforcement_meta(response_env: DciSearchResponseEnvelope) -> None:
        """Record the enforcement posture in the response header meta so a
        bypassed (testing) response is never mistaken for an authorised one."""
        try:
            response_env.header.meta = {
                **(response_env.header.meta or {}),
                "signature_validation": "enabled"
                if _config.signature_validation_enabled
                else "disabled",
                "consent_enforcement": "enabled"
                if _config.consent_enforcement_enabled
                else "disabled",
            }
        except Exception:  # never let stamping break the response
            _logger.exception("Failed to stamp enforcement meta")

    async def _sign_response(self, response_env: DciSearchResponseEnvelope) -> str:
        """Sign the response envelope when signature validation is on; otherwise
        return a marker so the caller can see signing was intentionally skipped."""
        if not _config.signature_validation_enabled:
            return _SIGNATURE_DISABLED_MARKER
        try:
            return await self.keymanager_helper.generate_signature(
                response_env.header, response_env.message
            )
        except Exception:
            _logger.exception(
                "Response signing failed (is the registry signing key configured?); "
                "returning unsigned marker"
            )
            return _SIGNATURE_DISABLED_MARKER
