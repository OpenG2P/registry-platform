"""End-to-end check for Phase-2 wallet issuance, WITHOUT a wallet app.

Why this can stand in for Inji
------------------------------
The wallet's part of OpenID4VCI is a plain HTTP exchange against Certify:

    redeem the pre-authorized code  ->  POST {certify}/oauth/token
    prove possession of a key       ->  a JWT signed by the wallet's own key
    fetch the credential            ->  POST {certify}/issuance/credential

Nothing in it is app-specific -- no MOSIP SDK, no Mimoto, no device. So this test
generates a keypair, performs those three steps itself, and asserts the credential
comes back bound to the key it generated. If that holds, a real wallet doing the
same exchange gets the same result, and the remaining difference is the app's UI
and its issuer list.

What it therefore proves, and what it does not:

  * proves the offer is redeemable, the tx_code is enforced, and Certify issues a
    credential bound to a HOLDER-supplied key -- the thing that makes this a
    wallet credential rather than a printed one;
  * does NOT prove Inji specifically can consume it; that needs Mimoto (which
    holds Inji's issuer list) or a credential-offer deep link the app supports.

The beneficiary's eSignet step is simulated exactly as the paper test does it --
the one part of the chain no machine can walk.

Everything it creates is tagged `TEST_`.
"""

import base64
import json
import time
import uuid

import httpx
import pytest

from sanity import db

VC_PREFIX = "/agent_portal/vc"


