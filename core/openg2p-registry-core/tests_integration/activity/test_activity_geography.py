"""Geo dimensions: where an activity happened, as named levels, and roll-ups by level."""

from sqlalchemy import text

import pytest

from openg2p_registry_core.schemas.activity import SearchAggregatesPayload
from openg2p_registry_core.services import (
    G2PActivityIndicatorService,
    G2PActivityOutboxService,
    common_dimensions,
)

from .conftest import REGISTER_ID
from .test_activity_service import REG, harvested, planned, sown
from .test_activity_subjects_and_rollups import _add_visit_type, visit

pytestmark = pytest.mark.asyncio(loop_scope="session")

LAKE = {
    "country": {"code": "XK", "name": "Kamuntu"},
    "region": {"code": "R1", "name": "Alpha"},
    "zone": {"code": "Z1", "name": "North"},
    "woreda": {"code": "W1", "name": "Lake"},
}


async def test_location_from_the_payload_named_by_level(service, activity_types):
    data, _ = await service.append(sown(payload={"woreda": "W1"}), "da1", "STAFF_PORTAL")
    assert data.geo_dimensions == LAKE


async def test_later_activities_take_their_contexts_location(service, activity_types, database):
    await service.append(planned(), "da1", "STAFF_PORTAL")  # no location yet
    await service.append(sown(payload={"woreda": "W1"}, days=100), "da1", "STAFF_PORTAL")
    harvest, _ = await service.append(harvested(), "da1", "STAFF_PORTAL")
    assert harvest.geo_dimensions == LAKE
    async with database.connect() as conn:
        geo = (await conn.execute(text("SELECT geo_dimensions FROM g2p_activity_projection_field_works"))).scalar()
    assert geo == LAKE


async def test_location_from_the_subject_record_or_its_parent(service, activity_types, database):
    await _add_visit_type(database)
    # parcel-2 is in Plain (Z2); parcel-1 has no location, so it takes its person's (Hill, Z1).
    own, _ = await service.append(visit(parcel="parcel-2", person="P-2"), "da1", "STAFF_PORTAL")
    parents, _ = await service.append(visit(parcel="parcel-1", person="P-1"), "da1", "STAFF_PORTAL")
    assert own.geo_dimensions["woreda"] == {"code": "W3", "name": "Plain"}
    assert own.geo_dimensions["zone"] == {"code": "Z2", "name": "South"}
    assert parents.geo_dimensions["woreda"] == {"code": "W2", "name": "Hill"}


async def test_indicators_group_and_filter_by_level(service, activity_types, database):
    for plot, woreda, area in (("LND-1", "W1", 1.0), ("LND-2", "W2", 2.0), ("LND-3", "W3", 4.0)):
        await service.append(sown(plot=plot, area=area, payload={"woreda": woreda}), "da1", "STAFF_PORTAL")
    async with database.begin() as conn:
        await conn.execute(
            text("INSERT INTO g2p_activity_indicators (indicator_id, register_id, indicator_code, display_name, "
                 "unit, definition, is_active) VALUES "
                 "('g1', :r, 'AREA_BY_ZONE', 'Area by zone', 'ha', CAST(:d1 AS JSONB), true),"
                 "('g2', :r, 'AREA_BY_WOREDA_NORTH', 'Area by woreda', 'ha', CAST(:d2 AS JSONB), true),"
                 "('g3', :r, 'AREA_BY_BAD_LEVEL', 'Bad', 'ha', CAST(:d3 AS JSONB), true)"),
            {"r": REGISTER_ID,
             "d1": '{"measure": {"fn": "sum", "field": "area_sown_ha"}, "group_by": ["geo:zone"]}',
             "d2": '{"measure": {"fn": "sum", "field": "area_sown_ha"}, "group_by": ["geo:woreda"], '
                   '"filters": {"geo:zone": "Z1"}}',
             "d3": '{"measure": {"fn": "sum", "field": "area_sown_ha"}, "group_by": ["geo:zone; drop"]}'},
        )
    indicators = G2PActivityIndicatorService()
    by_zone = await indicators.compute(REG, "AREA_BY_ZONE")
    assert by_zone.group_by == ["geo:zone", "geo:zone_name"]
    assert by_zone.rows == [
        {"geo:zone": "Z1", "geo:zone_name": "North", "value": 3.0},
        {"geo:zone": "Z2", "geo:zone_name": "South", "value": 4.0},
    ]
    north = await indicators.compute(REG, "AREA_BY_WOREDA_NORTH")
    assert [(r["geo:woreda_name"], r["value"]) for r in north.rows] == [("Lake", 1.0), ("Hill", 2.0)]
    with pytest.raises(Exception):
        await indicators.compute(REG, "AREA_BY_BAD_LEVEL")


async def test_aggregates_carry_the_activitys_levels(service, activity_types):
    await service.append(sown(payload={"woreda": "W1"}), "da1", "STAFF_PORTAL")
    await G2PActivityOutboxService().process_batch()
    [aggregate] = await service.search_aggregates(SearchAggregatesPayload(register_mnemonic=REG, subject_id="P-1"))
    assert aggregate.geo_dimensions == LAKE


async def test_common_dimensions_keeps_only_shared_levels():
    hill = {**LAKE, "woreda": {"code": "W2", "name": "Hill"}}
    assert common_dimensions([LAKE, hill]) == {k: LAKE[k] for k in ("country", "region", "zone")}
    assert common_dimensions([LAKE, None, LAKE]) == LAKE
    assert common_dimensions([None]) is None
