"""What a request actually DID, for the audit trail.

The middleware can see the method, the path and the status code. That is enough
to record that a call happened and whether it was allowed, and it is what the
audit store held until now: every event read `action=unknown`, with no resource
type and no resource id.

It is not enough to investigate anything. "The agent called /vc/issue and got a
200" does not say which beneficiary was given a credential; "the agent called
/vc/verify and got a 200" does not say whether the card they were shown was
genuine -- a forged credential is a perfectly successful HTTP call. Both
questions are the reason the trail exists.

Only the handler knows those answers, so it says so:

    set_audit(request, action="verify_credential",
              resource_type="verifiable_credential",
              resource_id=farmer_id, outcome="failure",
              detail={"verification_status": "INVALID"})

Nothing here can fail a request: an audit trail that can break issuance is worse
than a thin one.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from fastapi import Request

from .config import Settings

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)

STATE_KEY = "audit_context"


def set_audit(
    request: Request,
    *,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    subject: Optional[str] = None,
    outcome: Optional[str] = None,
    detail: Optional[Dict[str, Any]] = None,
) -> None:
    """Record what this request did. Call it as soon as the answer is known.

    `outcome` overrides the status-code mapping, and exists for one case the
    status code gets wrong: a credential that fails verification is a successful
    request carrying bad news. Left alone it would be filed next to genuine
    cards as `success`, making the trail useless for the question it is most
    likely to be asked -- were forged credentials presented, and where.
    """
    try:
        current: Dict[str, Any] = getattr(request.state, STATE_KEY, None) or {}
        for key, value in (
            ("action", action),
            ("resource_type", resource_type),
            ("resource_id", resource_id),
            ("subject", subject),
            ("outcome", outcome),
        ):
            if value is not None:
                current[key] = value
        if detail:
            current.setdefault("detail", {}).update(detail)
        setattr(request.state, STATE_KEY, current)
    except Exception:
        # Never let bookkeeping break the request it is describing.
        _logger.warning("Could not record audit context", exc_info=True)


def get_audit(request: Request) -> Dict[str, Any]:
    try:
        return getattr(request.state, STATE_KEY, None) or {}
    except Exception:
        return {}
