"""Outbox, reconciliation, indicators and ODK ingestion."""

import json
from datetime import datetime, timedelta

import pytest
from sqlalchemy import text

from openg2p_registry_core.helpers.ethiopian_calendar import format_ethiopian_date
from openg2p_registry_core.services import (
    G2PActivityIndicatorService,
    G2PActivityOdkService,
    G2PActivityOutboxService,
)
from openg2p_registry_core.services.g2p_activity_odk_service import transform

from .conftest import REGISTER_ID
from .test_activity_service import REG, planned, sown

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def test_outbox_processes_and_is_idempotent(service, activity_types, database):
    await service.append(planned(), "da1", "STAFF_PORTAL")
    await service.append(sown(), "da1", "STAFF_PORTAL")
    outbox = G2PActivityOutboxService()
    assert await outbox.process_batch() == 2
    assert await outbox.process_batch() == 0
    health = await outbox.backlog()
    assert health["counts"].get("PROCESSED") == 2 and health["oldest_pending_seconds"] == 0


async def test_reconcile_repairs_projection_drift(service, activity_types, database):
    await service.append(planned(), "da1", "STAFF_PORTAL")
    await service.append(sown(area=2), "da1", "STAFF_PORTAL")
    async with database.begin() as conn:
        await conn.execute(text("UPDATE g2p_activity_projection_field_works SET activity_count = 9, stage = 'X'"))
        await conn.execute(
            text("INSERT INTO g2p_activity_projection_field_works (context_id, activity_count, projected_at) "
                 "VALUES ('ghost', 1, now())")
        )
    fixed = await G2PActivityOutboxService().reconcile()
    assert fixed == {"FieldWork": 2}
    async with database.connect() as conn:
        rows = (await conn.execute(text("SELECT context_id, stage, activity_count FROM g2p_activity_projection_field_works"))).all()
    assert len(rows) == 1 and rows[0].stage == "SOWN" and rows[0].activity_count == 2


async def test_indicators(service, activity_types, database):
    await service.append(planned(), "da1", "STAFF_PORTAL")
    await service.append(sown(area=1.5), "da1", "STAFF_PORTAL")
    await service.append(planned(plot="LND-2", season="BELG"), "da1", "STAFF_PORTAL")
    await service.append(sown(plot="LND-2", season="BELG", area=0.5), "da1", "STAFF_PORTAL")
    await service.append(planned(plot="LND-3"), "da1", "STAFF_PORTAL")
    async with database.begin() as conn:
        await conn.execute(
            text("INSERT INTO g2p_activity_indicators (indicator_id, register_id, indicator_code, display_name, "
                 "unit, definition, is_active) VALUES "
                 "('i1', :r, 'SOWN_AREA', 'Sown area', 'ha', CAST(:d1 AS JSONB), true),"
                 "('i2', :r, 'BAD', 'Bad', NULL, CAST(:d2 AS JSONB), true)"),
            {"r": REGISTER_ID,
             "d1": json.dumps({"measure": {"fn": "sum", "field": "area_sown_ha"}, "group_by": ["season"]}),
             "d2": json.dumps({"measure": {"fn": "sum", "field": "area_sown_ha; drop table x"}})},
        )
    indicators = G2PActivityIndicatorService()
    result = await indicators.compute(REG, "SOWN_AREA")
    assert result.rows == [{"season": "BELG", "value": 0.5}, {"season": "MEHER", "value": 1.5}]
    filtered = await indicators.compute(REG, "SOWN_AREA", {"season": "MEHER"})
    assert filtered.rows == [{"season": "MEHER", "value": 1.5}]
    with pytest.raises(Exception) as info:
        await indicators.compute(REG, "BAD")
    assert info.value.code == "ACT-ERR-018"
    assert [i.indicator_code for i in await indicators.list_indicators(REG)] == ["BAD", "SOWN_AREA"]


