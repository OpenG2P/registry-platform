"""MasterDataClient against the in-memory catalogue stand-in (httpx MockTransport).

Both modules are loaded from their files, so these tests do not depend on the
rest of the core package (other unit tests stub parts of it).
"""

from __future__ import annotations

import asyncio
import importlib.util
import sys
from pathlib import Path

import httpx
import pytest

_SRC = Path(__file__).resolve().parents[1] / "src/openg2p_registry_core"


def _load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


mdc = _load("_mdc_under_test", _SRC / "helpers/master_data_client.py")
stubs = _load("_mds_stub_under_test", _SRC / "testing/master_data_stub.py")

LEVELS = [
    {"level_id": "l0", "level_mnemonic": "country", "parent_level_id": None},
    {"level_id": "l1", "level_mnemonic": "region", "parent_level_id": "l0"},
    {"level_id": "l2", "level_mnemonic": "woreda", "parent_level_id": "l1"},
]
UNITS = [
    {"unit_id": "ET", "level_id": "l0", "name": "Ethiopia", "parent_unit_id": None},
    {"unit_id": "ET04", "level_id": "l1", "name": "Oromia", "parent_unit_id": "ET"},
    {"unit_id": "ET0401", "level_id": "l2", "name": "Adaa", "parent_unit_id": "ET04"},
]


def _stub(**kwargs) -> stubs.CatalogueStub:
    stub = stubs.CatalogueStub(**kwargs)
    stub.publish_list("CROP", [{"value_code": "TEFF", "display": "Teff"}, {"value_code": "MAIZE", "display": "Maize"}])
    stub.publish_geography(LEVELS, UNITS)
    return stub


def _client(stub, **config) -> mdc.MasterDataClient:
    settings = {
        "base_url": stubs.BASE_URL,
        "token_url": stubs.TOKEN_URL if stub.require_token else "",
        "client_id": "registry-staff-portal",
        "client_secret": "secret",
        "poll_seconds": 0,
        **config,
    }
    return mdc.MasterDataClient(mdc.MasterDataClientConfig(**settings), transport=stub.transport())


def run(coro):
    return asyncio.run(coro)


def test_list_values_are_cached_by_version():
    stub = _stub()
    client = _client(stub, poll_seconds=3600)

    async def go():
        first = await client.list_values("CROP")
        second = await client.list_values("CROP")
        return first, second

    first, second = run(go())
    assert first.version_no == 1 and first.codes() == {"TEFF", "MAIZE"}
    assert second is first
    # One version resolution, one values read; the second call is served from memory.
    assert stub.calls["/catalogue/get_list"] == 1
    assert stub.calls["/catalogue/get_list_values"] == 1


def test_latest_refreshes_when_the_change_feed_announces_a_new_version():
    stub = _stub()
    client = _client(stub)  # poll_seconds=0: the feed is checked on every read

    async def go():
        before = await client.list_values("CROP")
        unchanged = await client.list_values("CROP")
        stub.publish_list("CROP", [{"value_code": "TEFF", "display": "Teff"}, {"value_code": "SORGHUM"}],
                          retired=["MAIZE"])
        after = await client.list_values("CROP")
        old_again = await client.list_values("CROP", version=1)
        return before, unchanged, after, old_again

    before, unchanged, after, old_again = run(go())
    assert unchanged is before
    assert after.version_no == 2 and after.codes() == {"TEFF", "SORGHUM"}
    # The pinned old version is still served from the cache, unchanged.
    assert old_again is before
    # Only the list whose version changed was resolved again.
    assert stub.calls["/catalogue/get_list"] == 2


def test_first_poll_only_moves_the_cursor_to_the_head():
    stub = _stub()
    client = _client(stub)

    async def go():
        await client.list_values("CROP")
        return client._cursor

    assert run(go()) == len(stub.events)


def test_retired_values_hidden_for_new_data_but_resolvable_for_display():
    stub = _stub()
    stub.retire_values("CROP", ["MAIZE"])
    client = _client(stub)

    async def go():
        active = await client.list_values("CROP")
        with_retired = await client.list_values("CROP", include_retired=True)
        one = await client.get_list_value("CROP", "MAIZE")
        missing = await client.get_list_value("CROP", "RICE")
        return active, with_retired, one, missing

    active, with_retired, one, missing = run(go())
    assert active.codes() == {"TEFF"}
    assert with_retired.labels()["MAIZE"] == "Maize"
    assert one["status"] == "RETIRED"
    assert missing is None


