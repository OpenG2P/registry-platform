#!/usr/bin/env python3
"""Seed Partner Management + Consent Manager for the functional compose gate.

1. Grant Keycloak service-account roles (partner_manager / CONSENT_MANAGER_ADMIN)
2. Onboard the functional test partner + key in PM
3. Create CM partner binding + policy for Individual DCI scopes

Idempotent. Env: FUNC_KEYCLOAK_*, FUNC_PM_*, FUNC_CM_* (see run-compose-gate.sh).
"""

from __future__ import annotations

import os
import sys

import httpx

from helpers.partner_consent_keys import (
    DEFAULT_CM_AUDIENCE,
    DEFAULT_CONTROLLER_ID,
    DEFAULT_DATA_SCOPES,
    DEFAULT_KID,
    DEFAULT_PARTNER_ID,
    DEFAULT_PURPOSE,
    TEST_PRIVATE_KEY_PEM,
)
from helpers.partner_signing import public_pem_and_alg


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def _verify_tls() -> bool:
    return _env("FUNC_VERIFY_TLS", "false").lower() not in ("false", "0", "no")


def _admin_token(cfg: dict) -> str:
    r = httpx.post(
        f"{cfg['keycloak_base']}/realms/master/protocol/openid-connect/token",
        data={
            "grant_type": "password",
            "client_id": "admin-cli",
            "username": cfg["admin_user"],
            "password": cfg["admin_password"],
        },
        verify=cfg["verify_tls"],
        timeout=20,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _realm_url(cfg: dict) -> str:
    return f"{cfg['keycloak_base']}/admin/realms/{cfg['realm']}"


def _find_client(cfg: dict, h: dict[str, str], client_id: str) -> dict | None:
    r = httpx.get(
        f"{_realm_url(cfg)}/clients",
        params={"clientId": client_id, "exact": "true"},
        headers=h,
        verify=cfg["verify_tls"],
        timeout=20,
    )
    r.raise_for_status()
    clients = r.json()
    return clients[0] if clients else None


def _find_user(cfg: dict, h: dict[str, str], username: str) -> str | None:
    r = httpx.get(
        f"{_realm_url(cfg)}/users",
        params={"username": username, "exact": "true"},
        headers=h,
        verify=cfg["verify_tls"],
        timeout=20,
    )
    r.raise_for_status()
    users = r.json()
    return users[0]["id"] if users else None


def _grant_client_role(
    cfg: dict, h: dict[str, str], user_id: str, client: dict, role_name: str
) -> None:
    r = httpx.get(
        f"{_realm_url(cfg)}/clients/{client['id']}/roles/{role_name}",
        headers=h,
        verify=cfg["verify_tls"],
        timeout=20,
    )
    r.raise_for_status()
    role = r.json()
    httpx.post(
        f"{_realm_url(cfg)}/users/{user_id}/role-mappings/clients/{client['id']}",
        headers=h,
        json=[role],
        verify=cfg["verify_tls"],
        timeout=20,
    ).raise_for_status()


def ensure_service_account_roles(cfg: dict) -> list[str]:
    """Grant admin roles to PM/CM confidential client service accounts."""
    token = _admin_token(cfg)
    h = _headers(token)
    statuses: list[str] = []

    grants = [
        ("partner-management", "partner_manager"),
        ("consent-manager", "CONSENT_MANAGER_ADMIN"),
    ]
    for client_id, role_name in grants:
        client = _find_client(cfg, h, client_id)
        if not client:
            raise RuntimeError(f"Keycloak client '{client_id}' not found in realm '{cfg['realm']}'")
        sa_username = f"service-account-{client_id}"
        user_id = _find_user(cfg, h, sa_username)
        if not user_id:
            raise RuntimeError(
                f"service account user '{sa_username}' missing — "
                "ensure serviceAccountsEnabled=true on the client"
            )
        _grant_client_role(cfg, h, user_id, client, role_name)
        statuses.append(f"{client_id}/{role_name}=granted")
    return statuses


def _client_credentials_token(
    token_url: str, client_id: str, client_secret: str, *, verify: bool
) -> str:
    r = httpx.post(
        token_url,
        data={
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
        },
        verify=verify,
        timeout=20,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def _already_exists_pm(r: httpx.Response) -> bool:
    if r.status_code == 409:
        return True
    if r.status_code != 400:
        return False
    body = r.text or ""
    return "PM-PRT-409" in body or "already exists" in body.lower()


def ensure_pm_partner(cfg: dict) -> str:
    partner_api = cfg["pm_partner_api_url"]
    admin = cfg["pm_admin_url"]
    partner_id = cfg["pm_partner_id"]
    kid = cfg["pm_kid"]

    key_url = f"{partner_api}/keys/{partner_id}/{kid}"
    if httpx.get(key_url, verify=cfg["verify_tls"], timeout=20).status_code == 200:
        return "exists"

    pub_pem, alg = public_pem_and_alg(cfg["pm_private_key_pem"])
    token = _client_credentials_token(
        cfg["pm_token_url"],
        cfg["pm_client_id"],
        cfg["pm_client_secret"],
        verify=cfg["verify_tls"],
    )
    h = _headers(token)
    key_input = {"public_key": pub_pem, "kid": kid, "algorithm": alg}

    r = httpx.post(
        f"{admin}/partners/requests/onboarding",
        headers=h,
        json={
            "partner_id": partner_id,
            "name": "Functional Gate Partner",
            "org_name": "OpenG2P Functional Testing",
            "description": "Compose-gate partner for DCI consent enforcement tests.",
            "keys": [key_input],
        },
        verify=cfg["verify_tls"],
        timeout=30,
    )
    outcome = "onboarded"
    if _already_exists_pm(r):
        outcome = "key-added"
        httpx.post(
            f"{admin}/partners/{partner_id}/enable",
            headers=h,
            verify=cfg["verify_tls"],
            timeout=20,
        )
        r = httpx.post(
            f"{admin}/partners/requests/key-update",
            headers=h,
            json={"partner_id": partner_id, "keys": [key_input]},
            verify=cfg["verify_tls"],
            timeout=30,
        )
    if r.status_code >= 400:
        raise RuntimeError(f"PM seed failed: HTTP {r.status_code} -> {(r.text or '')[:400]}")
    request_id = r.json()["id"]
    a = httpx.post(
        f"{admin}/partners/requests/{request_id}/approve",
        headers=h,
        json={"notes": "auto-approved by functional partner_consent_seed"},
        verify=cfg["verify_tls"],
        timeout=30,
    )
    a.raise_for_status()

    if httpx.get(key_url, verify=cfg["verify_tls"], timeout=20).status_code != 200:
        raise RuntimeError(f"PM key {partner_id}/{kid} still not servable after seed")
    return outcome


def _find_cm_partner_id(cfg: dict, headers: dict[str, str]) -> str | None:
    r = httpx.get(
        f"{cfg['cm_staff_url']}/consent/v1/partners",
        headers=headers,
        verify=cfg["verify_tls"],
        timeout=20,
    )
    r.raise_for_status()
    for partner in r.json():
        if partner.get("audience") == cfg["cm_audience"]:
            return partner.get("id")
    return None


def ensure_cm_binding(cfg: dict) -> str:
    token = _client_credentials_token(
        cfg["cm_token_url"],
        cfg["cm_client_id"],
        cfg["cm_client_secret"],
        verify=cfg["verify_tls"],
    )
    headers = _headers(token)
    partner_id = _find_cm_partner_id(cfg, headers)
    created = False
    if not partner_id:
        r = httpx.post(
            f"{cfg['cm_staff_url']}/consent/v1/partners",
            headers=headers,
            json={
                "name": "Functional Gate Partner",
                "audience": cfg["cm_audience"],
                "controller_id": cfg["controller_id"],
                "partner_mgmt_id": cfg["pm_partner_id"],
            },
            verify=cfg["verify_tls"],
            timeout=30,
        )
        if r.status_code in (400, 409):
            partner_id = _find_cm_partner_id(cfg, headers)
            if not partner_id:
                raise RuntimeError(f"CM binding create failed: {r.status_code} {(r.text or '')[:300]}")
        else:
            r.raise_for_status()
            partner_id = r.json()["id"]
            created = True

    policy = httpx.put(
        f"{cfg['cm_staff_url']}/consent/v1/partners/{partner_id}/policy",
        headers=headers,
        json={
            "allowed_data_scopes": cfg["data_scopes"],
            "allowed_purposes": [cfg["purpose"]],
            "allowed_subject_id_types": ["national_id"],
            "allowed_signing_algs": ["EdDSA", "ES256", "RS256"],
            "max_validity_duration": "P1Y",
            "fetch_type": "oneshot",
        },
        verify=cfg["verify_tls"],
        timeout=30,
    )
    policy.raise_for_status()
    return "created" if created else "exists"


def main() -> int:
    keycloak_base = _env("FUNC_KEYCLOAK_BASE")
    if not keycloak_base:
        print("[partner_consent_seed] FUNC_KEYCLOAK_BASE missing — skip")
        return 0

    cfg = {
        "keycloak_base": keycloak_base.rstrip("/"),
        "realm": _env("FUNC_KEYCLOAK_REALM", "staff"),
        "admin_user": _env("FUNC_KEYCLOAK_ADMIN_USER", "admin"),
        "admin_password": _env("FUNC_KEYCLOAK_ADMIN_PASSWORD", "admin"),
        "verify_tls": _verify_tls(),
        "pm_partner_api_url": _env("FUNC_PM_PARTNER_API_URL", "http://127.0.0.1:18090").rstrip("/"),
        "pm_admin_url": _env("FUNC_PM_ADMIN_URL", "http://127.0.0.1:18091").rstrip("/"),
        "pm_token_url": _env(
            "FUNC_PM_TOKEN_URL",
            f"{keycloak_base.rstrip('/')}/realms/{_env('FUNC_KEYCLOAK_REALM', 'staff')}/protocol/openid-connect/token",
        ),
        "pm_client_id": _env("FUNC_PM_CLIENT_ID", "partner-management"),
        "pm_client_secret": _env("FUNC_PM_CLIENT_SECRET", "func-gate-pm-admin-secret"),
        "pm_partner_id": _env("FUNC_PM_PARTNER_ID", DEFAULT_PARTNER_ID),
        "pm_kid": _env("FUNC_PM_KID", DEFAULT_KID),
        "pm_private_key_pem": _env("FUNC_PM_PRIVATE_KEY_PEM", TEST_PRIVATE_KEY_PEM),
        "cm_staff_url": _env("FUNC_CM_STAFF_URL", "http://127.0.0.1:18092").rstrip("/"),
        "cm_token_url": _env(
            "FUNC_CM_TOKEN_URL",
            f"{keycloak_base.rstrip('/')}/realms/{_env('FUNC_KEYCLOAK_REALM', 'staff')}/protocol/openid-connect/token",
        ),
        "cm_client_id": _env("FUNC_CM_CLIENT_ID", "consent-manager"),
        "cm_client_secret": _env("FUNC_CM_CLIENT_SECRET", "func-gate-cm-admin-secret"),
        "cm_audience": _env("FUNC_CM_AUDIENCE", DEFAULT_CM_AUDIENCE),
        "controller_id": _env("FUNC_CONTROLLER_ID", DEFAULT_CONTROLLER_ID),
        "purpose": _env("FUNC_CONSENT_PURPOSE", DEFAULT_PURPOSE),
        "data_scopes": [
            s.strip()
            for s in _env("FUNC_DATA_SCOPES", ",".join(DEFAULT_DATA_SCOPES)).split(",")
            if s.strip()
        ],
    }

    try:
        for status in ensure_service_account_roles(cfg):
            print(f"[partner_consent_seed] keycloak {status}")
        pm_status = ensure_pm_partner(cfg)
        print(f"[partner_consent_seed] PM partner {cfg['pm_partner_id']}/{cfg['pm_kid']}: {pm_status}")
        cm_status = ensure_cm_binding(cfg)
        print(f"[partner_consent_seed] CM binding {cfg['cm_audience']}: {cm_status}")
    except Exception as exc:  # noqa: BLE001
        print(f"[partner_consent_seed] FAILED: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    # Allow `python scripts/partner_consent_seed.py` from functional-testing/
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    raise SystemExit(main())
