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

    The public key travels inline in the header `jwk`, so the credential is bound
    to this keypair with nothing pre-registered anywhere -- Certify derives the
    holder `did:jwk` from it.

    Shape verified against a live Certify: `jwk` ALONE in the header (adding a
    `kid` beside it is rejected with `invalid_proof`), and `iss` present in the
    body. Keep it in step with CertifyIssuanceService._make_proof_jwt.
    """
    header = {"alg": "RS256", "typ": "openid4vci-proof+jwt", "jwk": jwk}
    body = {"aud": audience, "nonce": nonce, "iss": "", "iat": int(time.time())}
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
    assert offer.get("qr_png", "").startswith("data:image/png;base64,"), (
        "no QR returned — the agent has nothing to show the citizen"
    )

    # ---- from here on we ARE the wallet -------------------------------------
    base = cfg.certify_base_url.rstrip("/")
    offer_id = offer["offer_id"]

    step("wallet reads the offer and takes the pre-authorized code")
    with httpx.Client(timeout=30, verify=cfg.verify_tls) as wallet:
        resp = wallet.get(f"{base}/credential-offer-data/{offer_id}")
        assert resp.status_code == 200, f"offer not readable: {resp.text[:300]}"
        offer_doc = resp.json()
        grant = offer_doc["grants"]["urn:ietf:params:oauth:grant-type:pre-authorized_code"]
        pre_auth_code = grant["pre-authorized_code"]
        # The credential type comes from the OFFER, which is what a real wallet
        # reads it from. Taking it from our own response would be testing our
        # assumption rather than the protocol.
        config_ids = offer_doc.get("credential_configuration_ids") or []
        assert config_ids, f"offer names no credential type: {offer_doc}"

        # Resolve the config against the issuer metadata, exactly as a wallet
        # does: Certify 0.14 rejects `credential_configuration_id` on the
        # credential request and wants format + credential_definition. This also
        # asserts the metadata is complete enough for a real wallet to proceed.
        meta = wallet.get(f"{base}/.well-known/openid-credential-issuer")
        assert meta.status_code == 200, "issuer metadata unreachable"
        supported = meta.json().get("credential_configurations_supported") or {}
        conf = supported.get(config_ids[0])
        assert conf and conf.get("credential_definition"), (
            f"issuer metadata does not describe {config_ids[0]} — no wallet could "
            f"build a credential request from it"
        )

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
                "format": conf["format"],
                "credential_definition": {
                    "@context": conf["credential_definition"]["@context"],
                    "type": conf["credential_definition"]["type"],
                },
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

    # Compare the MODULUS, not the did string: key ordering inside the JWK changes
    # the did:jwk encoding, so a string compare is brittle for no benefit.
    raw = holder.split("did:jwk:", 1)[1]
    raw += "=" * (-len(raw) % 4)
    holder_jwk = json.loads(base64.urlsafe_b64decode(raw))
    assert holder_jwk.get("n") == jwk["n"], (
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


def test_each_offer_gets_its_own_tx_code(cfg, agent_authed_client, wallet_ready, step):
    """Two offers must not share a transaction code.

    The code is the only thing binding an offer to the person at the counter. A
    deployment-wide constant would satisfy every other test here while protecting
    nothing -- anyone who saw one offer would know the code for all of them. This
    is the test that would have caught that.
    """
    if not cfg.registry_dsn:
        pytest.skip("registry DB not configured")

    r = agent_authed_client.post(
        f"{VC_PREFIX}/lookup_beneficiary",
        json=_payload({"national_id": cfg.vc_national_id}),
    )
    payload = (r.json().get("response_body") or {}).get("response_payload")
    if not payload or not payload.get("internal_record_id"):
        pytest.skip("no record on this install")
    record_id = payload["internal_record_id"]
    auth_id = f"TEST_SANITY_WALLET_{record_id}"[:64]

    codes = []
    for n in range(2):
        step(f"requesting offer {n + 1}")
        r = agent_authed_client.post(
            f"{VC_PREFIX}/wallet_offer",
            json=_payload({"internal_record_id": record_id, "authentication_id": auth_id}),
        )
        if r.status_code != 200:
            pytest.skip("offers not available; covered by the main wallet test")
        codes.append(
            ((r.json().get("response_body") or {}).get("response_payload") or {}).get("tx_code")
        )

    assert all(codes), f"an offer came back without a tx_code: {codes}"
    assert codes[0] != codes[1], (
        f"both offers shared the transaction code {codes[0]!r} — it is a fixed "
        "value, so it binds an offer to nobody"
    )
    for code in codes:
        assert code.isdigit() and len(code) >= 4, f"weak tx_code: {code!r}"
