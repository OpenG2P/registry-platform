"""Every partner API call is signed: /partner/ingest_data verifies the partner's
detached JWS over the configured signature payload; the staff path does not."""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import orjson
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi import FastAPI
from fastapi.testclient import TestClient
from jwt import PyJWS
from openg2p_fastapi_common.utils.crypto import PyJWTCryptoHelper
from openg2p_registry_core.controller_services import G2PIngestControllerService
from openg2p_registry_core.errors import G2PRegistryErrorCodes
from openg2p_registry_core.helpers import PatternMatcher
from openg2p_registry_core.helpers.partner_management import RegisteredPartner
from openg2p_registry_core.services import G2PIngestService
from openg2p_registry_core.services import g2p_ingest_service as ingest_module
from openg2p_registry_partner_api.ingestion.controllers import (
    g2p_ingest_controller as controller_module,
)
from openg2p_registry_partner_api.ingestion.helpers import RequestResponseHelper

PARTNER_ID = "PARTNER_COOP_1"
KEY = Ed25519PrivateKey.generate()
OTHER_KEY = Ed25519PrivateKey.generate()
KEY_PATHS = SimpleNamespace(
    key_path_for_sender="$.body.header.sender_id",
    key_path_for_signature="$.body.signature",
    key_path_for_signature_payload="$.body.message",
    key_path_for_message_id="$.body.header.message_id",
    is_list=False,
)


class _KeyStore:
    def __init__(self):
        self.asked = []

    async def get_keys(self, reference_id, wanted_kid=None):
        self.asked.append(reference_id)
        pem = KEY.public_key().public_bytes(
            serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
        ).decode()
        return [{"public_key_pem": pem, "algorithm": "EdDSA"}] if reference_id == PARTNER_ID else []


def _sign(payload, key=KEY) -> str:
    pem = key.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
    )
    full = PyJWS().encode(orjson.dumps(payload, option=orjson.OPT_SORT_KEYS), pem, algorithm="EdDSA")
    part1, _, part3 = full.split(".")
    return f"{part1}..{part3}"


def _body(signature=None, message=None):
    message = message if message is not None else {"farmer": {"name": "Abebe"}}
    body = {"header": {"sender_id": "coop-1", "message_id": "m-1"}, "message": message}
    if signature is not None:
        body["signature"] = signature
    return body


class _Session:
    def __init__(self):
        self.added = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def execute(self, _statement):
        return SimpleNamespace(scalar_one_or_none=lambda: KEY_PATHS)

    def add(self, row):
        self.added.append(row)

    async def commit(self):
        pass


@pytest.fixture
def env(monkeypatch):
    sessions = []

    def session_maker():
        session = _Session()
        sessions.append(session)
        return session

    PatternMatcher()
    service = G2PIngestService()
    monkeypatch.setattr(ingest_module, "get_async_session_maker", lambda: session_maker)
    monkeypatch.setattr(service, "_get_data_model", AsyncMock(
        return_value=SimpleNamespace(data_model_id="dm-1", response_template_document_id=None)))
    monkeypatch.setattr(service, "_get_partner_from_partner_mnemonic", AsyncMock(
        return_value=RegisteredPartner(partner_id=PARTNER_ID)))
    monkeypatch.setattr(G2PIngestService, "get_component", classmethod(lambda cls, *a, **k: service))

    controller = controller_module.G2PIngestController()
    controller.g2p_ingest_controller_service = G2PIngestControllerService()
    controller.request_response_helper = RequestResponseHelper()
    store = _KeyStore()
    controller.keymanager_helper.crypto_helper = PyJWTCryptoHelper(
        partner_key_store=store, allowed_algorithms=["EdDSA"])
    actors = []
    monkeypatch.setattr(controller_module, "set_audit_actor",
                        lambda request, partner_id, verified: actors.append((partner_id, verified)))
    outcomes = []
    monkeypatch.setattr(controller_module, "set_audit_outcome",
                        lambda request, outcome, reason=None: outcomes.append((outcome, reason)))
    monkeypatch.setattr(controller_module._config, "signature_validation_enabled", True)

    app = FastAPI()
    app.include_router(controller.router)
    return SimpleNamespace(client=TestClient(app), sessions=sessions, store=store, actors=actors,
                           outcomes=outcomes, partner_lookup=service._get_partner_from_partner_mnemonic)


