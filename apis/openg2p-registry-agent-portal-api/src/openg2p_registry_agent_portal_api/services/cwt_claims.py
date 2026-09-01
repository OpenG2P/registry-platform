"""Decode a claim-169 CWT far enough to SHOW an agent what was verified.

Not a second verifier. verify-service owns the trust decision -- whether the
signature is good and whose key signed it -- and nothing here influences that.
This only unwraps the payload so the screen can display the fields the verdict
applies to, which verify-service does not return: its answer is
`{"verificationStatus": "SUCCESS"}` and nothing more.

That gap matters. "Valid" on its own tells an agent a card is genuine but not
WHOSE it is, so they cannot do the one check that stops a real credential being
used by the wrong person: compare the QR against the card in their hand. The
signature covers this payload, so what is printed here is exactly what was
signed -- but only display it once verify-service has said SUCCESS. Rendering
the contents of an unverified token shows an agent attacker-chosen text.

Structure (Certify -> PixelPass): hex -> CBOR tag 61 (CWT) -> tag 18
(COSE_Sign1) -> [protected, unprotected, payload, signature], payload being a
CWT claims map.
"""

from __future__ import annotations

import binascii
import logging
from typing import Any, Dict, Optional

import cbor2

from ..config import Settings

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)

CWT_TAG = 61
COSE_SIGN1_TAG = 18

# Registered CWT claims (RFC 8392) we surface. 7 (cti) is an opaque token id.
_CWT_CLAIMS = {
    1: "Issuer",
    2: "Subject",
    3: "Audience",
    4: "Expires",
    5: "Not before",
    6: "Issued at",
}
_DATE_CLAIMS = {4, 5, 6}
CLAIM_169 = 169

# claim-169's own key registry, from PixelPass 0.8.0's CLAIM_169_KEY_MAPPER.
# The labels we put in qrSettings are rewritten to these NUMBERS on the way into
# the CBOR, so decoding has to rewrite them back or the screen shows "4" and "8".
#
# Derived from the constant order in that mapper and checked against a real
# issued credential, which carried 2/3/4/8/9 for Version/Language/Full Name/
# Date of Birth/Gender. Anything not listed is shown as "Field <n>" rather than
# guessed at -- a wrong label on a verification screen is worse than a dull one.
_CLAIM_169_KEYS = {
    2: "Version",
    3: "Language",
    4: "Full Name",
    5: "First Name",
    6: "Middle Name",
    7: "Last Name",
    8: "Date of Birth",
    9: "Gender",
    10: "Address",
    11: "Email ID",
    12: "Phone Number",
    13: "Nationality",
    14: "Marital Status",
    15: "Guardian",
    16: "Binary Image",
    17: "Binary Image Format",
    18: "Best Quality Fingers",
    35: "Data",
    36: "Data format",
    37: "Data sub format",
    38: "Data issuer",
}

# Enumerated values are numbers on the wire too.
_CLAIM_169_VALUES = {
    "Gender": {1: "Male", 2: "Female", 3: "Others"},
    "Marital Status": {1: "Unmarried", 2: "Married", 3: "Divorced"},
}

# Biometric templates and images are large binary blobs. They are part of the
# signed payload but there is nothing useful to print, so they are summarised.
_BINARY_KEYS = frozenset({"Binary Image", "Face", "Right Iris", "Left Iris", "Voice"})

# The registry has no identifier key, so the Farmer ID rides in "Data" (see the
# qrSettings comment in the registry chart). Relabel it on the way out so the
# agent sees what it is instead of the generic slot name.
DATA_LABEL = "Farmer ID"


def _untag(obj: Any, expected: int) -> Any:
    """Unwrap a CBOR tag, tolerating its absence.

    Certify emits tag 61 wrapping tag 18, but COSE_Sign1 is legal untagged and
    other issuers do omit it. Requiring the tag would reject credentials whose
    signature is perfectly good.
    """
    if isinstance(obj, cbor2.CBORTag):
        if obj.tag == expected:
            return obj.value
        # A tag we did not expect: hand it back and let the caller's shape
        # check decide, rather than silently unwrapping something else.
        return obj.value if obj.tag in (CWT_TAG, COSE_SIGN1_TAG) else obj
    return obj


def _render(label: str, value: Any) -> Any:
    if label in _BINARY_KEYS or isinstance(value, (bytes, bytearray)):
        return f"<{len(value)} bytes>" if isinstance(value, (bytes, bytearray)) else value
    mapped = _CLAIM_169_VALUES.get(label)
    if mapped and isinstance(value, int):
        return mapped.get(value, value)
    return value


def _decode_169(raw: Any) -> Dict[str, Any]:
    """Flatten the claim-169 body into label -> value."""
    if isinstance(raw, (bytes, bytearray)):
        raw = cbor2.loads(raw)
    # Certify nests the payload under a "claim169" key.
    if isinstance(raw, dict) and len(raw) == 1:
        only = next(iter(raw.values()))
        if isinstance(only, dict):
            raw = only
    if not isinstance(raw, dict):
        return {}

    out: Dict[str, Any] = {}
    for key, value in raw.items():
        label = _CLAIM_169_KEYS.get(key, f"Field {key}") if isinstance(key, int) else str(key)
        if label == "Data":
            label = DATA_LABEL
        out[label] = _render(label, value)
    return out


def decode_claims(hex_payload: str) -> Optional[Dict[str, Any]]:
    """Return displayable claims from a hex-encoded claim-169 CWT.

    Returns None on anything unexpected. A failure to decode must never change
    the verdict: verify-service has already ruled on the signature, and showing
    no detail is a far better outcome than implying a good card is bad.
    """
    try:
        message = _untag(_untag(cbor2.loads(binascii.unhexlify(hex_payload)), CWT_TAG),
                         COSE_SIGN1_TAG)
        if not isinstance(message, (list, tuple)) or len(message) != 4:
            return None
        payload = cbor2.loads(message[2]) if isinstance(message[2], (bytes, bytearray)) \
            else message[2]
        if not isinstance(payload, dict):
            return None

        claims: Dict[str, Any] = {}
        for key, label in _CWT_CLAIMS.items():
            if key in payload:
                value = payload[key]
                if key in _DATE_CLAIMS and isinstance(value, int):
                    from datetime import datetime, timezone
                    value = datetime.fromtimestamp(value, timezone.utc).strftime(
                        "%Y-%m-%d %H:%M UTC"
                    )
                claims[label] = value
        if CLAIM_169 in payload:
            claims.update(_decode_169(payload[CLAIM_169]))
        return claims or None
    except Exception:
        # Deliberately broad: this is presentation only. Log for diagnosis and
        # fall back to showing the verdict alone.
        _logger.warning("Could not decode CWT payload for display", exc_info=True)
        return None


def subject_id(claims: Optional[Dict[str, Any]]) -> Optional[str]:
    """The identifier to record in the audit trail, if the QR carried one."""
    if not claims:
        return None
    value = claims.get(DATA_LABEL)
    return str(value) if value not in (None, "") else None