def test_stale_on_error_serves_the_last_good_data():
    stub = _stub()
    client = _client(stub, latest_max_age_seconds=0)

    async def go():
        good = await client.list_values("CROP")
        chain = await client.geo_unit("ET0401")
        stub.publish_list("CROP", [{"value_code": "TEFF"}])
        await client.poll_changes()  # the feed says CROP changed ...
        stub.down = True  # ... and MDS goes away before the new version is read
        stale = await client.list_values("CROP")
        stale_chain = await client.geo_unit("ET0401")
        with pytest.raises(mdc.MasterDataUnavailable):
            await client.list_values("SEASON")  # never read: nothing to fall back on
        stub.down = False
        fresh = await client.list_values("CROP")
        return good, stale, chain, stale_chain, fresh

    good, stale, chain, stale_chain, fresh = run(go())
    assert stale is good
    assert stale_chain is chain
    assert fresh.version_no == 2
    assert client.stats["stale_served"] >= 1


def test_token_is_cached_and_refreshed_before_expiry_and_on_401():
    stub = _stub(token_lifetime=300)
    client = _client(stub, poll_seconds=3600)

    async def go():
        await client.list_values("CROP")
        await client.geo_unit("ET0401")
        tokens_after_warm_up = stub.calls[stubs.TOKEN_PATH]
        # The token expires (as far as the client knows): a new one is fetched.
        client._token_expires_at = 0
        await client.geo_unit("ET04")
        tokens_after_expiry = stub.calls[stubs.TOKEN_PATH]
        # MDS revokes it early: a 401 makes the client fetch a new token and retry once.
        stub._tokens.clear()
        await client.geo_unit("ET")
        return tokens_after_warm_up, tokens_after_expiry, stub.calls[stubs.TOKEN_PATH]

    warm, expired, revoked = run(go())
    assert warm == 1
    assert expired == 2
    assert revoked == 3


def test_short_token_lifetime_still_refreshes_early():
    stub = _stub(token_lifetime=20)
    client = _client(stub)

    async def go():
        await client.list_values("CROP")
        return client._token_expires_at

    import time

    expires_at = run(go())
    assert expires_at - time.monotonic() < 20


def test_pagination_reads_every_page():
    stub = stubs.CatalogueStub()
    stub.publish_list("BIG", [{"value_code": f"V{i:04d}"} for i in range(2500)])
    stub.set_samples([{"individual_id": f"P{i:03d}", "age": 30} for i in range(7)])
    client = _client(stub, page_size=1000)
    small = _client(stub, page_size=3)

    async def go():
        return await client.list_values("BIG"), await small.sample_individuals()

    snapshot, people = run(go())
    assert len(snapshot.values) == 2500
    assert stub.calls["/catalogue/get_list_values"] == 3
    assert [p["individual_id"] for p in people] == [f"P{i:03d}" for i in range(7)]
    assert stub.calls["/samples/get_individuals"] == 3


def test_geo_unit_with_ancestors_and_levels():
    stub = _stub()
    client = _client(stub)

    async def go():
        chain = await client.geo_unit("ET0401")
        unknown = await client.geo_unit("XX")
        unknown_again = await client.geo_unit("XX")
        return chain, unknown, unknown_again

    chain, unknown, unknown_again = run(go())
    assert [(u.level_mnemonic, u.unit_id, u.name) for u in chain.units] == [
        ("country", "ET", "Ethiopia"),
        ("region", "ET04", "Oromia"),
        ("woreda", "ET0401", "Adaa"),
    ]
    assert chain.version_no == 1 and chain.active
    assert unknown is None and unknown_again is None
    assert stub.calls["/catalogue/get_geo_unit"] == 2  # the miss is cached too


def test_geography_refreshes_on_a_new_version_and_old_versions_stay():
    stub = _stub()
    client = _client(stub)

    async def go():
        before = await client.geo_unit("ET0401")
        units = [dict(u) for u in UNITS]
        units[2]["status"] = "RETIRED"
        units.append({"unit_id": "ET0402", "level_id": "l2", "name": "Adaa North", "parent_unit_id": "ET04"})
        stub.publish_geography(LEVELS, units)
        after = await client.geo_unit("ET0401")
        return before, after, await client.geo_version()

    before, after, version = run(go())
    assert before.version_no == 1 and before.active
    assert after.version_no == 2 and not after.active  # retired in v2, still resolvable
    assert version == 2


