from typing import Any, Dict, Optional
from openg2p_fastapi_common.service import BaseService
from openg2p_registry_core.errors import G2PRegistryException, G2PRegistryErrorCodes
from openg2p_fastapi_common.utils.crypto import build_crypto_helper

from ....config import Settings
from ..schemas import (
    DciResponseHeader,
    DciSearchResponse,
)

_config = Settings.get_config()


def partner_reference_id(sender_id: str) -> str:
    """Map a DCI ``header.sender_id`` to the partner reference used to look up
    keys — ``PARTNER_<SENDER_ID>`` (upper-cased, ``-`` -> ``_``).

    This is the SAME convention as openg2p-fastapi-partner-auth's
    ``JWTValidationHelper.get_partner_id_from_payload`` and g2p-bridge, so a
    partner's key is looked up identically across the platform (Partner
    Management, Consent Manager, Registry).
    """
    return f"PARTNER_{(sender_id or '').replace('-', '_').upper()}"


class DciKeymanagerHelper(BaseService):
    """Signs/verifies the DCI envelope signature.

    Backend-agnostic: the underlying crypto helper is selected by
    ``crypto_backend`` config (``partner-mgmt`` by default — partner keys from
    Partner Management; ``keymanager`` for the legacy Mosip service; ``local``
    for tests). The DCI wire convention is unchanged: the signature is a
    detached JWS over the ``{header, message}`` payload.
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.crypto_helper = build_crypto_helper(backend=_config.crypto_backend)

    async def generate_signature(
        self,
        header: DciResponseHeader,
        message: DciSearchResponse,
    ) -> str:
        signature_payload: Dict[str, Any] = {
            "header": header.model_dump(by_alias=True),
            "message": message.model_dump(by_alias=True),
        }
        signature = await self.crypto_helper.create_jwt_token(
            payload=signature_payload,
            include_payload=False,
            include_certificate=False,
            include_cert_hash=False,
            km_app_id=header.sender_id,
            km_ref_id=header.receiver_id,
        )
        return signature

    async def validate_signature(
        self,
        signature: str,
        raw_header: Dict[str, Any],
        raw_message: Dict[str, Any],
    ) -> bool:
        """Verify the DCI envelope signature over the **raw** ``{header, message}``
        exactly as the partner sent it — NOT reparsed pydantic models.

        Verifying over reparsed models would re-serialise through pydantic
        (defaults filled, aliases applied) and diverge from the bytes the partner
        actually signed. Verifying the raw body is what g2p-bridge's
        ``JWTSignatureValidator`` does, and keeps the detached-JWS signing input
        exact.
        """
        signature_payload: Dict[str, Any] = {
            "header": raw_header,
            "message": raw_message,
        }
        return await self.validate_detached_signature(
            signature,
            signature_payload,
            partner_reference_id((raw_header or {}).get("sender_id", "")),
            km_app_id=(raw_header or {}).get("receiver_id"),
        )

    async def validate_detached_signature(
        self,
        signature: str,
        signature_payload: Any,
        partner_reference: str,
        km_app_id: Optional[str] = None,
    ) -> bool:
        """Verify a detached JWS over ``signature_payload`` with the key Partner
        Management holds for ``partner_reference`` (``PARTNER_<SENDER>``).

        Used for the DCI ``{header, message}`` envelope and for ``/ingest_data``,
        whose signature and payload sit at the data model's configured key paths.
        Raises ``REQUEST_VALIDATION_ERROR`` when the signature does not verify.
        """
        signature_valid = await self.crypto_helper.verify_jwt(
            orig_jwt=signature,
            payload=signature_payload,
            km_app_id=km_app_id,
            km_ref_id=partner_reference,
        )
        if not signature_valid:
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.REQUEST_VALIDATION_ERROR.value[1],
                message=G2PRegistryErrorCodes.REQUEST_VALIDATION_ERROR.value[0],
            )
        return True
