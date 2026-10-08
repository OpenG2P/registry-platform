"""Publish one DCI async search result to the caller's PARTNER WebSub topic.

A process restart after the HTTP ACK drops this callback. There is no queue.
"""

import logging
from datetime import datetime

from openg2p_fastapi_common.context import get_async_session_maker
from openg2p_registry_core.errors import G2PRegistryException
from openg2p_registry_core.helpers import WebsubHelper
from openg2p_registry_core.helpers.partner_management import partner_reference_id
from openg2p_registry_core.models import OutgoingTopic, OutgoingTopicType, ProcessStatusEnum
from sqlalchemy import select

from ..helpers import DciKeymanagerHelper, DciRequestResponseHelper
from ..schemas import (
    DciAckEnvelope,
    DciAckError,
    DciAckMessage,
    DciSearchRequestEnvelope,
    DciSearchResponseEnvelope,
    DciStatusCode,
)
from ....config import Settings
from .g2p_dci_service import G2PDciService

_logger = logging.getLogger("g2p-dci-async-search")
_SIGNATURE_DISABLED_MARKER = "signature_validation_disabled"


def ack_envelope(correlation_id: str, ack_status: str, error: Exception | None = None) -> DciAckEnvelope:
    ack_error = None
    if error is not None:
        if isinstance(error, G2PRegistryException):
            code, message = error.code, error.message
        else:
            code, message = "rjct.internal", str(error)
        ack_error = DciAckError(code=code, message=message)
    return DciAckEnvelope(
        message=DciAckMessage(
            ack_status=ack_status,
            timestamp=datetime.now().isoformat(),
            correlation_id=correlation_id,
            error=ack_error,
        )
    )


async def find_partner_topic(sender_id: str) -> str | None:
    """Return the hub topic URL, or None when no active registered PARTNER row exists."""
    partner_id = partner_reference_id(sender_id)
    if not partner_id:
        return None
    session_maker = get_async_session_maker()
    async with session_maker() as session:
        topic = (
            await session.execute(
                select(OutgoingTopic).where(
                    OutgoingTopic.topic_type == OutgoingTopicType.PARTNER.value,
                    OutgoingTopic.partner_id == partner_id,
                    OutgoingTopic.is_active.is_(True),
                )
            )
        ).scalar_one_or_none()
        if topic is None or topic.websub_register_status != ProcessStatusEnum.PROCESSED.value:
            return None
        return topic.websub_topic


async def publish_dci_search(
    envelope: DciSearchRequestEnvelope,
    scopes_by_ref,
    correlation_id: str,
    websub_topic: str,
) -> None:
    helper = DciRequestResponseHelper()
    try:
        items = await G2PDciService().search(
            envelope.signature,
            envelope.header,
            envelope.message,
            consent_scopes_by_ref=scopes_by_ref,
        )
        callback = helper.construct_on_search_response(items, envelope, correlation_id)
    except Exception as error:
        _logger.exception("Async DCI search failed for correlation_id=%s", correlation_id)
        if isinstance(error, G2PRegistryException):
            code, message = error.code, error.message
        else:
            code, message = "rjct.internal", "Search failed."
        callback = helper.construct_on_search_response(
            [],
            envelope,
            correlation_id,
            status=DciStatusCode.REJECTED.value,
            status_reason_code=code,
            status_reason_message=message,
        )
    callback.signature = await _sign(callback)
    try:
        publisher = WebsubHelper.get_component() or WebsubHelper()
        publisher.publish(websub_topic, callback.model_dump())
    except Exception:
        _logger.exception(
            "WebSub publish failed for correlation_id=%s topic=%s",
            correlation_id,
            websub_topic,
        )


async def _sign(response_env: DciSearchResponseEnvelope) -> str:
    if not Settings.get_config().signature_validation_enabled:
        return _SIGNATURE_DISABLED_MARKER
    try:
        return await DciKeymanagerHelper().generate_signature(response_env.header, response_env.message)
    except Exception:
        _logger.exception("On-search signing failed; publishing unsigned marker")
        return _SIGNATURE_DISABLED_MARKER
