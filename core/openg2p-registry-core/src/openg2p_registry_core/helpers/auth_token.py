"""Extract bearer tokens from FastAPI requests / auth principals."""

from __future__ import annotations

import base64
import json

from fastapi import Request


def bearer_from_request(request: Request) -> str | None:
    auth = getattr(getattr(request, "state", None), "auth", None)
    token = getattr(auth, "credentials", None) if auth else None
    if token and str(token).strip():
        return str(token).strip()
    header = request.headers.get("authorization", "")
    parts = header.split(maxsplit=1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return None


def requester_sub_from_request(request: Request) -> str | None:
    auth = getattr(getattr(request, "state", None), "auth", None)
    sub = getattr(auth, "sub", None) if auth else None
    return str(sub).strip() if sub else None


def _jwt_claims(token: str) -> dict:
    """Read claims from a token the auth middleware has already validated."""
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        claims = json.loads(base64.urlsafe_b64decode(payload))
    except Exception:
        return {}
    return claims if isinstance(claims, dict) else {}


def _claim(claims: dict, key: str) -> str | None:
    value = claims.get(key)
    text = str(value).strip() if value else ""
    return text or None


def staff_from_request(request: Request) -> dict[str, str | None]:
    """Staff fields Novu needs. Missing name or email stays None."""
    token = bearer_from_request(request)
    claims = _jwt_claims(token) if token else {}
    return {
        "preferred_username": _claim(claims, "preferred_username"),
        "name": _claim(claims, "name"),
        "email": _claim(claims, "email"),
    }


def preferred_username_from_request(request: Request) -> str | None:
    """Novu staff subscriber id. Keycloak preferred_username, not sub."""
    return staff_from_request(request)["preferred_username"]
