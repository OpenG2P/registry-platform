"""The seed scripts' Master Data client, against the platform's catalogue stand-in.

Run with the core package installed (it provides the stub and httpx):

    python -m pytest docker/db-seed/tests
"""

import os
import sys

import httpx
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import mds_client  # noqa: E402
from mds_client import MdsClient, MdsError, MdsNotFound, order_levels  # noqa: E402
from openg2p_registry_core.testing.master_data_stub import BASE_URL, TOKEN_URL, CatalogueStub  # noqa: E402

LEVELS = [
    {"level_id": "l2", "level_mnemonic": "zone", "parent_level_id": "l1"},
    {"level_id": "l0", "level_mnemonic": "country", "parent_level_id": None},
    {"level_id": "l3", "level_mnemonic": "woreda", "parent_level_id": "l2"},
    {"level_id": "l1", "level_mnemonic": "region", "parent_level_id": "l0"},
]
UNITS = [
    {"unit_id": "ET", "level_id": "l0", "name": "Ethiopia", "parent_unit_id": None},
    {"unit_id": "ET04", "level_id": "l1", "name": "Oromia", "parent_unit_id": "ET"},
    {"unit_id": "ET0412", "level_id": "l2", "name": "East Shewa", "parent_unit_id": "ET04"},
    {"unit_id": "ET041203", "level_id": "l3", "name": "Adaa", "parent_unit_id": "ET0412"},
    {"unit_id": "ET041204", "level_id": "l3", "name": "Lume", "parent_unit_id": "ET0412"},
]


def stub_transport(stub: CatalogueStub):
    """mds_client's (method, url, headers, body) -> (status, body) over the stub."""
    seen = []

    def send(method, url, headers, body):
        seen.append((url, headers.get("Authorization")))
        response = stub._handle(httpx.Request(method, url, headers=headers, content=body or b""))
        return response.status_code, response.content

    send.seen = seen
    return send


@pytest.fixture
def stub():
    s = CatalogueStub()
    s.publish_geography(LEVELS, UNITS)
    s.set_samples(
        [{"individual_id": f"P{i:03}", "household_id": f"H{i // 2:03}", "geo_pcode": "ET041203"} for i in range(7)],
        [{"household_id": f"H{i:03}", "geo_pcode": "ET041203"} for i in range(4)],
    )
    return s


def make_client(stub, **kw):
    transport = stub_transport(stub)
    client = MdsClient(BASE_URL, token_url=TOKEN_URL, client_id="registry-staff-portal",
                       client_secret="secret", page_size=3, transport=transport, **kw)
    return client, transport


def test_levels_are_ordered_top_down(stub):
    client, _ = make_client(stub)
    assert [lv["level_mnemonic"] for lv in client.geo_levels()] == ["country", "region", "zone", "woreda"]


def test_token_is_fetched_once_and_sent(stub):
    client, transport = make_client(stub)
    client.geo_levels()
    client.geo_chain("ET041203")
    calls = [url for url, _ in transport.seen]
    assert calls.count(TOKEN_URL) == 1
    assert all(auth and auth.startswith("Bearer ") for url, auth in transport.seen if url != TOKEN_URL)


def test_without_token_the_stub_refuses(stub):
    client = MdsClient(BASE_URL, transport=stub_transport(stub))
    with pytest.raises(MdsError):
        client.geo_levels()


def test_chain_and_hierarchy_json(stub):
    client, _ = make_client(stub)
    chain = client.geo_chain("ET041203")
    assert [u["unit_id"] for u in chain] == ["ET", "ET04", "ET0412", "ET041203"]
    assert chain[-1]["level_mnemonic"] == "woreda"
    assert client.geo_hierarchy_json("ET041203") == {"hierarchy": [
        {"level_mnemonic": "country", "level_value_mnemonic": "Ethiopia", "level_value_id": "ET"},
        {"level_mnemonic": "region", "level_value_mnemonic": "Oromia", "level_value_id": "ET04"},
        {"level_mnemonic": "zone", "level_value_mnemonic": "East Shewa", "level_value_id": "ET0412"},
        {"level_mnemonic": "woreda", "level_value_mnemonic": "Adaa", "level_value_id": "ET041203"},
    ]}
    assert client.geo_chain("NOPE") is None


