"""Build signed DCI search envelopes for functional partner / consent tests."""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from helpers.partner_consent_keys import (
    DEFAULT_CM_AUDIENCE,
    DEFAULT_CONTROLLER_ID,
    DEFAULT_DATA_SCOPES,
    DEFAULT_KID,
    DEFAULT_PURPOSE,
    DEFAULT_SENDER_ID,
    TEST_PRIVATE_KEY_PEM,
)
from helpers.partner_signing import (
    alg_for_key,
    load_private_key_pem,
    sign_consent_jws,
    sign_dci_envelope,
)


def _env(name: str, default: str) -> str:
    return os.environ.get(name, default).strip() or default


def partner_private_key():
    pem = _env("FUNC_PM_PRIVATE_KEY_PEM", TEST_PRIVATE_KEY_PEM)
    return load_private_key_pem(pem)


def make_consent_claims(
    *,
    data_scopes: list[str] | None = None,
    audience: str | None = None,
    purpose: str | None = None,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    return {
        "@context": "https://openg2p.org/contexts/consent_object.jsonld",
        "@type": "ConsentObject",
        "jti": uuid.uuid4().hex,
        "subject_id": {"type": "national_id", "value": "FUNC-GATE-SUBJECT"},
        "data_controller": _env("FUNC_CONTROLLER_ID", DEFAULT_CONTROLLER_ID),
        "aud": audience or _env("FUNC_CM_AUDIENCE", DEFAULT_CM_AUDIENCE),
        "purpose": {
            "code": purpose or _env("FUNC_CONSENT_PURPOSE", DEFAULT_PURPOSE),
            "text": "Functional gate partner share",
        },
        "data_scopes": list(data_scopes or DEFAULT_DATA_SCOPES),
        "fetch_type": "oneshot",
        "validity": {
            "valid_from": now.isoformat(),
            "valid_until": (now + timedelta(days=30)).isoformat(),
        },
        "issued_at": now.isoformat(),
    }


def build_search_envelope(
    *,
    first_name: str,
    reg_type: str = "Individual",
    with_consent: bool = True,
    data_scopes: list[str] | None = None,
    audience: str | None = None,
    sender_id: str | None = None,
    priv=None,
    kid: str | None = None,
) -> dict[str, Any]:
    """Fully signed DCI sync/search envelope (or unsigned consent when disabled)."""
    priv = priv or partner_private_key()
    kid = kid or _env("FUNC_PM_KID", DEFAULT_KID)
    alg = alg_for_key(priv)
    sender = sender_id or _env("FUNC_DCI_SENDER_ID", DEFAULT_SENDER_ID)
    now = datetime.now(timezone.utc)
    now_s = now.strftime("%Y-%m-%dT%H:%M:%SZ")

    consent_jws = None
    if with_consent:
        consent_jws = sign_consent_jws(
            make_consent_claims(data_scopes=data_scopes, audience=audience),
            priv,
            kid,
            alg=alg,
        )

    search_criteria: dict[str, Any] = {
        "version": "1.0.0",
        "reg_type": reg_type,
        "reg_record_type": "spdci-extensions-dci:Person",
        "query_type": "expression",
        "query": {
            "type": "expression",
            "value": {
                "expression": {
                    "query": {
                        "first_name": {"$eq": first_name},
                    }
                }
            },
        },
        "pagination": {"page_size": 10, "page_number": 1},
    }
    if consent_jws is not None:
        search_criteria["authorize"] = {"consent_jws": consent_jws}

    header = {
        "version": "1.0.0",
        "message_id": f"msg-{uuid.uuid4().hex[:24]}",
        "message_ts": now_s,
        "action": "search",
        "sender_id": sender,
        "sender_uri": "http://func-partner.invalid",
        "receiver_id": "openg2p-registry",
        "total_count": 1,
        "is_msg_encrypted": False,
        "meta": {},
    }
    message = {
        "transaction_id": f"txn-{uuid.uuid4().hex[:24]}",
        "search_request": [
            {
                "reference_id": f"ref-{uuid.uuid4().hex[:24]}",
                "timestamp": now_s,
                "locale": "eng",
                "search_criteria": search_criteria,
            }
        ],
    }
    signature = sign_dci_envelope(header, message, priv, kid, alg=alg)
    return {"signature": signature, "header": header, "message": message}