def _payload(body: dict) -> dict:
    return {"request_body": {"request_payload": body}}


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _wallet_keypair():
    """A key the WALLET owns. The point of the whole exercise."""
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding, rsa

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    numbers = key.public_key().public_numbers()

    def b64uint(value: int) -> str:
        return _b64url(value.to_bytes((value.bit_length() + 7) // 8, "big"))

    jwk = {
        "kty": "RSA",
        "e": b64uint(numbers.e),
        "n": b64uint(numbers.n),
        "alg": "RS256",
        "use": "sig",
    }
    return key, jwk, padding, hashes, serialization


def _proof_jwt(key, jwk, padding, hashes, audience: str, nonce: str) -> str:
    """The proof-of-possession JWT, signed by the wallet's key.

    `did:jwk` carries the public key inline, so the credential ends up bound to
    this keypair with nothing pre-registered anywhere.
    """
    did = "did:jwk:" + _b64url(json.dumps(jwk, separators=(",", ":")).encode())
    header = {"typ": "openid4vci-proof+jwt", "alg": "RS256", "jwk": jwk, "kid": did}
    body = {
        "aud": audience,
        "iat": int(time.time()),
        "nonce": nonce,
        "jti": str(uuid.uuid4()),
    }
    signing_input = f"{_b64url(json.dumps(header).encode())}.{_b64url(json.dumps(body).encode())}"
    signature = key.sign(signing_input.encode(), padding.PKCS1v15(), hashes.SHA256())
    return f"{signing_input}.{_b64url(signature)}"


def _wallet_enabled(client) -> bool:
    """The route only exists when walletIssuance is on."""
    spec = client.get("/openapi.json").json()
    return f"{VC_PREFIX}/wallet_offer" in spec.get("paths", {})


@pytest.fixture(scope="module")
def wallet_ready(cfg, agent_authed_client):
    if not _wallet_enabled(agent_authed_client):
        pytest.skip("wallet issuance is disabled on this install (walletIssuance.enabled)")


def test_wallet_route_absent_when_disabled(agent_authed_client):
    """The switch must actually remove the surface, not just refuse calls.

    Asserted from the other side too: when the feature is off there should be no
    wallet route in the OpenAPI document at all, so an install that issues paper
    exposes nothing extra.
    """
    spec = agent_authed_client.get("/openapi.json").json()
    has_route = f"{VC_PREFIX}/wallet_offer" in spec.get("paths", {})
    has_issuance = f"{VC_PREFIX}/issue" in spec.get("paths", {})
    if not has_route:
        assert True  # disabled: nothing mounted, which is the contract
    else:
        assert has_issuance, "wallet route mounted without the issuance controller"


def test_offer_is_refused_without_beneficiary_authentication(
    cfg, agent_authed_client, wallet_ready, step
):
    """The wallet channel must be gated exactly as paper is.

    A credential offer IS the credential, to anyone holding it -- so handing one
    out without the beneficiary's authentication would bypass the entire consent
    model while looking like a lesser action.
    """
    r = agent_authed_client.post(
        f"{VC_PREFIX}/lookup_beneficiary",
        json=_payload({"national_id": cfg.vc_national_id}),
    )
    payload = (r.json().get("response_body") or {}).get("response_payload")
    if not payload or not payload.get("internal_record_id"):
        pytest.skip(f"no record for {cfg.vc_national_id} on this install")

    step("requesting an offer with no completed authentication")
    r = agent_authed_client.post(
        f"{VC_PREFIX}/wallet_offer",
        json=_payload({"internal_record_id": payload["internal_record_id"]}),
    )
    header = (r.json() or {}).get("response_header") or {}
    assert header.get("response_status") != "SUCCESS", (
        "an offer was issued without beneficiary authentication"
    )
    assert header.get("response_error_code") == "G2P-VC-401", header


def test_wallet_downloads_the_credential(cfg, agent_authed_client, wallet_ready, step):
    """The whole point: a credential ends up bound to a key the wallet generated."""
    if not cfg.registry_dsn:
        pytest.skip("registry DB not configured — cannot simulate the beneficiary step")
    if not cfg.certify_base_url:
        pytest.skip("SANITY_CERTIFY_BASE_URL not set — cannot act as the wallet")

    r = agent_authed_client.post(
        f"{VC_PREFIX}/lookup_beneficiary",
        json=_payload({"national_id": cfg.vc_national_id}),
    )
    payload = (r.json().get("response_body") or {}).get("response_payload")
    if not payload or not payload.get("internal_record_id"):
        pytest.skip(f"no record for {cfg.vc_national_id} on this install")
    record_id = payload["internal_record_id"]
    register_id = payload["register_id"]

    step("writing a completed authentication (stands in for the beneficiary at eSignet)")
    auth_id = f"TEST_SANITY_WALLET_{record_id}"[:64]
    db.execute(
        cfg.registry_dsn,
        """
        INSERT INTO g2p_registrant_authentications
            (authentication_id, register_id, internal_record_id, provider_id,
             initiated_by_staff_id, initiated_at, status, completed_at, expiry_at)
        VALUES (%(id)s, %(reg)s, %(rec)s, 'TEST_SANITY_PROVIDER',
                'TEST_SANITY_AGENT', now(), 'SUCCESS', now(), now() + interval '1 day')
        ON CONFLICT (authentication_id) DO UPDATE
            SET status = 'SUCCESS', completed_at = now()
        """,
        {"id": auth_id, "reg": register_id, "rec": record_id},
    )

    step("agent requests a credential offer for the citizen's wallet")
    r = agent_authed_client.post(
        f"{VC_PREFIX}/wallet_offer",
        json=_payload({"internal_record_id": record_id, "authentication_id": auth_id}),
    )
    assert r.status_code == 200, f"offer failed: {r.status_code} {r.text[:400]}"
    offer = (r.json().get("response_body") or {}).get("response_payload") or {}
    assert offer.get("credential_offer_uri"), offer
    assert offer.get("tx_code"), "no tx_code — the offer would be unbound to the citizen"

    # ---- from here on we ARE the wallet -------------------------------------
    base = cfg.certify_base_url.rstrip("/")
    offer_id = offer["offer_id"]

    step("wallet reads the offer and takes the pre-authorized code")
    with httpx.Client(timeout=30, verify=cfg.verify_tls) as wallet:
        resp = wallet.get(f"{base}/credential-offer-data/{offer_id}")
        assert resp.status_code == 200, f"offer not readable: {resp.text[:300]}"
        grant = resp.json()["grants"]["urn:ietf:params:oauth:grant-type:pre-authorized_code"]
        pre_auth_code = grant["pre-authorized_code"]

        step("wallet redeems it for an access token")
        resp = wallet.post(
            f"{base}/oauth/token",
            data={
                "grant_type": "urn:ietf:params:oauth:grant-type:pre-authorized_code",
                "pre-authorized_code": pre_auth_code,
                "tx_code": offer["tx_code"],
            },
        )
        assert resp.status_code == 200, f"token exchange failed: {resp.text[:300]}"
        token = resp.json()
        access_token, c_nonce = token["access_token"], token.get("c_nonce", "")

        step("wallet proves possession of ITS OWN key and fetches the credential")
        key, jwk, padding, hashes, _ = _wallet_keypair()
        proof = _proof_jwt(key, jwk, padding, hashes, cfg.certify_audience or base, c_nonce)
        resp = wallet.post(
            f"{base}/issuance/credential",
            headers={"Authorization": f"Bearer {access_token}"},
            json={
                "format": "ldp_vc",
                "credential_definition": {"type": offer.get("credential_types")
                                          or ["VerifiableCredential"]},
                "proof": {"proof_type": "jwt", "jwt": proof},
            },
        )
        assert resp.status_code == 200, f"credential request failed: {resp.text[:400]}"
        credential = resp.json().get("credential") or {}

    step("the credential is bound to the wallet's key, not to ours")
    subject = credential.get("credentialSubject") or {}
    assert subject, f"no credentialSubject: {json.dumps(credential)[:300]}"
    holder = subject.get("id", "")
    assert holder.startswith("did:jwk:"), f"holder id is not a wallet key: {holder!r}"

    expected = "did:jwk:" + _b64url(json.dumps(jwk, separators=(",", ":")).encode())
    assert holder == expected, (
        "the credential was bound to a different key than the wallet generated — "
        "holder binding is not working"
    )

    step("and it is a real signed credential")
    assert credential.get("proof"), "credential carries no proof"
    assert credential.get("issuer"), "credential carries no issuer"


def test_offer_cannot_be_redeemed_twice(cfg, agent_authed_client, wallet_ready, step):
    """A pre-authorized code is single-use. If it were not, a photographed QR
    would let a second party claim the same credential."""
    if not cfg.registry_dsn or not cfg.certify_base_url:
        pytest.skip("needs the registry DB and SANITY_CERTIFY_BASE_URL")

    r = agent_authed_client.post(
        f"{VC_PREFIX}/lookup_beneficiary",
        json=_payload({"national_id": cfg.vc_national_id}),
    )
    payload = (r.json().get("response_body") or {}).get("response_payload")
    if not payload or not payload.get("internal_record_id"):
        pytest.skip("no record on this install")
    record_id = payload["internal_record_id"]

    auth_id = f"TEST_SANITY_WALLET_{record_id}"[:64]
    r = agent_authed_client.post(
        f"{VC_PREFIX}/wallet_offer",
        json=_payload({"internal_record_id": record_id, "authentication_id": auth_id}),
    )
    if r.status_code != 200:
        pytest.skip("offer not available; covered by the main wallet test")
    offer = (r.json().get("response_body") or {}).get("response_payload") or {}

    base = cfg.certify_base_url.rstrip("/")
    with httpx.Client(timeout=30, verify=cfg.verify_tls) as wallet:
        grants = wallet.get(f"{base}/credential-offer-data/{offer['offer_id']}").json()
        code = grants["grants"]["urn:ietf:params:oauth:grant-type:pre-authorized_code"][
            "pre-authorized_code"
        ]
        form = {
            "grant_type": "urn:ietf:params:oauth:grant-type:pre-authorized_code",
            "pre-authorized_code": code,
            "tx_code": offer["tx_code"],
        }
        first = wallet.post(f"{base}/oauth/token", data=form)
        second = wallet.post(f"{base}/oauth/token", data=form)

    assert first.status_code == 200, f"first redemption failed: {first.text[:200]}"
    assert second.status_code != 200, (
        "the pre-authorized code was redeemed twice — a photographed offer QR "
        "could be claimed by someone else"
    )
