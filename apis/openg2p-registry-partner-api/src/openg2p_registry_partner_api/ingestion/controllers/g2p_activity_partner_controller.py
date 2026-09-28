"""Partner systems append activities (e.g. a cooperative reporting harvests).

The envelope follows the DCI shape — a detached JWS ``signature`` over
``{header, message}`` verified against the sender's Partner Management key —
so a partner integrates activity submission the same way it signs DCI search.
Each activity keeps its own outcome; ``idempotency_key`` makes retries safe.
"""

import logging
from datetime import datetime
from typing import Any, Optional

from fastapi import Request
from openg2p_fastapi_common.controller import BaseController
from openg2p_registry_core.errors import G2PRegistryErrorCodes, G2PRegistryException
from openg2p_registry_core.models import ActivityChannelEnum
from openg2p_registry_core.schemas.activity import ActivityInput, AppendActivityResult
from openg2p_registry_core.services import G2PActivityService
from pydantic import BaseModel, Field

from ...config import Settings
from ...search.dci.helpers import DciKeymanagerHelper

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class PartnerActivityHeader(BaseModel):
    sender_id: str
    message_id: str
    message_ts: datetime
    receiver_id: Optional[str] = None


class PartnerActivityMessage(BaseModel):
    activities: list[ActivityInput]
    atomic: bool = False


class PartnerActivityEnvelope(BaseModel):
    signature: Optional[str] = None
    header: PartnerActivityHeader
    message: PartnerActivityMessage


class PartnerActivityResponse(BaseModel):
    message_id: str
    status: str  # SUCCESS | PARTIAL | FAILED | ERROR
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    results: list[AppendActivityResult] = Field(default_factory=list)


class G2PActivityPartnerController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.router.tags += ["/partner/activity"]
        self.router.prefix = "/partner/activity"
        self.activities = G2PActivityService.get_component() or G2PActivityService()
        self.keymanager_helper = DciKeymanagerHelper()
        self.router.add_api_route(
            "/append_activities",
            self.append_activities,
            responses={200: {"model": PartnerActivityResponse}},
            methods=["POST"],
        )

    async def append_activities(self, envelope: PartnerActivityEnvelope, request: Request) -> PartnerActivityResponse:
        try:
            raw_body: dict[str, Any] = await request.json()
            if _config.signature_validation_enabled:
                if not envelope.signature:
                    raise G2PRegistryException(
                        code=G2PRegistryErrorCodes.INVALID_REQUEST.value[1], message="signature is required"
                    )
                await self.keymanager_helper.validate_signature(
                    envelope.signature, raw_body.get("header") or {}, raw_body.get("message") or {}
                )
            else:
                _logger.warning("signature_validation_enabled=false — accepting unsigned partner activities")

            partner = envelope.header.sender_id
            results = await self.activities.append_many(
                envelope.message.activities,
                actor=f"partner:{partner}",
                channel=ActivityChannelEnum.PARTNER.value,
                atomic=envelope.message.atomic,
                partner_id=partner,
                # One partner message is one submission.
                submission_id=f"{partner}:{envelope.header.message_id}",
            )
            failed = sum(1 for result in results if result.outcome == "FAILED")
            status = "SUCCESS" if not failed else ("FAILED" if failed == len(results) else "PARTIAL")
            return PartnerActivityResponse(message_id=envelope.header.message_id, status=status, results=results)
        except G2PRegistryException as error:
            return PartnerActivityResponse(
                message_id=envelope.header.message_id, status="ERROR",
                error_code=error.code, error_message=error.message,
            )
        except Exception as error:
            _logger.error("Partner activity append failed: %s", error)
            return PartnerActivityResponse(
                message_id=envelope.header.message_id, status="ERROR",
                error_code=G2PRegistryErrorCodes.UNEXPECTED_ERROR.value[1],
                error_message=G2PRegistryErrorCodes.UNEXPECTED_ERROR.value[0],
            )
