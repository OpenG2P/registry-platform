"""The Master Data client uses the running service's settings (its token URL and
client credentials), also from a thread that does not inherit the context in
which fastapi-common registers settings."""

import threading

import pytest
from openg2p_fastapi_common.context import config_registry
from pydantic_settings import SettingsConfigDict

from openg2p_registry_core.config import Settings as CoreSettings
from openg2p_registry_core.helpers import master_data_client as mdc


class ServiceSettings(CoreSettings):
    model_config = SettingsConfigDict(env_prefix="test_service_", extra="allow")


@pytest.fixture
def service_settings(monkeypatch):
    monkeypatch.setenv("TEST_SERVICE_MASTER_DATA_TOKEN_URL", "http://keycloak/token")
    monkeypatch.setattr(mdc, "_service_settings", None)
    token = config_registry.set([])
    ServiceSettings.get_config()
    yield
    config_registry.reset(token)


def _in_bare_thread(fn):
    result = {}
    thread = threading.Thread(target=lambda: result.setdefault("value", fn()))
    thread.start()
    thread.join()
    return result["value"]


def test_service_settings_are_used(service_settings):
    assert mdc._settings().master_data_token_url == "http://keycloak/token"


def test_a_bare_thread_still_gets_the_service_settings(service_settings):
    mdc._settings()
    assert _in_bare_thread(lambda: mdc._settings().master_data_token_url) == (
        "http://keycloak/token"
    )


def test_core_settings_when_no_service_registers_any(monkeypatch):
    monkeypatch.setattr(mdc, "_service_settings", None)
    token = config_registry.set([])
    try:
        assert type(mdc._settings()) is CoreSettings
    finally:
        config_registry.reset(token)


def test_geo_hierarchy_thread_sees_the_callers_context(monkeypatch):
    """The sync lookup, called from async code, runs the coroutine in a thread
    that sees the caller's context (and so the service's settings)."""
    import asyncio

    from openg2p_registry_core.services.g2p_geo_hierarchy_service import (
        G2PGeoHierarchyService,
    )

    marker = [object()]
    token = config_registry.set(marker)

    async def get_geo_hierarchy(self, level_value_id):
        return {"registry_seen": config_registry.get() is marker}

    monkeypatch.setattr(G2PGeoHierarchyService, "get_geo_hierarchy", get_geo_hierarchy)
    service = G2PGeoHierarchyService.__new__(G2PGeoHierarchyService)

    async def caller():
        return G2PGeoHierarchyService._get_geo_hierarchy_cached.__wrapped__(service, "X1")

    try:
        assert asyncio.run(caller()) == {"registry_seen": True}
    finally:
        config_registry.reset(token)
