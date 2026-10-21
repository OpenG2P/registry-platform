"""Consent by lookup (a search without a consent) and the consent recorded in the audit event."""

import asyncio
import base64
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from openg2p_registry_core.errors import G2PRegistryException

from openg2p_registry_partner_api.audit_context import (
    CONSENTS_STATE_KEY,
    add_audit_consent,
)
from openg2p_registry_partner_api.audit_middleware import AuditMiddleware
from openg2p_registry_partner_api.search.dci.controller import (
    g2p_dci_controller as controller_module,
)
from openg2p_registry_partner_api.search.dci.controller.g2p_dci_controller import (
    G2PDciController,
)
from openg2p_registry_partner_api.search.dci.helpers import (
    consent_helper as helper_module,
)
from openg2p_registry_partner_api.search.dci.helpers.consent_helper import (
    DciConsentHelper,
)
from openg2p_registry_partner_api.search.dci.schemas.dci_request import (
    DciRequestHeader,
    DciSearchCriteria,
    DciSearchRequest,
    DciSearchRequestItem,
)

IDTYPE = {"query_type": "idtype-value",
          "query": {"type": "idtype-value", "value": {"id_type": "UIN", "id_value": " 1234 "}}}
EXPRESSION = {"query_type": "expression",
              "query": {"type": "expression", "value": {"expression": {"query": {"search_text": {"$eq": "X"}}}}}}
PERMIT = {"decision": "permit", "consent_id": "c-1", "effective_data_scopes": ["farmer-registry.land"],
          "subject_id": {"type": "UIN", "value": "1234"}, "policy_ref": "data_controller:farmer-registry",
          "policy_version": 3}


