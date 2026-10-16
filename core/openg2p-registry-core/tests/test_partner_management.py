from __future__ import annotations

import asyncio
import importlib
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import patch

import httpx
import pytest

# Earlier tests stub ``openg2p_registry_core.errors`` as a plain module.
# Reload the real package so PartnerManagementClient can raise registry errors.
_SRC = Path(__file__).resolve().parents[1] / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))
for _name in list(sys.modules):
    if _name == "openg2p_registry_core.errors" or _name.startswith(
        "openg2p_registry_core.errors."
    ):
        sys.modules.pop(_name)
    if _name == "openg2p_registry_core.helpers" or _name.startswith(
        "openg2p_registry_core.helpers."
    ):
        sys.modules.pop(_name)
importlib.invalidate_caches()

# Stub BaseService with get_component classmethod BEFORE importing
fastapi_service = sys.modules.get("openg2p_fastapi_common.service") or ModuleType("openg2p_fastapi_common.service")
if "openg2p_fastapi_common.service" not in sys.modules:
    sys.modules["openg2p_fastapi_common.service"] = fastapi_service

class BaseService:
    @classmethod
    def get_component(cls):
        return cls()

fastapi_service.BaseService = BaseService

from openg2p_registry_core.errors import G2PRegistryException
from openg2p_registry_core.helpers.partner_management import (
    PartnerManagementClient,
    canonical_partner_id,
    partner_reference_id,
)


@pytest.mark.parametrize(
    ("sender", "expected"),
    [
        ("acme", "PARTNER_ACME"),
        ("PARTNER_ACME", "PARTNER_ACME"),
        ("partner_acme", "PARTNER_ACME"),
        ("foo-bar", "PARTNER_FOO_BAR"),
        ("Staff Portal", "PARTNER_STAFF_PORTAL"),
        ("", ""),
        ("  acme  ", "PARTNER_ACME"),
    ],
)
def test_partner_reference_id(sender, expected):
    assert partner_reference_id(sender) == expected


