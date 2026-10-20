"""Idempotent seeding of the sanity test partner into Partner Management (PM).

The signed e2e needs a real partner in PM whose public key matches the sanity's
private key, and an active PM **policy** for this registry's data controller that
allows the scopes the consent object asks for: the registry calls the Consent
Manager ``/validate``, and CM reads the policy of partner ``PARTNER_<AUD>`` from
PM. This module ensures both exist — creating them once via PM's admin API and
then leaving them in place (persistent test fixture, never deleted).

Flow (all idempotent):
  1. Key: if PM's key-fetch API already serves the (partner_id, kid), keep it.
     Otherwise, using a partner_manager admin token, submit an onboarding request
     with the derived public key AND the policy, and approve it → partner, key and
     policy active. If the partner already exists, submit a key-update request for
     the kid instead, approve it, and enable the partner. NB PM signals
     already-exists as HTTP 400 with body code PM-PRT-409, not HTTP 409 — see
     _already_exists().
  2. Policy: if PM's policy API already serves an active policy for this data
     controller covering the sanity scopes, keep it. Otherwise submit a ``policy``
     request and approve it (a new version supersedes the old one).
"""
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec, ed25519, rsa

import httpx


def public_pem_and_alg(private_pem: str):
    """Derive the SPKI public PEM + JWS algorithm from a PEM private key."""
    priv = serialization.load_pem_private_key(private_pem.encode("utf-8"), password=None)
    pub_pem = priv.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")
    if isinstance(priv, ed25519.Ed25519PrivateKey):
        alg = "EdDSA"
    elif isinstance(priv, ec.EllipticCurvePrivateKey):
        alg = "ES256"
    elif isinstance(priv, rsa.RSAPrivateKey):
        alg = "RS256"
    else:
        raise ValueError("unsupported private key type for PM seeding")
    return pub_pem, alg


def key_servable(cfg) -> bool:
    """True if PM's fetch API already serves the sanity (partner_id, kid)."""
    if not cfg.pm_partner_api_url:
        return False
    url = f"{cfg.pm_partner_api_url}/keys/{cfg.pm_partner_id}/{cfg.pm_kid}"
    r = httpx.get(url, verify=cfg.verify_tls, timeout=20)
    return r.status_code == 200


