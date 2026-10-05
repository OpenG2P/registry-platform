"""Data scopes in the partner API: the consent's issue time, scope IDs, pre-render filtering."""

import asyncio
import base64
import json
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from openg2p_registry_core.services import AllowedFields
from openg2p_registry_core.services.g2p_data_scope_fields import grant_from_refs

from openg2p_registry_partner_api.search.dci.controller import g2p_dci_controller as controller_module
from openg2p_registry_partner_api.search.dci.controller.g2p_dci_controller import G2PDciController, _own_scope_ids
from openg2p_registry_partner_api.search.dci.helpers.consent_helper import DciConsentHelper
from openg2p_registry_partner_api.search.dci.schemas.dci_request import (
    DciRequestHeader,
    DciSearchCriteria,
    DciSearchRequest,
    DciSearchRequestItem,
)
from openg2p_registry_partner_api.search.dci.services.g2p_dci_service import (
    ConsentScopeGrant,
    G2PDciService,
    _ActivityRecord,
)


def _jws(claims: dict) -> str:
    def b64(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

    header = b64(json.dumps({"alg": "EdDSA"}).encode())
    return f"{header}.{b64(json.dumps(claims).encode())}.{b64(b'sig')}"


# --------------------------------------------------------------- issue time


def test_issue_time_from_iat():
    iat = int(datetime(2026, 5, 1, 12, tzinfo=timezone.utc).timestamp())
    assert DciConsentHelper.consent_issued_at(_jws({"iat": iat})) == datetime(2026, 5, 1, 12)


def test_issue_time_from_issued_at():
    jws = _jws({"issued_at": "2026-05-01T15:00:00+03:00"})
    assert DciConsentHelper.consent_issued_at(jws) == datetime(2026, 5, 1, 12)
    assert DciConsentHelper.consent_issued_at(_jws({"issued_at": "2026-05-01T12:00:00Z"})) == datetime(2026, 5, 1, 12)


@pytest.mark.parametrize("jws", [None, "", "a.b", "x.!!!.y", _jws({"iat": "soon"}), _jws({"issued_at": "later"}),
                                 _jws({})])
def test_no_readable_issue_time(jws):
    assert DciConsentHelper.consent_issued_at(jws) is None


# --------------------------------------------------------------- scope IDs


def test_allow_list_names_become_scope_ids(monkeypatch):
    monkeypatch.setattr(controller_module._config, "consent_data_controller", "crop-sown-registry")
    assert _own_scope_ids(["crop_season", "crop-sown-registry.measures", "farmer-registry.land", " "]) == [
        "crop-sown-registry.crop_season", "crop-sown-registry.measures", "farmer-registry.land"]


def test_consent_carries_scopes_and_issue_time(monkeypatch):
    controller = G2PDciController.__new__(G2PDciController)
    consent = _jws({"iat": int(datetime(2026, 4, 1, tzinfo=timezone.utc).timestamp())})
    controller.consent_helper = SimpleNamespace(
        validate=AsyncMock(return_value={
            "decision": "permit", "effective_data_scopes": ["farmer-registry.land"],
            "subject_id": {"type": "fan", "value": "FAN-1"},
        }),
        consent_issued_at=DciConsentHelper.consent_issued_at,
    )
    criteria = {"reg_type": "Farmer", "reg_record_type": "x", "query_type": "idtype-value",
                "query": {"type": "idtype-value", "value": {"id_type": "FAN", "id_value": "FAN-1"}},
                "authorize": {"consent_jws": consent}}
    message = DciSearchRequest(transaction_id="t", search_request=[
        DciSearchRequestItem(reference_id="r1", search_criteria=DciSearchCriteria(**criteria))])
    header = DciRequestHeader(version="1", message_id="m", message_ts="now", action="search", sender_id="p",
                              receiver_id="r")
    raw = {"message": {"search_request": [{"reference_id": "r1", "search_criteria": criteria}]}}
    scopes, subjects = asyncio.run(controller._enforce_consent(raw, header, message, {}))
    assert scopes == {"r1": ConsentScopeGrant(["farmer-registry.land"], datetime(2026, 4, 1))}
    assert subjects == {"r1": "FAN-1"}


# --------------------------------------------------------------- filtering before rendering


class _Scopes:
    def __init__(self, refs):
        self.refs = refs
        self.calls = []

    async def resolve(self, scope_ids, issued_at):
        self.calls.append((list(scope_ids), issued_at))
        return AllowedFields(grant_from_refs(self.refs))

    async def nested_keys(self):
        return {}


def _activity_service(refs, record):
    service = G2PDciService.__new__(G2PDciService)
    service.data_scopes = _Scopes(refs)
    service.register_service = None
    service._get_register_id = AsyncMock(return_value="reg-crop")
    service._get_data_model_id = AsyncMock(return_value="dm")
    service._get_template_store_id = AsyncMock(return_value=("tpl", None))
    service._is_activity_register = AsyncMock(return_value=True)
    service._get_activity_model_class = lambda mnemonic: object
    service._state_context_type = AsyncMock(return_value=None)
    service._activity_search = AsyncMock(return_value=([_ActivityRecord(record)], 1))
    rendered = []

    def render(data, template_store_id, bucket=None):
        rendered.append(data)
        return {"rendered": data}

    service._render_reg_record_with_template = render
    return service, rendered


def _activity_search_message():
    criteria = DciSearchCriteria(
        reg_type="CropSown", reg_record_type="spdci-extensions-agri:CropActivity", query_type="idtype-value",
        query={"type": "idtype-value", "value": {"id_type": "FAN", "id_value": "FAN-1"}},
    )
    return DciSearchRequest(transaction_id="t", search_request=[
        DciSearchRequestItem(reference_id="r1", search_criteria=criteria)])


ACTIVITY = {"activity_id": "a1", "subject_id": "FAN-1", "crop": "TEFF", "area_ha": 1.5, "farmer_id": "F-1"}


def test_activity_record_filtered_before_rendering():
    service, rendered = _activity_service(["CropSown.activity.crop", "Farmer.first_name"], ACTIVITY)
    items = asyncio.run(service.search(
        "sig", None, _activity_search_message(),
        consent_scopes_by_ref={"r1": ConsentScopeGrant(["crop-sown-registry.crop_season"], datetime(2026, 1, 1))},
        consent_subjects_by_ref={"r1": "FAN-1"},
    ))
    # The consent-subject check ran on the unfiltered record (subject_id is not consented).
    assert rendered == [{"activity_id": None, "subject_id": None, "crop": "TEFF", "area_ha": None, "farmer_id": None}]
    assert items[0].data.reg_records == [{"rendered": rendered[0]}]
    assert service.data_scopes.calls == [(["crop-sown-registry.crop_season"], datetime(2026, 1, 1))]


def test_no_filtering_when_consent_enforcement_is_off():
    service, rendered = _activity_service([], ACTIVITY)
    asyncio.run(service.search("sig", None, _activity_search_message(), consent_scopes_by_ref=None,
                               consent_subjects_by_ref=None))
    assert rendered == [ACTIVITY]
    assert service.data_scopes.calls == []


def test_item_without_scopes_gets_nothing():
    service, rendered = _activity_service(["CropSown.activity.*"], ACTIVITY)
    asyncio.run(service.search("sig", None, _activity_search_message(), consent_scopes_by_ref={},
                               consent_subjects_by_ref={"r1": "FAN-1"}))
    assert all(value is None for value in rendered[0].values())


# --------------------------------------------------------------- catalogue endpoint


def test_partner_catalogue_endpoint(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from openg2p_registry_partner_api.data_scopes import g2p_data_scope_partner_controller as module

    scope = {
        "scope_id": "farmer-registry.land", "name": "land", "data_controller": "farmer-registry", "label": "Land",
        "description": None, "status": "ACTIVE", "source": "SECTION", "current_version": 1, "retired_at": None,
        "versions": [{"version": 1, "effective_from": "2026-01-01T00:00:00", "fields": ["section:land"],
                      "resolved_fields": ["Land.area"], "renamed_fields": None}],
    }
    controller = module.G2PDataScopePartnerController()
    controller.data_scopes = SimpleNamespace(controller_id=lambda: "farmer-registry",
                                             list_scopes=AsyncMock(return_value=[scope]))
    monkeypatch.setattr(module._config, "signature_validation_enabled", False)
    app = FastAPI()
    app.include_router(controller.router)
    client = TestClient(app)

    body = client.get("/partner/data_scopes").json()
    assert body["data_controller"] == "farmer-registry"
    assert body["data_scopes"][0]["scope_id"] == "farmer-registry.land"
    assert body["data_scopes"][0]["versions"][0]["fields"] == ["section:land"]

    signed = client.post("/partner/data_scopes", json={
        "header": {"sender_id": "p", "message_id": "m", "message_ts": "2026-01-01T00:00:00Z"}, "message": {}})
    assert signed.json()["data_scopes"][0]["name"] == "land"
