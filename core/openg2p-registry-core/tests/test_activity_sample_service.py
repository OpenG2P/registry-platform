"""load_all: strict mode aggregates per-register failures; non-strict logs and carries on."""

import asyncio
from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

# Imported when the tests run, not at collection: other test modules pop and
# re-import openg2p_registry_core.errors while being collected, and importing the
# services package here first would pin the old exception class for them.
G2PRegistryException = G2PActivitySampleLoadError = G2PActivitySampleService = None


class _Session:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


def _service(outcomes):
    """A service whose registers are the keys of ``outcomes``; a value that is an
    exception is raised by load(), anything else is returned."""
    service = G2PActivitySampleService.__new__(G2PActivitySampleService)
    service.registry = SimpleNamespace(
        list_registers=AsyncMock(return_value=[SimpleNamespace(register_mnemonic=m) for m in outcomes])
    )
    calls = []

    async def load(mnemonic, wait_for_lock=True):
        calls.append((mnemonic, wait_for_lock))
        outcome = outcomes[mnemonic]
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    service.load = load
    service.calls = calls
    return service


@pytest.fixture(autouse=True)
def _no_db():
    global G2PRegistryException, G2PActivitySampleLoadError, G2PActivitySampleService
    from openg2p_registry_core.errors import G2PRegistryException
    from openg2p_registry_core.services import G2PActivitySampleLoadError, G2PActivitySampleService

    with patch.object(G2PActivitySampleService, "_session_maker", staticmethod(lambda: _Session)):
        yield


def test_strict_attempts_every_register_and_raises_all_failures():
    service = _service({
        "CROP_SOWN": G2PRegistryException(code="x", message="crop: 'CROP_WHEAT' is not a known code"),
        "FIELD_WORK": 4,
        "HARVEST": ValueError("boom"),
    })
    with pytest.raises(G2PActivitySampleLoadError) as caught:
        asyncio.run(service.load_all(strict=True))
    error = caught.value
    assert error.failures == {
        "CROP_SOWN": "crop: 'CROP_WHEAT' is not a known code",
        "HARVEST": "boom",
    }
    assert error.loaded == {"FIELD_WORK": 4}
    assert "CROP_SOWN: crop: 'CROP_WHEAT' is not a known code" in str(error)
    assert "HARVEST: boom" in str(error)
    # every register attempted, each waiting for any concurrent loader
    assert service.calls == [("CROP_SOWN", True), ("FIELD_WORK", True), ("HARVEST", True)]


def test_strict_success_returns_counts():
    service = _service({"CROP_SOWN": 3, "FIELD_WORK": 0})
    assert asyncio.run(service.load_all(strict=True)) == {"CROP_SOWN": 3, "FIELD_WORK": 0}


def test_non_strict_logs_and_returns_what_loaded():
    service = _service({"CROP_SOWN": ValueError("boom"), "FIELD_WORK": 2})
    assert asyncio.run(service.load_all()) == {"FIELD_WORK": 2}
    # the beat task never blocks on another process's load
    assert service.calls == [("CROP_SOWN", False), ("FIELD_WORK", False)]


def test_load_skips_when_another_process_holds_the_lock():
    service = G2PActivitySampleService.__new__(G2PActivitySampleService)

    @asynccontextmanager
    async def busy(_mnemonic, _wait):
        yield False

    service._register_lock = busy
    service._load = AsyncMock(return_value=5)
    assert asyncio.run(service.load("CROP_SOWN", wait_for_lock=False)) == 0
    service._load.assert_not_called()