def _admin_token(cfg):
    """Obtain a client-credentials token for PM's admin API (SANITY_PM_ADMIN_*).

    The client must hold PM's `partner_manager` role. Returns None when no
    credentials are configured (PM auth off).
    """
    if not (cfg.pm_admin_token_url and cfg.pm_admin_client_secret):
        return None
    r = httpx.post(
        cfg.pm_admin_token_url,
        data={
            "grant_type": "client_credentials",
            "client_id": cfg.pm_admin_client_id,
            "client_secret": cfg.pm_admin_client_secret,
        },
        verify=cfg.verify_tls,
        timeout=20,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def _headers(token):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def _already_exists(r) -> bool:
    """True when PM is telling us the partner is already onboarded.

    PM does NOT use the HTTP status for this: it answers **400** and puts the
    real code in the body, e.g.

        {"errors":[{"code":"PM-PRT-409","message":"Partner 'X' already exists."}]}

    Matching on `status_code == 409` alone therefore never fires, and the
    already-exists case escapes as a hard error — which the suite reports as a
    SKIP, silently dropping every consent/signature test. Check the body too.
    """
    if r.status_code == 409:
        return True
    if r.status_code != 400:
        return False
    body = r.text or ""
    return "PM-PRT-409" in body or "already exists" in body.lower()


def _detail(r) -> str:
    """Status + body, so a failure is diagnosable from the test report alone."""
    return f"HTTP {r.status_code} at {r.request.url} -> {(r.text or '')[:400]}"


# What the sanity consent object asks for (sanity/dci.py) — the policy must allow it.
SANITY_PURPOSE = "share_farm_profile"
SANITY_SUBJECT_ID_TYPE = "national_id"


def policy_input(cfg) -> dict:
    """The sanity partner's scope policy for this registry's data controller."""
    return {
        "data_controller": cfg.controller_id,
        "allowed_data_scopes": list(cfg.data_scopes),
        "allowed_purposes": [SANITY_PURPOSE],
        "allowed_subject_id_types": [SANITY_SUBJECT_ID_TYPE],
        "allowed_signing_algs": ["EdDSA", "ES256", "RS256"],
        "max_validity_duration": "P1Y",
        "fetch_type": "oneshot",
    }


def _allows(values, wanted) -> bool:
    """An empty policy list means "any"."""
    return not values or wanted in values


def policy_active(cfg) -> bool:
    """True if PM serves an active policy for (partner, controller) covering the
    sanity scopes, purpose and subject id type."""
    if not cfg.pm_partner_api_url:
        return False
    r = httpx.get(
        f"{cfg.pm_partner_api_url}/policies/{cfg.pm_partner_id}",
        params={"data_controller": cfg.controller_id},
        verify=cfg.verify_tls,
        timeout=20,
    )
    if r.status_code != 200:
        return False
    for policy in r.json().get("policies") or []:
        if policy.get("data_controller") != cfg.controller_id:
            continue
        if (
            set(cfg.data_scopes) <= set(policy.get("allowed_data_scopes") or [])
            and _allows(policy.get("allowed_purposes"), SANITY_PURPOSE)
            and _allows(policy.get("allowed_subject_id_types"), SANITY_SUBJECT_ID_TYPE)
        ):
            return True
    return False


def _rejected(r, token) -> None:
    """Raise a diagnosable error for a failed PM admin call."""
    if r.status_code in (401, 403):
        raise RuntimeError(
            f"PM admin API rejected the seed ({r.status_code}) at {r.request.url}. "
            f"The seed needs a Keycloak client with the 'partner_manager' role "
            f"(token_sent={token is not None}); set SANITY_PM_ADMIN_* to it."
        )
    if r.status_code >= 400:
        # Include the body: raise_for_status() drops it, which is how a plain
        # "already exists" became an unexplained skip.
        raise RuntimeError(f"PM seed failed: {_detail(r)}")


def _approve(cfg, token, request_id) -> None:
    a = httpx.post(
        f"{cfg.pm_admin_url}/partners/requests/{request_id}/approve",
        headers=_headers(token),
        json={"notes": "auto-approved by registry sanity seed"},
        verify=cfg.verify_tls,
        timeout=30,
    )
    _rejected(a, token)


def _seed_key(cfg, token) -> str:
    """Onboard the partner (key + policy), or add the key to an existing one.

    Returns "onboarded" (policy included) | "key-added" (policy not touched).
    """
    admin = cfg.pm_admin_url
    pub_pem, alg = public_pem_and_alg(cfg.pm_private_key_pem)
    key_input = {"public_key": pub_pem, "kid": cfg.pm_kid, "algorithm": alg}

    # Try a fresh onboarding request, with the policy in the same request.
    r = httpx.post(
        f"{admin}/partners/requests/onboarding",
        headers=_headers(token),
        json={
            "partner_id": cfg.pm_partner_id,
            "name": "Sanity Test Partner",
            "org_name": "OpenG2P sanity suites",
            "description": "Persistent test partner for the signed DCI / consent e2e. Test only.",
            "keys": [key_input],
            "policies": [policy_input(cfg)],
        },
        verify=cfg.verify_tls,
        timeout=30,
    )
    outcome = "onboarded"
    if _already_exists(r):
        # Partner already exists — (re)add the key via a key-update request and
        # make sure the partner is enabled.
        outcome = "key-added"
        httpx.post(
            f"{admin}/partners/{cfg.pm_partner_id}/enable",
            headers=_headers(token), verify=cfg.verify_tls, timeout=20,
        )
        r = httpx.post(
            f"{admin}/partners/requests/key-update",
            headers=_headers(token),
            json={"partner_id": cfg.pm_partner_id, "keys": [key_input]},
            verify=cfg.verify_tls,
            timeout=30,
        )
    _rejected(r, token)
    _approve(cfg, token, r.json()["id"])

    if not key_servable(cfg):
        raise RuntimeError(
            f"seeded partner '{cfg.pm_partner_id}' but key '{cfg.pm_kid}' is still "
            "not servable by PM's fetch API"
        )
    return outcome


def _seed_policy(cfg, token) -> None:
    """Raise and approve a PM `policy` request for this data controller."""
    r = httpx.post(
        f"{cfg.pm_admin_url}/partners/requests/policy",
        headers=_headers(token),
        json={
            "partner_id": cfg.pm_partner_id,
            "description": f"Sanity e2e scope policy for {cfg.controller_id}. Test only.",
            "policies": [policy_input(cfg)],
        },
        verify=cfg.verify_tls,
        timeout=30,
    )
    _rejected(r, token)
    _approve(cfg, token, r.json()["id"])


def ensure_seeded(cfg) -> str:
    """Ensure the sanity partner, its key and its policy for this registry's data
    controller exist and are servable in PM.

    Returns "<key status>, policy <policy status>": key "exists" | "onboarded" |
    "key-added"; policy "exists" | "added". Raises RuntimeError if seeding is
    impossible (no admin URL) or did not result in a servable key and policy.
    """
    key_ok = key_servable(cfg)
    policy_ok = policy_active(cfg)
    if key_ok and policy_ok:
        return "exists, policy exists"
    if not cfg.pm_admin_url:
        raise RuntimeError(
            "PM key or policy not servable and SANITY_PM_ADMIN_URL not set — cannot "
            f"seed partner '{cfg.pm_partner_id}'"
        )
    token = _admin_token(cfg)

    key_status = "exists" if key_ok else _seed_key(cfg, token)
    policy_status = "exists" if policy_ok else "added"
    if not policy_ok and not policy_active(cfg):
        _seed_policy(cfg, token)
        if not policy_active(cfg):
            raise RuntimeError(
                f"seeded a policy for partner '{cfg.pm_partner_id}' / controller "
                f"'{cfg.controller_id}' but PM's policy API does not serve it"
            )
    return f"{key_status}, policy {policy_status}"


def main() -> int:
    """CLI entrypoint (`python -m sanity.pm_seed`) — used by the deploy-time seed
    Job. Idempotent: safe to run on every install/upgrade. Exits 0 on success or
    a benign skip (PM not configured); non-zero only on an unexpected failure."""
    from sanity.config import Config

    cfg = Config.from_env()
    if not cfg.can_reach_pm:
        print("[pm-seed] SANITY_PM_PARTNER_API_URL not set — nothing to seed; skipping")
        return 0
    try:
        status = ensure_seeded(cfg)
    except Exception as exc:  # noqa: BLE001
        print(f"[pm-seed] FAILED to seed partner '{cfg.pm_partner_id}': {exc}")
        return 1
    print(
        f"[pm-seed] partner '{cfg.pm_partner_id}' key '{cfg.pm_kid}' / policy "
        f"'{cfg.controller_id}': {status}"
    )
    return 0


if __name__ == "__main__":
    import sys

    sys.exit(main())
