"""Unit tests for AWE policy lookup cache and CRUD invalidation.

Uses the installed registry package (reg-venv). The services package __init__
is skipped because it pulls optional ingest deps that this venv does not have.
"""

from __future__ import annotations

import importlib.util
import sys
import types
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend

from openg2p_registry_core.helpers.orm_cache import policy_lookup_key_builder
from openg2p_registry_core.models.enum import AwePolicyScopeEnum
from openg2p_registry_core.models.g2p_registry_awe_policy_configuration import (
    G2PRegistryAwePolicyConfiguration,
)

_CORE_SRC = Path(__file__).resolve().parents[1] / "src" / "openg2p_registry_core"
_SERVICE_PATH = _CORE_SRC / "services" / "g2p_awe_policy_configuration_service.py"


def _load_policy_service_module():
    if "openg2p_registry_core.services.g2p_awe_policy_configuration_service" in sys.modules:
        return sys.modules["openg2p_registry_core.services.g2p_awe_policy_configuration_service"]

    if "openg2p_registry_core.services" not in sys.modules:
        pkg = types.ModuleType("openg2p_registry_core.services")
        pkg.__path__ = [str(_CORE_SRC / "services")]  # type: ignore[attr-defined]
        pkg.__package__ = "openg2p_registry_core.services"
        sys.modules["openg2p_registry_core.services"] = pkg

    spec = importlib.util.spec_from_file_location(
        "openg2p_registry_core.services.g2p_awe_policy_configuration_service",
        _SERVICE_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


_mod = _load_policy_service_module()
G2PAwePolicyConfigurationService = _mod.G2PAwePolicyConfigurationService
_POLICY_LOOKUP_CACHE_NAMESPACE = _mod._POLICY_LOOKUP_CACHE_NAMESPACE


def _policy_row(**overrides) -> G2PRegistryAwePolicyConfiguration:
    data = dict(
        awe_policy_config_id="cfg-1",
        policy_scope=AwePolicyScopeEnum.SECTION,
        register_id="reg-1",
        intake_form_id=None,
        section_id="sec-1",
        policy_type="registry.change_request",
        policy_key="workflow-a",
        context_field_names=["record_name"],
    )
    data.update(overrides)
    return G2PRegistryAwePolicyConfiguration(**data)


def _session_maker(session):
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=session)
    cm.__aexit__ = AsyncMock(return_value=False)
    factory = MagicMock(return_value=cm)
    return MagicMock(return_value=factory)


@pytest.fixture
def memory_cache():
    InMemoryBackend._store.clear()
    FastAPICache.init(InMemoryBackend(), prefix="fastapi-cache-registry")
    yield
    InMemoryBackend._store.clear()


@pytest.fixture
def service():
    return G2PAwePolicyConfigurationService()


def test_policy_lookup_key_builder_uses_lookup_tuple_not_session():
    def fake_lookup(self, session, *, register_id, policy_type, section_id=None, intake_form_id=None):
        return None

    key_a = policy_lookup_key_builder(
        fake_lookup,
        "ns",
        args=(object(), object()),
        kwargs={
            "register_id": "reg-1",
            "policy_type": "registry.change_request",
            "section_id": "sec-1",
            "intake_form_id": None,
        },
    )
    key_b = policy_lookup_key_builder(
        fake_lookup,
        "ns",
        args=(object(), object()),
        kwargs={
            "register_id": "reg-1",
            "policy_type": "registry.change_request",
            "section_id": "sec-1",
            "intake_form_id": None,
        },
    )
    key_other_section = policy_lookup_key_builder(
        fake_lookup,
        "ns",
        args=(object(), object()),
        kwargs={
            "register_id": "reg-1",
            "policy_type": "registry.change_request",
            "section_id": "sec-2",
            "intake_form_id": None,
        },
    )
    assert key_a == key_b
    assert "reg-1" in key_a
    assert "registry.change_request" in key_a
    assert "sec-1" in key_a
    assert key_a != key_other_section


@pytest.mark.asyncio
async def test_find_effective_policy_caches_second_lookup(service, memory_cache):
    row = _policy_row()
    with patch.object(
        service, "_query_effective_policy_configuration", new_callable=AsyncMock
    ) as query:
        query.return_value = row
        first = await service.find_effective_policy_configuration(
            object(),
            register_id="reg-1",
            policy_type="registry.change_request",
            section_id="sec-1",
        )
        second = await service.find_effective_policy_configuration(
            object(),
            register_id="reg-1",
            policy_type="registry.change_request",
            section_id="sec-1",
        )

    assert query.await_count == 1
    assert first.policy_key == "workflow-a"
    assert second.policy_key == "workflow-a"
    assert first.context_field_names == ["record_name"]


