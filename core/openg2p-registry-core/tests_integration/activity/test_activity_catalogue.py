"""Reading Master Data through its catalogue API: versions recorded on activities, retired
codes, new geography versions, and parity with the direct database reads.

The api-mode tests use their own stand-in (so publishing to it does not leak into
other tests) and are skipped when the run reads Master Data from its database.
"""

import pytest
from sqlalchemy import text

from openg2p_registry_core.errors import G2PRegistryException
from openg2p_registry_core.services import G2PGeoHierarchyService

from .conftest import GEO_LEVELS, GEO_VALUES, READ_MODE, use_master_data
from .test_activity_service import REG, sown

pytestmark = pytest.mark.asyncio(loop_scope="session")

api_only = pytest.mark.skipif(READ_MODE != "api", reason="reads Master Data through the catalogue API")


@pytest.fixture
def catalogue(database):
    stub = use_master_data("api")
    yield stub
    use_master_data(READ_MODE)


@api_only
async def test_activity_records_the_catalogue_versions_it_was_checked_against(service, activity_types, catalogue):
    data, _ = await service.append(sown(payload={"woreda": "W1"}), "da1", "STAFF_PORTAL")
    assert data.catalogue_versions == {"lists": {"CROP": 1}, "geo": 1}
    # A new list version is noticed through the change feed and recorded on the next activity.
    catalogue.publish_list("CROP", [{"value_code": "TEFF", "display": "Teff"},
                                    {"value_code": "MAIZE", "display": "Maize"},
                                    {"value_code": "SORGHUM", "display": "Sorghum"}], list_id="attr-crop")
    later, _ = await service.append(sown(plot="LND-2", crop="SORGHUM", payload={"woreda": "W1"}), "da1",
                                    "STAFF_PORTAL")
    assert later.catalogue_versions == {"lists": {"CROP": 2}, "geo": 1}
    assert later.display["crop"] == "Sorghum"
    # Stored on the row, and returned when read back.
    again = await service.get(REG, data.activity_id)
    assert again.catalogue_versions == {"lists": {"CROP": 1}, "geo": 1}


@api_only
async def test_retired_code_is_rejected_for_new_data_but_still_shown(service, activity_types, catalogue):
    old, _ = await service.append(sown(crop="MAIZE"), "da1", "STAFF_PORTAL")
    assert old.display["crop"] == "Maize"

    catalogue.retire_values("CROP", ["MAIZE"])
    with pytest.raises(G2PRegistryException) as info:
        await service.append(sown(plot="LND-9", crop="MAIZE"), "da1", "STAFF_PORTAL")
    assert info.value.code == "ACT-ERR-005" and "'MAIZE' is not a known code" in info.value.message

    # The existing activity, recorded against version 1, still shows its label.
    again = await service.get(REG, old.activity_id)
    assert again.payload["crop"] == "MAIZE" and again.display["crop"] == "Maize"


@api_only
async def test_new_geography_version(service, activity_types, catalogue):
    before, _ = await service.append(sown(payload={"woreda": "W1"}), "da1", "STAFF_PORTAL")
    values = [dict(v) for v in GEO_VALUES] + [
        {"level_value_id": "W4", "level_id": "l3", "level_value_mnemonic": "Valley", "parent_level_value_id": "Z2"}
    ]
    for value in values:
        if value["level_value_id"] == "W1":
            value["status"] = "RETIRED"
    catalogue.publish_geography(GEO_LEVELS, values)

    after, _ = await service.append(sown(plot="LND-4", payload={"woreda": "W4"}), "da1", "STAFF_PORTAL")
    assert after.geo_dimensions["woreda"] == {"code": "W4", "name": "Valley"}
    assert after.catalogue_versions["geo"] == 2
    # W1 is retired in version 2: no location for new data ...
    retired, _ = await service.append(sown(plot="LND-5", payload={"woreda": "W1"}), "da1", "STAFF_PORTAL")
    assert retired.geo_dimensions is None
    # ... while the earlier activity keeps its snapshot and the version it was read at.
    again = await service.get(REG, before.activity_id)
    assert again.geo_dimensions["woreda"] == {"code": "W1", "name": "Lake"}
    assert again.catalogue_versions["geo"] == 1


@api_only
async def test_master_data_outage_serves_the_last_good_data(service, activity_types, catalogue):
    first, _ = await service.append(sown(payload={"woreda": "W1"}), "da1", "STAFF_PORTAL")
    catalogue.down = True
    try:
        second, _ = await service.append(sown(plot="LND-2", payload={"woreda": "W1"}), "da1", "STAFF_PORTAL")
    finally:
        catalogue.down = False
    assert second.display["crop"] == "Teff"
    assert second.geo_dimensions == first.geo_dimensions
    assert second.catalogue_versions == first.catalogue_versions


@api_only
async def test_reads_use_a_service_token(service, activity_types, catalogue):
    await service.append(sown(), "da1", "STAFF_PORTAL")
    token_path = "/realms/staff/protocol/openid-connect/token"
    assert catalogue.calls[token_path] == 1
    assert catalogue.calls["/catalogue/get_list_values"] >= 1


async def test_geo_hierarchy_is_the_same_from_the_api_and_the_database(database, catalogue):
    """The register records' geo_code_hierarchy_json: same shape and content in both modes."""
    for unit in ("W1", "Z2", "XK"):
        from_api = await G2PGeoHierarchyService._hierarchy_from_api(unit)
        from_db = await G2PGeoHierarchyService._hierarchy_from_db(unit)
        assert from_api == from_db
    assert from_api == {"hierarchy": [{"level_mnemonic": "country", "level_value_mnemonic": "Kamuntu",
                                       "level_value_id": "XK"}]}
    assert await G2PGeoHierarchyService._hierarchy_from_api("NOPE") is None
    assert await G2PGeoHierarchyService._hierarchy_from_db("NOPE") is None


async def test_db_mode_records_no_versions(service, activity_types, database):
    use_master_data("db")
    try:
        data, _ = await service.append(sown(payload={"woreda": "W1"}), "da1", "STAFF_PORTAL")
    finally:
        use_master_data(READ_MODE)
    assert data.catalogue_versions is None
    assert data.display == {"crop": "Teff", "woreda": "Lake"} and data.geo_dimensions["woreda"]["code"] == "W1"
    async with database.connect() as conn:
        stored = (await conn.execute(text("SELECT catalogue_versions FROM g2p_activity_field_works"))).scalar()
    assert stored is None
