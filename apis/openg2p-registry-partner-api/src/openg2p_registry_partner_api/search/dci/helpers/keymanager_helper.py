from typing import Dict, Any
from openg2p_fastapi_common.service import BaseService
from openg2p_registry_core.errors import G2PRegistryException, G2PRegistryErrorCodes
from openg2p_fastapi_common.utils.crypto import KeymanagerCryptoHelper

from ..schemas import (
    DciRequestHeader,
    DciResponseHeader,
    DciSearchResponse,
    DciSearchRequest,
)

class DciKeymanagerHelper(BaseService):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.keymanager_crypto_helper = KeymanagerCryptoHelper()

    async def generate_signature(
        self,
        header: DciResponseHeader,
        message: DciSearchResponse,
    ) -> str:
        signature_payload: Dict[str, Any] = {
            "header": header.model_dump(by_alias=True),
            "message": message.model_dump(by_alias=True),
        }
        signature = await self.keymanager_crypto_helper.create_jwt_token(
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
        header: DciRequestHeader,
        message: DciSearchRequest,
    ) -> bool:
        signature_payload: Dict[str, Any] = {
            "header": header.model_dump(by_alias=True),
            "message": message.model_dump(by_alias=True),
        }
        signature_valid = await self.keymanager_crypto_helper.verify_jwt(
            orig_jwt=signature,
            payload=signature_payload,
            km_app_id=header.receiver_id,       # TODO: Add app_id
            km_ref_id=header.sender_id,
        )
        if not signature_valid:
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.REQUEST_VALIDATION_ERROR.value[1],
                message=G2PRegistryErrorCodes.REQUEST_VALIDATION_ERROR.value[0],
            )