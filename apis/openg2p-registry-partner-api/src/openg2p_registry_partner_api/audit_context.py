"""Who called and how it went, for the partner API's audit trail.

Partner calls are authenticated inside the controllers (a detached JWS over the
envelope, verified against the sender's Partner Management key), and the
controllers answer HTTP 200 even when they reject a request (the DCI ``rjct``
envelope, the activity API's ``ERROR`` status) because partners depend on those
shapes. The audit middleware sees neither, so the controllers say so here:

    set_audit_actor(request, header.sender_id, verified=True)   # after the signature checks out
    set_audit_outcome(request, "failure", reason="rjct.search_criteria.invalid")

Only identifiers and status/error codes go in: never request bodies, record
data or exception text. Nothing here can fail a request.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import Request

from .config import Settings

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)

ACTOR_STATE_KEY = "audit_actor"
OUTCOME_STATE_KEY = "audit_outcome"
REASON_STATE_KEY = "audit_reason"

_OUTCOMES = ("success", "failure", "denied")


def set_audit_actor(
    request: Request, partner_id: Optional[str], *, verified: bool, name: Optional[str] = None
) -> None:
    """Record the calling partner once it is authenticated.

    ``verified=False`` marks a sender id taken from an envelope whose signature
    was not checked (signature validation switched off for testing), so the trail
    never presents a claimed identity as a proven one.
    """
    try:
        if not partner_id:
            return
        actor = {"type": "service", "id": str(partner_id), "verified": bool(verified)}
        if name and name != partner_id:
            actor["name"] = str(name)
        setattr(request.state, ACTOR_STATE_KEY, actor)
    except Exception:
        _logger.warning("Could not record audit actor", exc_info=True)


def set_audit_outcome(request: Request, outcome: str, *, reason: Optional[str] = None) -> None:
    """Override the outcome the HTTP status would give (200 carrying an error envelope).

    ``reason`` is a status or error code (e.g. ``rjct.search_criteria.invalid``),
    not a message.
    """
    try:
        if outcome not in _OUTCOMES:
            return
        setattr(request.state, OUTCOME_STATE_KEY, outcome)
        if reason:
            setattr(request.state, REASON_STATE_KEY, str(reason)[:100])
    except Exception:
        _logger.warning("Could not record audit outcome", exc_info=True)
