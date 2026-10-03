"""A consent for one person never widens to all subjects; partner calls are audited."""

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from openg2p_registry_core.errors import G2PRegistryException

from openg2p_registry_partner_api.audit_context import set_audit_actor, set_audit_outcome
from openg2p_registry_partner_api.audit_middleware import AuditMiddleware
from openg2p_registry_partner_api.search.dci.helpers.query_helper import DciQueryHelper
from openg2p_registry_partner_api.search.dci.schemas.dci_request import DciSearchCriteria
from openg2p_registry_partner_api.search.dci.services.g2p_dci_service import (
    _require_consent_subject_or_bulk,
)


def _aggregate(query: dict) -> DciSearchCriteria:
    return DciSearchCriteria(
        reg_type="CropSown",
        reg_record_type="spdci-extensions-agri:ActivityAggregate",
        query_type="expression",
        query={"type": "expression", "value": {"expression": {"query": query}}},
    )


# --- consent subject ---------------------------------------------------------

@pytest.mark.parametrize("subject", [None, {"$eq": None}, ""])
def test_present_but_empty_subject_is_not_all_subjects(subject):
    criteria = _aggregate({"subject_id": subject, "aggregate_type": "X"})
    assert not DciQueryHelper.is_bulk_aggregate_request(criteria)
    with pytest.raises(G2PRegistryException):
        DciQueryHelper.parse_subject_query(criteria, allow_missing_subject=True)


def test_absent_subject_is_a_bulk_request():
    criteria = _aggregate({"aggregate_type": "X"})
    assert DciQueryHelper.is_bulk_aggregate_request(criteria)
    assert DciQueryHelper.parse_subject_query(criteria, allow_missing_subject=True) == (
        None, {"aggregate_type": "X"},
    )


def test_named_subject_parses():
    criteria = _aggregate({"subject_id": {"$eq": "FR-1"}, "crop_year": 2019})
    assert DciQueryHelper.parse_subject_query(criteria, allow_missing_subject=True) == (
        "FR-1", {"crop_year": 2019},
    )


def test_enforced_consent_without_subject_only_allows_bulk():
    bulk = _aggregate({"aggregate_type": "X"})
    named = _aggregate({"subject_id": "FR-1"})
    _require_consent_subject_or_bulk(True, None, bulk, is_aggregate=True)  # allow-listed upstream
    _require_consent_subject_or_bulk(True, "FR-1", named, is_aggregate=True)
    _require_consent_subject_or_bulk(False, None, named, is_aggregate=True)  # enforcement off
    with pytest.raises(G2PRegistryException):
        _require_consent_subject_or_bulk(True, None, named, is_aggregate=True)
    with pytest.raises(G2PRegistryException):
        _require_consent_subject_or_bulk(True, None, bulk, is_aggregate=False)


# --- audit ---------------------------------------------------------------------

@pytest.fixture
def audited_app():
    events: list[dict] = []
    app = FastAPI()
    app.add_middleware(AuditMiddleware, audit_manager_url="http://audit.invalid")

    async def capture(self, event):
        events.append(event)

    AuditMiddleware._emit = capture  # put back by _restore_emit

    @app.post("/ok")
    async def ok(request: Request):
        set_audit_actor(request, "PARTNER_A", verified=True)
        return {"status": "succ"}

    @app.post("/rjct")
    async def rjct(request: Request):
        set_audit_actor(request, "PARTNER_A", verified=True)
        set_audit_outcome(request, "failure", reason="rjct.search_criteria.invalid")
        return {"status": "rjct"}

    @app.post("/anon-ok")
    async def anon_ok():
        return {"status": "succ"}

    @app.post("/anon-fail")
    async def anon_fail(request: Request):
        set_audit_outcome(request, "failure", reason="rjct.signature")
        return {"status": "rjct"}

    return app, events


def _call(app, path):
    with TestClient(app) as client:
        assert client.post(path).status_code == 200


@pytest.fixture(autouse=True)
def _restore_emit():
    original = AuditMiddleware._emit
    yield
    AuditMiddleware._emit = original


def test_authenticated_partner_success_is_audited(audited_app):
    app, events = audited_app
    _call(app, "/ok")
    assert len(events) == 1
    assert events[0]["data"]["actor"]["id"] == "PARTNER_A" or "PARTNER_A" in str(events[0])
    assert "success" in str(events[0]).lower()


def test_error_envelope_is_audited_as_failure(audited_app):
    app, events = audited_app
    _call(app, "/rjct")
    assert len(events) == 1
    assert "failure" in str(events[0]).lower()
    assert "rjct.search_criteria.invalid" in str(events[0])


def test_anonymous_success_skipped_and_failure_audited(audited_app):
    app, events = audited_app
    _call(app, "/anon-ok")
    assert events == []
    _call(app, "/anon-fail")
    assert len(events) == 1
    assert "anonymous" in str(events[0])