def _post(env, body):
    response = env.client.post("/partner/ingest_data", params={"data_model": "farmer"}, json=body)
    assert response.status_code == 200
    return response.json()["response_header"]


def _stored(env) -> bool:
    return any(session.added for session in env.sessions)


def test_valid_signature_accepted(env):
    message = {"farmer": {"name": "Abebe"}}
    header = _post(env, _body(_sign(message), message))
    assert header["response_status"] == "SUCCESS", header
    assert _stored(env)
    assert env.store.asked == [PARTNER_ID]  # the PM key of the resolved partner
    assert env.actors == [(PARTNER_ID, True)]
    assert env.outcomes == []


def test_missing_signature_rejected(env):
    header = _post(env, _body())
    assert header["response_status"] == "ERROR"
    assert "signature key" in header["response_error_message"]
    assert not _stored(env)
    assert env.actors == []
    assert env.outcomes and env.outcomes[0][0] == "failure"


@pytest.mark.parametrize("signature", [
    "not-a-jws",
    _sign({"farmer": {"name": "Abebe"}}, OTHER_KEY),  # unregistered key
    _sign({"farmer": {"name": "Someone else"}}),  # signs a different payload
])
def test_bad_signature_rejected(env, signature):
    header = _post(env, _body(signature))
    assert header["response_status"] == "ERROR"
    assert header["response_error_code"] == G2PRegistryErrorCodes.REQUEST_VALIDATION_ERROR.value[1]
    assert not _stored(env)
    assert env.actors == []
    assert env.outcomes and env.outcomes[0][0] == "failure"


def test_partner_must_be_active(env):
    from openg2p_registry_core.errors import G2PRegistryException

    env.partner_lookup.side_effect = G2PRegistryException(code="G2P-REG-PARTNER", message="not registered")
    message = {"farmer": {"name": "Abebe"}}
    header = _post(env, _body(_sign(message), message))
    assert header["response_status"] == "ERROR"
    assert not _stored(env)


def test_switch_off_accepts_unsigned_with_warning(env, monkeypatch, caplog):
    monkeypatch.setattr(controller_module._config, "signature_validation_enabled", False)
    with caplog.at_level("WARNING"):
        header = _post(env, _body())
    assert header["response_status"] == "SUCCESS", header
    assert _stored(env)
    assert env.store.asked == []
    assert env.actors == [(PARTNER_ID, False)]
    assert "signature_validation_enabled=false" in caplog.text


def test_verify_without_verifier_fails_closed():
    import asyncio

    from openg2p_registry_core.errors import G2PRegistryException

    with pytest.raises(G2PRegistryException):
        asyncio.run(G2PIngestService().ingest_data("FARMER", {}, verify_signature=True))


def test_staff_ingest_does_not_verify():
    """The staff API (IAM-authenticated) calls the core service with verify_signature=False."""
    import ast
    import pathlib

    source = pathlib.Path(__file__).resolve().parents[2] / (
        "openg2p-registry-staff-api/src/openg2p_registry_staff_api/controllers/input_mechanism_data_controller.py")
    calls = [node for node in ast.walk(ast.parse(source.read_text()))
             if isinstance(node, ast.Call) and getattr(node.func, "attr", "") == "ingest_data"]
    assert calls
    for call in calls:
        kwargs = {kw.arg: kw.value for kw in call.keywords}
        assert isinstance(kwargs.get("verify_signature"), ast.Constant)
        assert kwargs["verify_signature"].value is False
        assert "signature_verifier" not in kwargs


def test_staff_path_accepts_unsigned(env):
    """With verify_signature=False (staff, file import) no signature is needed."""
    import asyncio

    correlation_id, _ = asyncio.run(G2PIngestService.get_component().ingest_data(
        "FARMER", {"headers": {}, "body": _body()}, verify_signature=False))
    assert correlation_id
    assert _stored(env)
    assert env.store.asked == []