def test_units_are_paged(stub):
    client, _ = make_client(stub)
    assert len(client.all_geo_units()) == 5  # two pages of 3
    assert [u["unit_id"] for u in client.geo_units(level="woreda")] == ["ET041203", "ET041204"]
    assert [u["unit_id"] for u in client.geo_units(parent_unit_id="ET0412")] == ["ET041203", "ET041204"]


def test_samples_are_paged(stub):
    client, _ = make_client(stub)
    assert len(client.sample_individuals()) == 7
    assert [p["individual_id"] for p in client.sample_individuals(household_id="H001")] == ["P002", "P003"]
    assert len(client.sample_households()) == 4


def test_list_values(stub):
    stub.publish_list("CROP", [{"value_code": "TEFF", "display": "Teff"}, {"value_code": "MAIZE", "display": "Maize"}])
    client, _ = make_client(stub)
    assert {v["value_code"] for v in client.list_values("CROP")} == {"TEFF", "MAIZE"}
    assert client.list_values("NOPE") == []


def test_no_geography_and_wait(monkeypatch):
    empty = CatalogueStub()
    client, _ = make_client(empty)
    assert client.geo_levels() == []
    monkeypatch.setattr(mds_client.time, "sleep", lambda _s: empty.publish_geography(LEVELS, UNITS))
    levels = client.wait_for_geography(timeout=60, interval=0, log=lambda _m: None)
    assert levels[-1]["level_mnemonic"] == "woreda"


def test_wait_times_out():
    client, _ = make_client(CatalogueStub())
    with pytest.raises(MdsError):
        client.wait_for_geography(timeout=0, interval=0, log=lambda _m: None)


def test_not_found_and_errors_map(stub):
    client, _ = make_client(stub)
    with pytest.raises(MdsNotFound):
        client.post("/catalogue/get_list", {"list_code": "NOPE"})


def test_from_env(monkeypatch):
    monkeypatch.delenv("MDS_API_URL", raising=False)
    assert MdsClient.from_env() is None
    with pytest.raises(MdsError):
        MdsClient.from_env(required=True)
    monkeypatch.setenv("MDS_API_URL", "http://mds.test/")
    monkeypatch.setenv("MDS_TOKEN_URL", TOKEN_URL)
    monkeypatch.setenv("MDS_CLIENT_ID", "c")
    monkeypatch.setenv("MDS_CLIENT_SECRET", "s")
    client = MdsClient.from_env()
    assert client.base_url == "http://mds.test" and client.token_url == TOKEN_URL and client.client_id == "c"


def test_order_levels_with_unknown_root_parent():
    levels = [{"level_id": "b", "parent_level_id": "a"}, {"level_id": "a", "parent_level_id": "zz"}]
    assert [lv["level_id"] for lv in order_levels(levels)] == ["a", "b"]


def test_reporting_views_read_levels_through_the_client(stub, monkeypatch):
    import generate_reporting_views as grv

    client, _ = make_client(stub)
    monkeypatch.setattr(MdsClient, "from_env", classmethod(lambda cls, required=False: client))
    assert grv.mds_geo_levels(lambda _m: None) == ["country", "region", "zone", "woreda"]
    monkeypatch.setattr(MdsClient, "from_env", classmethod(lambda cls, required=False: None))
    assert grv.mds_geo_levels(lambda _m: None) == []


def test_cli_wait_geo(stub, monkeypatch, capsys):
    client, _ = make_client(stub)
    monkeypatch.setattr(MdsClient, "from_env", classmethod(lambda cls, required=False: client))
    assert mds_client.main(["wait-geo", "--timeout", "1"]) == 0
    assert "country > region > zone > woreda" in capsys.readouterr().out
    assert mds_client.main([]) == 2