def test_release_pin_reads_the_pinned_versions():
    stub = _stub()
    stub.publish_list("CROP", [{"value_code": "TEFF"}])  # v2
    stub.publish_list("SEASON", [{"value_code": "MEHER"}])
    stub.publish_release("2027.1", {"CROP": 1}, geo_version_no=1)
    client = _client(stub, release="2027.1")

    async def go():
        crop = await client.list_values("CROP")
        season = await client.list_values("SEASON")  # not pinned: latest, logged once
        return crop, season, await client.geo_version()

    crop, season, geo = run(go())
    assert crop.version_no == 1 and crop.codes() == {"TEFF", "MAIZE"}
    assert season.version_no == 1
    assert geo == 1


def test_list_codes_of_every_published_list_by_list_id():
    stub = _stub()
    stub.publish_list("GENDER", [{"value_code": "M"}, {"value_code": "F"}], list_id="attr-gender")
    client = _client(stub)

    codes, versions = run(client.all_list_codes())
    assert codes == {"CROP": {"TEFF", "MAIZE"}, "attr-gender": {"M", "F"}}
    assert versions == {"CROP": 1, "attr-gender": 1}


def test_envelope_errors_map_to_exceptions():
    stub = _stub()
    client = _client(stub)

    async def go():
        with pytest.raises(mdc.MasterDataNotFound):
            await client.list_values("NOPE")
        assert await client.get_release("none") is None

    run(go())


def test_bad_client_secret_is_an_error_not_an_outage():
    stub = _stub()
    client = _client(stub, client_secret="wrong")

    with pytest.raises(mdc.MasterDataError) as error:
        run(client.list_values("CROP"))
    assert not isinstance(error.value, mdc.MasterDataUnavailable)


def test_one_client_serves_several_event_loops():
    stub = _stub()
    client = _client(stub, poll_seconds=3600)

    # Each asyncio.run is a new loop, as in Celery tasks; the pooled HTTP client
    # of a closed loop is replaced, the caches carry over.
    first = run(client.list_values("CROP"))
    second = run(client.list_values("CROP"))
    chain = run(client.geo_unit("ET0401"))
    assert second is first and chain is not None
    assert stub.calls["/catalogue/get_list_values"] == 1


def test_read_mode_defaults_to_api():
    from types import SimpleNamespace

    assert mdc.master_data_read_mode(SimpleNamespace()) == "api"
    assert mdc.master_data_read_mode(SimpleNamespace(master_data_read_mode="DB")) == "db"
    assert mdc.master_data_read_mode(SimpleNamespace(master_data_read_mode="anything")) == "api"


def test_lru_bound():
    lru = mdc._Lru(2)
    lru.put("a", 1)
    lru.put("b", 2)
    lru.get("a")
    lru.put("c", 3)
    assert "a" in lru and "c" in lru and "b" not in lru and len(lru) == 2


def test_unauthenticated_stand_in_needs_no_token_endpoint():
    stub = _stub(require_token=False)
    client = _client(stub)
    snapshot = run(client.list_values("CROP"))
    assert snapshot.codes() == {"TEFF", "MAIZE"}
    assert stub.calls[stubs.TOKEN_PATH] == 0


def test_transport_errors_are_unavailable():
    def boom(request):
        raise httpx.ReadTimeout("slow", request=request)

    client = mdc.MasterDataClient(
        mdc.MasterDataClientConfig(base_url="http://mds"), transport=httpx.MockTransport(boom)
    )
    with pytest.raises(mdc.MasterDataUnavailable):
        run(client.list_values("CROP"))


def test_call_from_a_thread_while_the_home_loop_runs():
    # The sync geo-hierarchy path runs a coroutine on its own loop in a worker
    # thread while the request's loop is busy; it gets a short-lived HTTP client.
    import concurrent.futures

    stub = _stub()
    client = _client(stub, poll_seconds=3600)

    async def go():
        await client.list_values("CROP")  # binds the pooled client to this loop
        with concurrent.futures.ThreadPoolExecutor() as pool:
            return pool.submit(asyncio.run, client.geo_unit("ET0401")).result(timeout=10)

    chain = run(go())
    assert chain is not None and chain.unit.unit_id == "ET0401"
