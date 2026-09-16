#!/usr/bin/env python3
"""Provision a dedicated Keycloak user for functional UI tests.

Reads FUNC_* / KEYCLOAK admin env vars.
"""

from __future__ import annotations

import os
import sys

import httpx

FUNC_USERNAME = os.environ.get("FUNC_OIDC_USERNAME", "func-ft-e2e")
FUNC_PASSWORD = os.environ.get("FUNC_OIDC_PASSWORD", "func-ft-e2e-pass")
FUNC_ROLES = [
    role.strip()
    for role in os.environ.get(
        "FUNC_OIDC_ROLES",
        "Operations Administrator,Technical Administrator",
    ).split(",")
    if role.strip()
]
AWE_ADMIN_CLIENT = os.environ.get("FUNC_AWE_ADMIN_CLIENT_ID", "awe-admin-portal")
AWE_ADMIN_ROLE = os.environ.get("FUNC_AWE_ADMIN_ROLE", "AWE_ADMIN")
AWE_STAGE1_USERNAME = os.environ.get("FUNC_AWE_STAGE1_USERNAME", "alex.carter")
AWE_STAGE1_PASSWORD = os.environ.get("FUNC_AWE_STAGE1_PASSWORD", "alex.carter-pass")
AWE_STAGE2_USERNAME = os.environ.get("FUNC_AWE_STAGE2_USERNAME", "nina.patel")
AWE_STAGE2_PASSWORD = os.environ.get("FUNC_AWE_STAGE2_PASSWORD", "nina.patel-pass")


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
    if r.status_code != 200:
        raise RuntimeError(f"keycloak admin login failed ({r.status_code}): {r.text[:200]}")
    return r.json()["access_token"]


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _realm_url(cfg: dict) -> str:
    return f"{cfg['keycloak_base']}/admin/realms/{cfg['realm']}"


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


def _find_client(cfg: dict, h: dict[str, str], client_id: str) -> dict | None:
    r = httpx.get(
        f"{_realm_url(cfg)}/clients",
        params={"clientId": client_id},
        headers=h,
        verify=cfg["verify_tls"],
        timeout=20,
    )
    r.raise_for_status()
    clients = r.json()
    return clients[0] if clients else None


def _ensure_direct_access_grants(cfg: dict, h: dict[str, str], client: dict) -> str:
    if client.get("directAccessGrantsEnabled"):
        return "already-on"
    httpx.put(
        f"{_realm_url(cfg)}/clients/{client['id']}",
        headers=h,
        json={**client, "directAccessGrantsEnabled": True},
        verify=cfg["verify_tls"],
        timeout=20,
    ).raise_for_status()
    return "enabled"


def _ensure_user(cfg: dict, h: dict[str, str], username: str) -> str:
    user_id = _find_user(cfg, h, username)
    if user_id:
        return user_id
    first_name, _, last_name = username.replace(".", " ").title().partition(" ")
    first_name = first_name or "Functional"
    last_name = last_name or "Tester"
    r = httpx.post(
        f"{_realm_url(cfg)}/users",
        headers=h,
        json={
            "username": username,
            "enabled": True,
            "emailVerified": True,
            "firstName": first_name,
            "lastName": last_name,
            "email": f"{username}@functional.invalid",
            "requiredActions": [],
        },
        verify=cfg["verify_tls"],
        timeout=20,
    )
    if r.status_code not in (201, 409):
        raise RuntimeError(f"could not create user '{username}' ({r.status_code}): {r.text[:200]}")
    user_id = _find_user(cfg, h, username)
    if not user_id:
        raise RuntimeError(f"user '{username}' still not found after create")
    return user_id


def _set_password(cfg: dict, h: dict[str, str], user_id: str, password: str) -> None:
    httpx.put(
        f"{_realm_url(cfg)}/users/{user_id}/reset-password",
        headers=h,
        json={"type": "password", "value": password, "temporary": False},
        verify=cfg["verify_tls"],
        timeout=20,
    ).raise_for_status()
    httpx.put(
        f"{_realm_url(cfg)}/users/{user_id}",
        headers=h,
        json={"requiredActions": []},
        verify=cfg["verify_tls"],
        timeout=20,
    ).raise_for_status()


def _grant_client_roles(
    cfg: dict, h: dict[str, str], user_id: str, client: dict, role_names: list[str]
) -> None:
    r = httpx.get(
        f"{_realm_url(cfg)}/clients/{client['id']}/roles",
        headers=h,
        verify=cfg["verify_tls"],
        timeout=20,
    )
    r.raise_for_status()
    available = {role["name"]: role for role in r.json()}
    missing = [name for name in role_names if name not in available]
    if missing:
        raise RuntimeError(
            f"client '{client['clientId']}' has no roles {missing} — "
            f"available: {sorted(available)}"
        )
    httpx.post(
        f"{_realm_url(cfg)}/users/{user_id}/role-mappings/clients/{client['id']}",
        headers=h,
        json=[available[name] for name in role_names],
        verify=cfg["verify_tls"],
        timeout=20,
    ).raise_for_status()


def ensure_user(cfg: dict, username: str, password: str, *, grant_awe_admin: bool = True) -> str:
    token = _admin_token(cfg)
    h = _headers(token)

    client = _find_client(cfg, h, cfg["client_id"])
    if not client:
        raise RuntimeError(
            f"keycloak client '{cfg['client_id']}' not found in realm '{cfg['realm']}'"
        )
    dag = _ensure_direct_access_grants(cfg, h, client)

    user_id = _ensure_user(cfg, h, username)
    _set_password(cfg, h, user_id, password)
    _grant_client_roles(cfg, h, user_id, client, cfg["roles"])

    awe_client = _find_client(cfg, h, AWE_ADMIN_CLIENT)
    awe_status = "skipped"
    if grant_awe_admin and awe_client:
        _grant_client_roles(cfg, h, user_id, awe_client, [AWE_ADMIN_ROLE])
        awe_status = f"{AWE_ADMIN_ROLE}@{AWE_ADMIN_CLIENT}"

    return f"user={username} roles={cfg['roles']} awe_admin={awe_status} directAccessGrants={dag}"


def main() -> int:
    cfg = {
        "keycloak_base": _env("FUNC_KEYCLOAK_BASE"),
        "realm": _env("FUNC_KEYCLOAK_REALM", "staff"),
        "client_id": _env("FUNC_OIDC_CLIENT_ID"),
        "roles": FUNC_ROLES,
        "admin_user": _env("FUNC_KEYCLOAK_ADMIN_USER", "admin"),
        "admin_password": _env("FUNC_KEYCLOAK_ADMIN_PASSWORD"),
        "verify_tls": _verify_tls(),
    }
    if not (cfg["keycloak_base"] and cfg["admin_password"] and cfg["client_id"]):
        print("[keycloak_seed] missing FUNC_KEYCLOAK_BASE / admin password / client id — skip")
        return 0
    try:
        statuses = [
            ensure_user(cfg, FUNC_USERNAME, FUNC_PASSWORD),
            ensure_user(cfg, AWE_STAGE1_USERNAME, AWE_STAGE1_PASSWORD, grant_awe_admin=False),
            ensure_user(cfg, AWE_STAGE2_USERNAME, AWE_STAGE2_PASSWORD, grant_awe_admin=False),
        ]
    except Exception as exc:  # noqa: BLE001
        print(f"[keycloak_seed] FAILED to provision users: {exc}", file=sys.stderr)
        return 1
    for status in statuses:
        print(f"[keycloak_seed] {status}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
