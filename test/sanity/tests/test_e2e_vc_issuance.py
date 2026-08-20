"""End-to-end wiring check for agent-driven VC issuance.

What this can and cannot prove
------------------------------
The design deliberately requires a **human** — the beneficiary authenticating at
eSignet with a biometric or an OTP. No automated suite can perform that step, so
this test does not pretend to. It proves everything either side of it:

* the agent can authenticate against the `agent` realm and is authorised;
* the registry resolves a national ID to a record through the manifestation's
  VC view;
* the registrant-authentication subsystem resolves an eSignet provider and
  produces a real authorization URL (the wiring to eSignet);
* **the gate actually gates** — issuance is refused when the beneficiary has not
  completed authentication;
* and, where the registry DB is reachable, the remaining half of the chain
  (Certify → signed credential → rendered PDF) by injecting a completed
  authentication and issuing against it.

Everything it creates is tagged `TEST_`.
"""

import pytest

from sanity import db

VC_PREFIX = "/agent_portal/vc"


def _payload(body: dict) -> dict:
    """The G2P request envelope the registry APIs expect."""
    return {
        "request_header": {
            "sender_app_mnemonic": "sanity",
            "sender_app_url": "http://sanity",
            "request_id": "TEST_SANITY_VC",
            "request_timestamp": "2026-01-01T00:00:00",
        },
        "request_body": {"request_payload": body},
    }


def _enabled(client) -> bool:
    paths = client.get("/openapi.json").json().get("paths", {})
    return f"{VC_PREFIX}/issue" in paths


@pytest.fixture(scope="module")
def vc_ready(cfg, agent_authed_client):
    if not _enabled(agent_authed_client):
        pytest.skip("VC issuance is disabled on this install")
    return True


def test_vc_types_are_configured(cfg, agent_authed_client, vc_ready, step):
    """An agent can see what this registry issues."""
    step("asking the Agent Portal which credential types are configured")
    r = agent_authed_client.post(f"{VC_PREFIX}/get_vc_types", json=_payload({}))
    assert r.status_code == 200, r.text
    types = (r.json().get("response_body") or {}).get("response_payload") or {}
    listed = types.get("vc_types") or []
    assert listed, (
        "issuance is enabled but no credential definitions are configured — the "
        "manifestation must supply agentPortalApi.vcDefinitions"
    )
    step(f"configured types: {[t['config_id'] for t in listed]}")


def test_lookup_and_start_authentication(cfg, agent_authed_client, vc_ready, step):
    """A national ID resolves to a record, and eSignet authentication starts."""
    step(f"looking up national ID {cfg.vc_national_id}")
    r = agent_authed_client.post(
        f"{VC_PREFIX}/lookup_beneficiary",
        json=_payload({"national_id": cfg.vc_national_id}),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    header = body.get("response_header") or {}
    payload = (body.get("response_body") or {}).get("response_payload")

    if header.get("response_status") != "SUCCESS":
        # A miss is a legitimate outcome on an install with no seeded record —
        # but it must be the *considered* refusal, not a stack trace.
        code = header.get("response_error_code")
        assert code in ("G2P-VC-404", "G2P-VC-501"), (
            f"lookup failed in an unexpected way: {header}"
        )
        pytest.skip(f"no record for {cfg.vc_national_id} on this install ({code})")

    assert payload and payload.get("internal_record_id"), body
    record_id = payload["internal_record_id"]
    step(f"resolved to record {record_id} (eligible={payload.get('eligible')})")

    step("starting the beneficiary's eSignet authentication")
    r = agent_authed_client.post(
        f"{VC_PREFIX}/start_authentication",
        json=_payload({"internal_record_id": record_id}),
    )
    assert r.status_code == 200, r.text
    started = (r.json().get("response_body") or {}).get("response_payload")
    header = r.json().get("response_header") or {}
    if started is None:
        pytest.skip(
            "registrant authentication is not configured on this install "
            f"({header.get('response_error_code')}: {header.get('response_error_message')})"
        )
    assert started.get("authorization_url", "").startswith("http"), started
    step(f"eSignet authorization URL issued via provider '{started.get('provider_name')}'")


def test_issue_is_refused_without_beneficiary_authentication(
    cfg, agent_authed_client, vc_ready, step
):
    """The gate holds: no completed authentication, no credential.

    This is the security assertion of the suite. An agent token alone must not be
    enough to mint a signed credential — the beneficiary has to have authenticated.
    """
    step("attempting issuance for a record that has not authenticated")
    r = agent_authed_client.post(
        f"{VC_PREFIX}/issue",
        json=_payload(
            {
                "internal_record_id": "TEST_SANITY_NO_SUCH_RECORD",
                "authentication_id": "TEST_SANITY_NO_SUCH_AUTH",
            }
        ),
    )
    assert r.status_code != 200, (
        "a credential was issued for a record with no completed authentication"
    )
    assert r.headers.get("content-type", "").startswith("application/json"), r.text
    header = r.json().get("response_header") or {}
    assert header.get("response_error_code") == "G2P-VC-401", header
    step(f"refused as expected: {header.get('response_error_message')}")


def test_issue_end_to_end_with_seeded_authentication(
    cfg, agent_authed_client, vc_ready, step
):
    """The remaining half: Certify signs and a printable PDF comes back.

    The beneficiary's step is simulated by writing a completed authentication row
    directly — the one part of the chain a machine cannot walk. Everything after
    it is real: the claims are read from the VC view, pushed to Certify, signed,
    and rendered.
    """
    if not cfg.registry_dsn:
        pytest.skip("registry DB not configured — cannot simulate the beneficiary step")

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
    auth_id = f"TEST_SANITY_AUTH_{record_id}"[:64]
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

    step("issuing")
    r = agent_authed_client.post(
        f"{VC_PREFIX}/issue",
        json=_payload({"internal_record_id": record_id, "authentication_id": auth_id}),
    )
    assert r.status_code == 200, f"issuance failed: {r.status_code} {r.text[:500]}"
    assert r.headers.get("content-type", "").startswith("application/pdf"), r.headers
    assert r.content[:4] == b"%PDF", "the response is not a PDF"
    assert r.headers.get("X-Issuance-Id"), "no issuance id returned"
    step(
        f"issued {r.headers.get('X-Vc-Type')} — {len(r.content)} byte PDF, "
        f"issuance {r.headers.get('X-Issuance-Id')}"
    )

    step("confirming the issuance was logged in the registry")
    rows = db.query(
        cfg.registry_dsn,
        "SELECT status, credential_id, issued_by FROM g2p_vc_issuances "
        "WHERE issuance_id = %(id)s",
        {"id": r.headers["X-Issuance-Id"]},
    )
    assert rows, "the issuance was not written to g2p_vc_issuances"
    assert rows[0]["status"] == "ISSUED", rows[0]
    step(f"logged: {rows[0]}")