def _jws(claims: dict) -> str:
    def b64(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

    return f"{b64(b'{}')}.{b64(json.dumps(claims).encode())}.{b64(b'sig')}"


def _run(query: dict, decision: dict, consent_jws=None):
    controller = G2PDciController.__new__(G2PDciController)
    validate = AsyncMock(return_value=decision)
    controller.consent_helper = SimpleNamespace(validate=validate, consent_issued_at=lambda jws: None)
    criteria = {"reg_type": "Farmer", "reg_record_type": "x", **query}
    if consent_jws:
        criteria["authorize"] = {"consent_jws": consent_jws}
    message = DciSearchRequest(transaction_id="t", search_request=[
        DciSearchRequestItem(reference_id="r1", search_criteria=DciSearchCriteria(**criteria))])
    header = DciRequestHeader(version="1", message_id="m", message_ts="now", action="search",
                              sender_id="bank-a", receiver_id="r")
    raw = {"message": {"search_request": [{"reference_id": "r1", "search_criteria": criteria}]}}
    request = SimpleNamespace(state=SimpleNamespace())
    try:
        result = asyncio.run(controller._enforce_consent(raw, header, message, {}, request=request))
    except G2PRegistryException as exc:
        result = exc
    return result, validate, getattr(request.state, CONSENTS_STATE_KEY, None)


# --- controller ----------------------------------------------------------------

def test_no_consent_idtype_search_is_looked_up():
    (scopes, subjects), validate, audit = _run(IDTYPE, PERMIT)
    validate.assert_awaited_once_with(consent_jws=None, sender_id="bank-a",
                                      subject_id={"type": "UIN", "value": "1234"})
    assert scopes["r1"].scope_ids == ["farmer-registry.land"] and scopes["r1"].issued_at is None
    assert subjects == {"r1": "1234"}
    assert audit == [{"reference_id": "r1", "decision": "permit", "consent_id": "c-1",
                      "data_scopes": ["farmer-registry.land"], "policy_ref": "data_controller:farmer-registry",
                      "policy_version": 3}]


def test_lookup_not_found_is_denied():
    deny = {"decision": "deny", "reason_code": "consent_not_found", "detail": "none"}
    error, _, audit = _run(IDTYPE, deny)
    assert isinstance(error, G2PRegistryException) and "consent_not_found" in error.message
    assert audit == [{"reference_id": "r1", "decision": "deny", "data_scopes": [], "reason": "consent_not_found"}]


def test_search_id_type_mapped_to_consent_subject_id_type(monkeypatch):
    monkeypatch.setattr(controller_module._config, "consent_subject_id_types", {"UIN": "FAYDA_FAN"})
    (_, _), validate, _ = _run(IDTYPE, PERMIT)
    assert validate.await_args.kwargs["subject_id"] == {"type": "FAYDA_FAN", "value": "1234"}
    jws = _jws({"jti": "t"})
    (_, _), validate, _ = _run(IDTYPE, PERMIT, consent_jws=jws)
    assert validate.await_args.kwargs["subject_id"] == {"type": "FAYDA_FAN", "value": "1234"}
    # A type not listed is sent as is.
    monkeypatch.setattr(controller_module._config, "consent_subject_id_types", {"FARMER_NO": "FARMER_ID"})
    (_, _), validate, _ = _run(IDTYPE, PERMIT)
    assert validate.await_args.kwargs["subject_id"] == {"type": "UIN", "value": "1234"}


def test_no_consent_non_subject_search_still_needs_a_consent():
    error, validate, audit = _run(EXPRESSION, PERMIT)
    assert isinstance(error, G2PRegistryException) and "missing_consent" in error.message
    validate.assert_not_awaited()
    assert audit == [{"reference_id": "r1", "decision": "deny", "reason": "missing_consent"}]


def test_consent_jws_also_sends_the_searched_subject():
    jws = _jws({"jti": "tok-9"})
    (_, _), validate, audit = _run(IDTYPE, PERMIT, consent_jws=jws)
    validate.assert_awaited_once_with(consent_jws=jws, sender_id="bank-a",
                                      subject_id={"type": "UIN", "value": "1234"})
    assert audit[0]["token_id"] == "tok-9"
    # An expression search: the consent works as before, with no subject sent.
    (_, _), validate, _ = _run(EXPRESSION, PERMIT, consent_jws=jws)
    validate.assert_awaited_once_with(consent_jws=jws, sender_id="bank-a", subject_id=None)


# --- helper: the /validate body -------------------------------------------------

class _Client:
    def __init__(self, calls):
        self.calls = calls

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def post(self, url, json):
        self.calls.append((url, json))
        return SimpleNamespace(status_code=200, json=lambda: PERMIT, text="")


@pytest.fixture
def cm(monkeypatch):
    calls = []
    monkeypatch.setattr(helper_module._config, "consent_manager_url", "http://cm")
    monkeypatch.setattr(helper_module._config, "consent_data_controller", "farmer-registry")
    monkeypatch.setattr(helper_module.httpx, "AsyncClient", lambda **kw: _Client(calls))
    return calls


def test_lookup_body_has_no_consent(cm):
    decision = asyncio.run(DciConsentHelper().validate(None, "bank-a", subject_id={"type": "UIN", "value": "1"}))
    assert decision["decision"] == "permit"
    assert cm == [("http://cm/consent/v1/validate", {
        "partner_id": "bank-a", "data_controller": "farmer-registry",
        "request_context": {"subject_id": {"type": "UIN", "value": "1"}}})]


def test_no_consent_and_no_subject_denied_without_calling_cm(cm):
    decision = asyncio.run(DciConsentHelper().validate(None, "bank-a"))
    assert decision["reason_code"] == "missing_consent" and cm == []


def test_consent_jws_body_unchanged(cm):
    asyncio.run(DciConsentHelper().validate("a.b.c", "bank-a"))
    assert cm[0][1] == {"partner_id": "bank-a", "consent_jws": "a.b.c", "data_controller": "farmer-registry"}


# --- audit ------------------------------------------------------------------------

def test_consents_reach_the_audit_event():
    request = SimpleNamespace(
        state=SimpleNamespace(), method="POST", url=SimpleNamespace(path="/dci/registry/sync/search"),
        headers={},
    )
    add_audit_consent(request, "r1", decision="permit", consent_id="c-1", token_id="tok-9",
                      data_scopes=["farmer-registry.land"])
    add_audit_consent(None, "r2", decision="deny")  # no request: a no-op
    middleware = AuditMiddleware.__new__(AuditMiddleware)
    middleware._module, middleware._source, middleware._type_prefix = "m", "s", "t"
    event = middleware._build_event(request, None, 200, {"id": "bank-a"}, None, None, "success")
    assert event["data"]["context"]["consents"] == [
        {"reference_id": "r1", "decision": "permit", "consent_id": "c-1", "token_id": "tok-9",
         "data_scopes": ["farmer-registry.land"]}]


def test_consent_jti():
    assert DciConsentHelper.consent_jti(_jws({"jti": "x"})) == "x"
    assert DciConsentHelper.consent_jti(None) is None
    assert DciConsentHelper.consent_jti(_jws({})) is None
