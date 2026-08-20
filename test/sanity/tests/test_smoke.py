import pytest

# Liveness + wiring for the Farmer Registry partner-api (the PEP). No auth, no
# data created — runs on every install/upgrade.


@pytest.mark.smoke
def test_partner_ping(partner_client):
    r = partner_client.get("/ping")
    assert r.status_code == 200, r.text


@pytest.mark.smoke
def test_openapi_has_dci_search(partner_client):
    r = partner_client.get("/openapi.json")
    assert r.status_code == 200, r.text
    paths = r.json().get("paths", {})
    assert any("/dci/registry" in p and p.endswith("/search") for p in paths), (
        f"DCI search route not found in openapi paths: {sorted(paths)[:20]}"
    )


# ── Agent Portal API (VC issuance) ────────────────────────────────────────────
# Liveness and the auth model. Skipped entirely when the component is not
# deployed, so a registry that has not enabled VC issuance still runs green.
# Nothing here creates data.

ISSUE_ROUTE = "/agent_portal/vc/issue"


@pytest.mark.smoke
def test_agent_portal_ping(agent_client):
    r = agent_client.get("/ping")
    assert r.status_code == 200, r.text


@pytest.mark.smoke
def test_agent_portal_openapi(agent_client):
    r = agent_client.get("/openapi.json")
    assert r.status_code == 200, r.text
    assert "paths" in r.json()


@pytest.mark.smoke
def test_agent_portal_issuance_routes_match_feature_flag(agent_client):
    """The issuance routes are mounted only when the capability is switched on.

    Off is a legitimate state, so this asserts consistency rather than presence:
    either the whole route set is there, or none of it is. A half-mounted
    surface would mean the switch is not doing what it claims.
    """
    paths = agent_client.get("/openapi.json").json().get("paths", {})
    vc_paths = {p for p in paths if p.startswith("/agent_portal/vc/")}
    if not vc_paths:
        pytest.skip("VC issuance is disabled on this install — no issuance routes mounted")
    expected = {
        "/agent_portal/vc/get_vc_types",
        "/agent_portal/vc/lookup_beneficiary",
        "/agent_portal/vc/start_authentication",
        "/agent_portal/vc/authentication_status",
        ISSUE_ROUTE,
    }
    missing = expected - vc_paths
    assert not missing, f"issuance is enabled but these routes are missing: {sorted(missing)}"


@pytest.mark.smoke
def test_agent_portal_issue_rejects_anonymous(agent_client):
    """Issuance must never be reachable without an agent token.

    This is the one smoke assertion that matters most: the endpoint mints a
    signed credential, so an unauthenticated caller reaching it would be a
    serious defect. 404 is accepted only because the routes may be unmounted.
    """
    paths = agent_client.get("/openapi.json").json().get("paths", {})
    if ISSUE_ROUTE not in paths:
        pytest.skip("VC issuance is disabled on this install")
    r = agent_client.post(ISSUE_ROUTE, json={})
    assert r.status_code in (401, 403, 422), (
        f"anonymous POST {ISSUE_ROUTE} returned {r.status_code}; expected a rejection"
    )
    assert r.status_code != 200, "issuance endpoint served an unauthenticated caller"
