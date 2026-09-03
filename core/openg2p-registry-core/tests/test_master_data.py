from __future__ import annotations

import asyncio
import time
from types import SimpleNamespace
from unittest.mock import patch

import httpx
import pytest

from openg2p_registry_core.helpers import master_data as master_data_mod
from openg2p_registry_core.helpers.master_data import MasterDataClient


def _cfg(**overrides):
    base = dict(
        master_data_api_url="",
        master_data_timeout_seconds=5.0,
        master_data_cache_seconds=300,
        master_data_token_url="",
        master_data_client_id="",
        master_data_client_secret="",
        partner_mgmt_admin_token_url="",
        partner_mgmt_admin_client_id="",
        partner_mgmt_admin_client_secret="",
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def _success(payload):
    return {
        "response_header": {"response_status": "SUCCESS", "request_id": "r1"},
        "response_body": {"response_payload": payload},
    }


def _patched_client(handler):
    class PatchedAsyncClient(httpx.AsyncClient):
        def __init__(self, *args, **kwargs):
            kwargs["transport"] = httpx.MockTransport(handler)
            super().__init__(*args, **kwargs)

    return PatchedAsyncClient


def test_get_attribute_codes_raises_when_unconfigured():
    client = MasterDataClient()
    with patch.object(
        master_data_mod,
        "get_master_data_settings",
        return_value=_cfg(),
    ):
        with pytest.raises(RuntimeError, match="not configured"):
            asyncio.run(client.get_attribute_codes())


def test_get_attribute_codes_pages_and_caches():
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        assert str(request.url.path).endswith("/attributes/get_attribute_values")
        return httpx.Response(
            200,
            json=_success(
                {
                    "attribute_values": [
                        {"attribute_id": "GENDER", "value_code": "MALE"},
                        {"attribute_id": "GENDER", "value_code": "FEMALE"},
                    ],
                    "total": 2,
                }
            ),
        )

    client = MasterDataClient()
    cfg = _cfg(master_data_api_url="http://ms")
    with (
        patch.object(
            master_data_mod,
            "get_master_data_settings",
            return_value=cfg,
        ),
        patch.object(
            master_data_mod.httpx,
            "AsyncClient",
            _patched_client(handler),
        ),
    ):
        first = asyncio.run(client.get_attribute_codes())
        second = asyncio.run(client.get_attribute_codes())

    assert first == {"GENDER": {"MALE", "FEMALE"}}
    assert second == first
    assert calls["n"] == 1


def test_get_attribute_codes_cache_can_be_disabled():
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(
            200,
            json=_success(
                {
                    "attribute_values": [
                        {"attribute_id": "GENDER", "value_code": "MALE"},
                    ],
                    "total": 1,
                }
            ),
        )

    client = MasterDataClient()
    with (
        patch.object(
            master_data_mod,
            "get_master_data_settings",
            return_value=_cfg(
                master_data_api_url="http://ms",
                master_data_cache_seconds=0,
            ),
        ),
        patch.object(
            master_data_mod.httpx,
            "AsyncClient",
            _patched_client(handler),
        ),
    ):
        asyncio.run(client.get_attribute_codes())
        asyncio.run(client.get_attribute_codes())
    assert calls["n"] == 2


def test_get_attribute_codes_sends_bearer_token():
    seen = {"auth": None}

    def handler(request: httpx.Request) -> httpx.Response:
        if str(request.url) == "http://kc/token":
            return httpx.Response(200, json={"access_token": "tok", "expires_in": 300})
        seen["auth"] = request.headers.get("authorization")
        return httpx.Response(
            200,
            json=_success({"attribute_values": [], "total": 0}),
        )

    client = MasterDataClient()
    with (
        patch.object(
            master_data_mod,
            "get_master_data_settings",
            return_value=_cfg(
                master_data_api_url="http://ms",
                master_data_token_url="http://kc/token",
                master_data_client_id="cid",
                master_data_client_secret="secret",
            ),
        ),
        patch.object(
            master_data_mod.httpx,
            "AsyncClient",
            _patched_client(handler),
        ),
    ):
        codes = asyncio.run(client.get_attribute_codes())

    assert codes == {}
    assert seen["auth"] == "Bearer tok"


def test_get_geo_hierarchy_walks_parent_chain():
    import json as json_mod

    def handler(request: httpx.Request) -> httpx.Response:
        path = str(request.url.path)
        if path.endswith("/geo/get_all_geo_levels"):
            return httpx.Response(
                200,
                json=_success(
                    [
                        {"level_id": "l1", "level_mnemonic": "state"},
                        {"level_id": "l2", "level_mnemonic": "district"},
                    ]
                ),
            )
        payload = json_mod.loads(request.content.decode())["request_body"]["request_payload"]
        if payload["level_id"] == "l1":
            return httpx.Response(
                200,
                json=_success(
                    [
                        {
                            "level_value_id": "karnataka",
                            "level_id": "l1",
                            "level_value_mnemonic": "karnataka",
                            "parent_level_value_id": None,
                        }
                    ]
                ),
            )
        return httpx.Response(
            200,
            json=_success(
                [
                    {
                        "level_value_id": "bangalore",
                        "level_id": "l2",
                        "level_value_mnemonic": "bangalore",
                        "parent_level_value_id": "karnataka",
                    }
                ]
            ),
        )

    client = MasterDataClient()
    with (
        patch.object(
            master_data_mod,
            "get_master_data_settings",
            return_value=_cfg(master_data_api_url="http://ms"),
        ),
        patch.object(
            master_data_mod.httpx,
            "AsyncClient",
            _patched_client(handler),
        ),
    ):
        hierarchy = asyncio.run(client.get_geo_hierarchy("bangalore"))

    assert hierarchy == {
        "hierarchy": [
            {
                "level_mnemonic": "state",
                "level_value_mnemonic": "karnataka",
                "level_value_id": "karnataka",
            },
            {
                "level_mnemonic": "district",
                "level_value_mnemonic": "bangalore",
                "level_value_id": "bangalore",
            },
        ]
    }


def test_get_geo_hierarchy_returns_none_when_unconfigured():
    client = MasterDataClient()
    with patch.object(
        master_data_mod,
        "get_master_data_settings",
        return_value=_cfg(),
    ):
        assert asyncio.run(client.get_geo_hierarchy("bangalore")) is None


def test_get_attribute_codes_ttl_refresh():
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(
            200,
            json=_success(
                {
                    "attribute_values": [
                        {"attribute_id": "GENDER", "value_code": "MALE"},
                    ],
                    "total": 1,
                }
            ),
        )

    client = MasterDataClient()
    with (
        patch.object(
            master_data_mod,
            "get_master_data_settings",
            return_value=_cfg(
                master_data_api_url="http://ms",
                master_data_cache_seconds=1,
            ),
        ),
        patch.object(
            master_data_mod.httpx,
            "AsyncClient",
            _patched_client(handler),
        ),
    ):
        asyncio.run(client.get_attribute_codes())
        client._codes_expires_at = time.monotonic() - 1
        asyncio.run(client.get_attribute_codes())
    assert calls["n"] == 2
