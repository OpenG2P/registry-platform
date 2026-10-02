"""Partner Tier-3: DCI sync search with Partner Management + Consent Manager.

Requires compose-gate PM 1.0.3 / CM 1.0.2 and `partner_consent_seed.py` (signature +
consent enforcement ON on partner-api).
"""

from __future__ import annotations

import pytest
from cryptography.hazmat.primitives.asymmetric import ed25519

from helpers.partner_consent_keys import DEFAULT_DENIED_SCOPES
from helpers.partner_dci import build_search_envelope
from helpers.partner_http import PartnerClient
from helpers.seed_manifest import subject


def _meta(resp: dict) -> dict:
    return (resp.get("header") or {}).get("meta") or {}


def _records(resp: dict) -> list:
    message = resp.get("message") or {}
    items = message.get("search_response") or []
    assert items, f"empty search_response: {resp!r}"
    first = items[0]
    assert first.get("status") == "succ", f"item status: {first!r}"
    data = first.get("data") or {}
    records = data.get("reg_records") or []
    assert records, f"no reg_records: {first!r}"
    return records


@pytest.mark.tier3
@pytest.mark.partner
def test_dci_sync_search_consented_individual(partner: PartnerClient, step):
    seeded = subject("individual")
    first_name = seeded["fields"]["first_name"]

    step("POST /dci/registry/sync/search with signed consent (demographic_info)")
    response = partner.post_json(
        "/dci/registry/sync/search",
        build_search_envelope(first_name=first_name, with_consent=True),
    )

    header = response.get("header") or {}
    assert header.get("status") == "succ", f"unexpected DCI header status: {header!r}"
    meta = _meta(response)
    assert meta.get("consent_enforcement") == "enabled", meta
    assert meta.get("signature_validation") == "enabled", meta

    records = _records(response)
    blob = str(records).lower()
    assert first_name.lower() in blob, f"seeded individual not in DCI records: {records!r}"

    record = records[0]
    assert "demographic_info" in record, f"consented scope missing: {sorted(record)}"


@pytest.mark.tier3
@pytest.mark.partner
def test_dci_sync_search_clamps_to_consented_scopes(partner: PartnerClient, step):
    seeded = subject("individual")
    first_name = seeded["fields"]["first_name"]

    step("assert unconsented top-level scopes are clamped away")
    response = partner.post_json(
        "/dci/registry/sync/search",
        build_search_envelope(first_name=first_name, with_consent=True),
    )
    if _meta(response).get("consent_enforcement") != "enabled":
        pytest.skip("consent enforcement disabled")

    for record in _records(response):
        leaked = [s for s in DEFAULT_DENIED_SCOPES if s in record]
        assert not leaked, f"leaked unconsented scopes: {sorted(leaked)}"


@pytest.mark.tier3
@pytest.mark.partner
def test_dci_sync_search_without_consent_is_rejected(partner: PartnerClient, step):
    seeded = subject("individual")
    first_name = seeded["fields"]["first_name"]

    step("POST without consent_jws — expect rjct when enforcement is on")
    response = partner.post_json(
        "/dci/registry/sync/search",
        build_search_envelope(first_name=first_name, with_consent=False),
    )
    header = response.get("header") or {}
    assert header.get("status") == "rjct", f"expected rjct without consent, got: {header!r}"


@pytest.mark.tier3
@pytest.mark.partner
def test_dci_sync_search_wrong_consent_audience_is_rejected(partner: PartnerClient, step):
    seeded = subject("individual")
    first_name = seeded["fields"]["first_name"]

    step("POST with unknown consent audience — expect rjct")
    response = partner.post_json(
        "/dci/registry/sync/search",
        build_search_envelope(
            first_name=first_name,
            with_consent=True,
            audience="FUNC_GATE_NO_SUCH_AUDIENCE",
        ),
    )
    header = response.get("header") or {}
    assert header.get("status") == "rjct", f"expected rjct for bad audience, got: {header!r}"


@pytest.mark.tier3
@pytest.mark.partner
def test_dci_sync_search_bad_signature_is_rejected(partner: PartnerClient, step):
    seeded = subject("individual")
    first_name = seeded["fields"]["first_name"]

    step("POST signed with an unregistered key — expect rjct")
    impostor = ed25519.Ed25519PrivateKey.generate()
    response = partner.post_json(
        "/dci/registry/sync/search",
        build_search_envelope(first_name=first_name, with_consent=True, priv=impostor),
    )
    header = response.get("header") or {}
    assert header.get("status") == "rjct", f"expected rjct for bad signature, got: {header!r}"