@pytest.mark.asyncio
async def test_find_effective_policy_different_keys_miss_cache(service, memory_cache):
    with patch.object(
        service, "_query_effective_policy_configuration", new_callable=AsyncMock
    ) as query:
        query.side_effect = [
            _policy_row(section_id="sec-1", policy_key="workflow-a"),
            _policy_row(section_id="sec-2", policy_key="workflow-b"),
        ]
        first = await service.find_effective_policy_configuration(
            object(),
            register_id="reg-1",
            policy_type="registry.change_request",
            section_id="sec-1",
        )
        second = await service.find_effective_policy_configuration(
            object(),
            register_id="reg-1",
            policy_type="registry.change_request",
            section_id="sec-2",
        )

    assert query.await_count == 2
    assert first.policy_key == "workflow-a"
    assert second.policy_key == "workflow-b"


@pytest.mark.asyncio
async def test_invalidate_clears_policy_lookup_namespace(service, memory_cache):
    with patch.object(
        service, "_query_effective_policy_configuration", new_callable=AsyncMock
    ) as query:
        query.return_value = _policy_row()
        await service.find_effective_policy_configuration(
            object(),
            register_id="reg-1",
            policy_type="registry.change_request",
            section_id="sec-1",
        )
        await service._invalidate_policy_lookup_cache()
        await service.find_effective_policy_configuration(
            object(),
            register_id="reg-1",
            policy_type="registry.change_request",
            section_id="sec-1",
        )

    assert query.await_count == 2


@pytest.mark.asyncio
async def test_create_invalidates_policy_lookup_cache(service, memory_cache):
    session = AsyncMock()
    session.add = MagicMock()
    with (
        patch.object(_mod, "async_sessionmaker", _session_maker(session)),
        patch.object(service, "_validate_register_exists", new_callable=AsyncMock),
        patch.object(service, "_invalidate_policy_lookup_cache", new_callable=AsyncMock) as invalidate,
    ):
        result = await service.create_awe_policy_configuration(
            policy_scope="REGISTER",
            register_id="reg-1",
            intake_form_id=None,
            section_id=None,
            policy_type="registry.change_request",
            policy_key="workflow-a",
            context_field_names=None,
        )

    session.add.assert_called_once()
    session.commit.assert_awaited()
    invalidate.assert_awaited_once()
    assert result[0].policy_key == "workflow-a"


@pytest.mark.asyncio
async def test_update_invalidates_policy_lookup_cache(service, memory_cache):
    session = AsyncMock()
    existing = _policy_row()
    with (
        patch.object(_mod, "async_sessionmaker", _session_maker(session)),
        patch.object(service, "_get_configuration_or_error", new_callable=AsyncMock, return_value=existing),
        patch.object(service, "_invalidate_policy_lookup_cache", new_callable=AsyncMock) as invalidate,
    ):
        result = await service.update_awe_policy_configuration(
            awe_policy_config_id="cfg-1",
            policy_scope=None,
            register_id=None,
            intake_form_id=None,
            section_id=None,
            policy_type=None,
            policy_key="workflow-b",
            context_field_names=None,
        )

    session.commit.assert_awaited()
    invalidate.assert_awaited_once()
    assert result[0].policy_key == "workflow-b"


@pytest.mark.asyncio
async def test_delete_invalidates_policy_lookup_cache(service, memory_cache):
    session = AsyncMock()
    existing = _policy_row()
    with (
        patch.object(_mod, "async_sessionmaker", _session_maker(session)),
        patch.object(service, "_get_configuration_or_error", new_callable=AsyncMock, return_value=existing),
        patch.object(service, "_invalidate_policy_lookup_cache", new_callable=AsyncMock) as invalidate,
    ):
        result = await service.delete_awe_policy_configuration("cfg-1")

    session.delete.assert_awaited_once_with(existing)
    session.commit.assert_awaited()
    invalidate.assert_awaited_once()
    assert result[0].awe_policy_config_id == "cfg-1"


@pytest.mark.asyncio
async def test_create_then_lookup_does_not_serve_stale_row(service, memory_cache):
    with patch.object(
        service, "_query_effective_policy_configuration", new_callable=AsyncMock
    ) as query:
        query.return_value = _policy_row(policy_key="workflow-a")
        first = await service.find_effective_policy_configuration(
            object(),
            register_id="reg-1",
            policy_type="registry.change_request",
            section_id="sec-1",
        )
        assert first.policy_key == "workflow-a"

        query.return_value = _policy_row(policy_key="workflow-b")
        await service._invalidate_policy_lookup_cache()
        second = await service.find_effective_policy_configuration(
            object(),
            register_id="reg-1",
            policy_type="registry.change_request",
            section_id="sec-1",
        )

    assert second.policy_key == "workflow-b"
    assert query.await_count == 2
    assert _POLICY_LOOKUP_CACHE_NAMESPACE == "awe-policy-lookup"