class FakeOdk:
    def __init__(self, pages):
        self.pages = pages
        self.calls = []

    async def submissions_since(self, project_id, form_id, since, top):
        self.calls.append(since)
        return self.pages.pop(0) if self.pages else []

    async def attachment(self, *args):
        raise AssertionError("not used")


def _submission(instance, plot, crop, area, day, reviewed=None):
    return {
        "__id": instance,
        "__system": {"submissionDate": f"2026-09-{day:02d}T10:00:00.000Z", "submitterName": "da-odk",
                     "reviewState": reviewed},
        "person": {"person_id": "P-9"},
        "plot": {"plot_id": plot, "location": {"type": "Point", "coordinates": [38.7, 9.0, 2300]}},
        "sowing": {"crop": crop, "area": area,
                   "date_ec": format_ethiopian_date((datetime.utcnow() - timedelta(days=3)).date())},
        "season": "MEHER",
    }


async def test_odk_pull_maps_dedups_and_records_failures(service, activity_types, database):
    mapping = {
        "activity_type": {"value": "SOWN"},
        "subject_type": {"value": "PERSON_ID"},
        "subject_id": "person/person_id",
        "occurred_on_ec": "sowing/date_ec",
        "payload": {
            "plot_id": "plot/plot_id",
            "season": "season",
            "crop": {"path": "sowing/crop", "transform": "upper"},
            "area_ha": {"path": "sowing/area", "transform": "number"},
        },
    }
    async with database.begin() as conn:
        await conn.execute(
            text("INSERT INTO g2p_activity_odk_forms (odk_form_config_id, register_id, odk_project_id, odk_form_id, "
                 "mapping, is_active, submissions_pulled, submissions_failed) "
                 "VALUES ('cfg1', :r, 3, 'crop_sowing', CAST(:m AS JSONB), true, 0, 0)"),
            {"r": REGISTER_ID, "m": json.dumps(mapping)},
        )
    first = [_submission("uuid:1", "LND-1", "teff", "1.2", 20),
             _submission("uuid:2", "LND-2", "coffee", "1", 21),  # unknown crop → failure
             _submission("uuid:3", "LND-3", "maize", "0.4", 22, reviewed="rejected")]
    fake = FakeOdk([first, [_submission("uuid:1", "LND-1", "teff", "1.2", 20)]])
    odk = G2PActivityOdkService(client=fake)
    odk.activities = service

    result = await odk.pull_form("cfg1")
    assert result == {"created": 1, "duplicates": 0, "failed": 1}
    assert fake.calls == [None]

    async with database.connect() as conn:
        cfg = (await conn.execute(text("SELECT last_submission_date, submissions_failed FROM g2p_activity_odk_forms"))).one()
        failure = (await conn.execute(text("SELECT instance_id, error_code, resolved FROM g2p_activity_odk_failures"))).one()
        activity = (await conn.execute(text("SELECT crop, area_ha, recorded_by, channel, idempotency_key "
                                            "FROM g2p_activity_field_works"))).one()
    assert cfg.last_submission_date == "2026-09-22T10:00:00.000Z" and cfg.submissions_failed == 1
    assert (failure.instance_id, failure.error_code, failure.resolved) == ("uuid:2", "ACT-ERR-005", False)
    assert (activity.crop, float(activity.area_ha), activity.recorded_by, activity.channel) == (
        "TEFF", 1.2, "da-odk", "ODK")
    assert activity.idempotency_key == "odk:crop_sowing:uuid:1"

    # Re-reading an already ingested submission is a no-op.
    fake.pages = [[_submission("uuid:1", "LND-1", "teff", "1.2", 20)]]
    assert (await odk.pull_form("cfg1"))["duplicates"] == 1


def test_transforms():
    assert transform({"type": "Point", "coordinates": [38.7, 9.01, 2300]}, "geopoint_lat") == "9.01"
    assert transform("9.01 38.7 2300 5", "geopoint_lon") == "38.7"
    assert transform("urea dap", "split") == ["urea", "dap"]
    assert transform("yes", "boolean") is True
    assert transform("2.5", "number") == 2.5