def _empty_cfg(**overrides):
    base = dict(
        partner_mgmt_admin_api_url="",
        partner_mgmt_admin_token_url="",
        partner_mgmt_admin_client_id="",
        partner_mgmt_admin_client_secret="",
        partner_mgmt_api_url="",
        partner_mgmt_timeout_seconds=5.0,
        partner_mgmt_cache_seconds=300,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def test_require_active_partner_skips_remote_when_unconfigured():
    client = PartnerManagementClient()
    with patch(
        "openg2p_registry_core.helpers.partner_management.get_partner_mgmt_settings",
        return_value=_empty_cfg(),
    ):
        partner = asyncio.run(client.require_active_partner("acme"))
    assert partner.partner_id == "PARTNER_ACME"
    assert partner.status == "active"


def test_require_active_partner_rejects_empty_sender_when_unconfigured():
    client = PartnerManagementClient()
    with patch(
        "openg2p_registry_core.helpers.partner_management.get_partner_mgmt_settings",
        return_value=_empty_cfg(),
    ):
        with pytest.raises(G2PRegistryException):
            asyncio.run(client.require_active_partner("  "))


def test_require_active_partner_via_staff_api():
    cfg = _empty_cfg(
        partner_mgmt_admin_api_url="http://pm-staff",
        partner_mgmt_admin_token_url="http://kc/token",
        partner_mgmt_admin_client_id="cid",
        partner_mgmt_admin_client_secret="secret",
    )

    def handler(request: httpx.Request) -> httpx.Response:
        if str(request.url) == "http://kc/token":
            return httpx.Response(200, json={"access_token": "tok"})
        if str(request.url).endswith("/partners/PARTNER_ACME") or str(request.url).endswith(
            "/partners/acme"
        ):
            if str(request.url).endswith("/partners/acme"):
                return httpx.Response(404)
            return httpx.Response(
                200,
                json={
                    "partner_id": "PARTNER_ACME",
                    "name": "Acme",
                    "status": "active",
                },
            )
        return httpx.Response(404)

    class PatchedAsyncClient(httpx.AsyncClient):
        def __init__(self, *args, **kwargs):
            kwargs["transport"] = httpx.MockTransport(handler)
            super().__init__(*args, **kwargs)

    client = PartnerManagementClient()
    with (
        patch(
            "openg2p_registry_core.helpers.partner_management.get_partner_mgmt_settings",
            return_value=cfg,
        ),
        patch(
            "openg2p_registry_core.helpers.partner_management.httpx.AsyncClient",
            PatchedAsyncClient,
        ),
    ):
        partner = asyncio.run(client.require_active_partner("acme"))
    assert partner.partner_id == "PARTNER_ACME"
    assert partner.name == "Acme"


def test_require_active_partner_rejects_inactive():
    cfg = _empty_cfg(
        partner_mgmt_admin_api_url="http://pm-staff",
        partner_mgmt_admin_token_url="http://kc/token",
        partner_mgmt_admin_client_id="cid",
        partner_mgmt_admin_client_secret="secret",
    )

    def handler(request: httpx.Request) -> httpx.Response:
        if str(request.url) == "http://kc/token":
            return httpx.Response(200, json={"access_token": "tok"})
        return httpx.Response(200, json={"partner_id": "PARTNER_ACME", "status": "inactive"})

    class PatchedAsyncClient(httpx.AsyncClient):
        def __init__(self, *args, **kwargs):
            kwargs["transport"] = httpx.MockTransport(handler)
            super().__init__(*args, **kwargs)

    client = PartnerManagementClient()
    with (
        patch(
            "openg2p_registry_core.helpers.partner_management.get_partner_mgmt_settings",
            return_value=cfg,
        ),
        patch(
            "openg2p_registry_core.helpers.partner_management.httpx.AsyncClient",
            PatchedAsyncClient,
        ),
    ):
        with pytest.raises(G2PRegistryException):
            asyncio.run(client.require_active_partner("acme"))


def _staff_cfg(**overrides):
    return _empty_cfg(
        partner_mgmt_admin_api_url="http://pm-staff",
        partner_mgmt_admin_token_url="http://kc/token",
        partner_mgmt_admin_client_id="cid",
        partner_mgmt_admin_client_secret="secret",
        **overrides,
    )


def _patched_client(handler):
    class PatchedAsyncClient(httpx.AsyncClient):
        def __init__(self, *args, **kwargs):
            kwargs["transport"] = httpx.MockTransport(handler)
            super().__init__(*args, **kwargs)

    return PatchedAsyncClient


def test_require_active_partner_caches_staff_lookup():
    partner_gets = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        if str(request.url) == "http://kc/token":
            return httpx.Response(200, json={"access_token": "tok", "expires_in": 300})
        if "/partners/" in str(request.url):
            partner_gets["n"] += 1
            if str(request.url).endswith("/partners/PARTNER_ACME"):
                return httpx.Response(
                    200,
                    json={
                        "partner_id": "PARTNER_ACME",
                        "name": "Acme",
                        "status": "active",
                    },
                )
            return httpx.Response(404)
        return httpx.Response(404)

    client = PartnerManagementClient()
    with (
        patch(
            "openg2p_registry_core.helpers.partner_management.get_partner_mgmt_settings",
            return_value=_staff_cfg(),
        ),
        patch(
            "openg2p_registry_core.helpers.partner_management.httpx.AsyncClient",
            _patched_client(handler),
        ),
    ):
        first = asyncio.run(client.require_active_partner("acme"))
        second = asyncio.run(client.require_active_partner("PARTNER_ACME"))
    assert first.partner_id == second.partner_id == "PARTNER_ACME"
    assert partner_gets["n"] == 2  # raw 404 + mapped 200; second call is cached


def test_lookup_active_partner_returns_none_on_miss():
    cfg = _staff_cfg()

    def handler(request: httpx.Request) -> httpx.Response:
        if str(request.url) == "http://kc/token":
            return httpx.Response(200, json={"access_token": "tok"})
        return httpx.Response(404)

    client = PartnerManagementClient()
    with (
        patch(
            "openg2p_registry_core.helpers.partner_management.get_partner_mgmt_settings",
            return_value=cfg,
        ),
        patch(
            "openg2p_registry_core.helpers.partner_management.httpx.AsyncClient",
            _patched_client(handler),
        ),
    ):
        partner = asyncio.run(client.lookup_active_partner("ghost"))
    assert partner is None


def test_canonical_partner_id_keeps_staff_mnemonic_when_unconfigured():
    client = PartnerManagementClient()
    with patch(
        "openg2p_registry_core.helpers.partner_management.PartnerManagementClient.get_component",
        return_value=client,
    ), patch(
        "openg2p_registry_core.helpers.partner_management.get_partner_mgmt_settings",
        return_value=_empty_cfg(),
    ):
        result = asyncio.run(canonical_partner_id("Registry Staff Portal UI"))
    assert result == "Registry Staff Portal UI"


def test_canonical_partner_id_uses_pm_id_when_found():
    cfg = _staff_cfg()

    def handler(request: httpx.Request) -> httpx.Response:
        if str(request.url) == "http://kc/token":
            return httpx.Response(200, json={"access_token": "tok"})
        if str(request.url).endswith("/partners/PARTNER_ACME"):
            return httpx.Response(
                200,
                json={"partner_id": "PARTNER_ACME", "name": "Acme", "status": "active"},
            )
        return httpx.Response(404)

    client = PartnerManagementClient()
    with (
        patch(
            "openg2p_registry_core.helpers.partner_management.PartnerManagementClient.get_component",
            return_value=client,
        ),
        patch(
            "openg2p_registry_core.helpers.partner_management.get_partner_mgmt_settings",
            return_value=cfg,
        ),
        patch(
            "openg2p_registry_core.helpers.partner_management.httpx.AsyncClient",
            _patched_client(handler),
        ),
    ):
        result = asyncio.run(canonical_partner_id("acme"))
    assert result == "PARTNER_ACME"


def test_canonical_partner_id_keeps_original_on_miss():
    cfg = _staff_cfg()

    def handler(request: httpx.Request) -> httpx.Response:
        if str(request.url) == "http://kc/token":
            return httpx.Response(200, json={"access_token": "tok"})
        return httpx.Response(404)

    client = PartnerManagementClient()
    with (
        patch(
            "openg2p_registry_core.helpers.partner_management.PartnerManagementClient.get_component",
            return_value=client,
        ),
        patch(
            "openg2p_registry_core.helpers.partner_management.get_partner_mgmt_settings",
            return_value=cfg,
        ),
        patch(
            "openg2p_registry_core.helpers.partner_management.httpx.AsyncClient",
            _patched_client(handler),
        ),
    ):
        result = asyncio.run(canonical_partner_id("Registry Staff Portal UI"))
    assert result == "Registry Staff Portal UI"


def test_require_active_partner_cache_can_be_disabled():
    partner_gets = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        if str(request.url) == "http://kc/token":
            return httpx.Response(200, json={"access_token": "tok", "expires_in": 300})
        partner_gets["n"] += 1
        return httpx.Response(
            200,
            json={"partner_id": "PARTNER_ACME", "name": "Acme", "status": "active"},
        )

    client = PartnerManagementClient()
    with (
        patch(
            "openg2p_registry_core.helpers.partner_management.get_partner_mgmt_settings",
            return_value=_staff_cfg(partner_mgmt_cache_seconds=0),
        ),
        patch(
            "openg2p_registry_core.helpers.partner_management.httpx.AsyncClient",
            _patched_client(handler),
        ),
    ):
        asyncio.run(client.require_active_partner("PARTNER_ACME"))
        asyncio.run(client.require_active_partner("PARTNER_ACME"))
    assert partner_gets["n"] == 2
