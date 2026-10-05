"""Features aligned with the Observations design: schema versions, submissions,
local-record subjects (the profile tab), form defaults, enrichment and aggregates."""

import json
from datetime import datetime, timedelta

import pytest
from sqlalchemy import text

from openg2p_registry_core.errors import G2PRegistryException
from openg2p_registry_core.schemas.activity import (
    ActivityInput,
    ActivityTypeSchemaPayload,
    AggregateHistoryPayload,
    LatestActivityPayload,
    SearchAggregatesPayload,
    SubjectActivitiesPayload,
)
from openg2p_registry_core.services import G2PActivityOutboxService, G2PActivityPartitionService
from openg2p_registry_core.services.g2p_register_service import G2PRegisterService

from .conftest import REGISTER_ID, G2PActivityFieldWork
from .test_activity_service import REG, _code, planned, sown

pytestmark = pytest.mark.asyncio(loop_scope="session")

VISIT_RULES = {
    # The parcel is a record of this registry, the activity's subject, and must be the person's.
    "parcel_ref": {"kind": "LOCAL_RECORD", "register": "TestParcel", "match": "internal_record_id",
                 "mode": "STRICT", "subject": True, "belongs_to": "person_ref"},
    "person_ref": {"kind": "LOCAL_RECORD", "register": "TestPerson", "match": "functional_record_id",
                   "mode": "STRICT"},
}


async def _add_visit_type(database):
    async with database.begin() as conn:
        await conn.execute(
            text(
                "INSERT INTO g2p_activity_types (activity_type_id, register_id, activity_type, display_name, "
                "requires_context, is_repeatable, sequence_enforcement, allow_future_dated, requires_verification, "
                "reference_rules, is_active) VALUES "
                "('t-visit', :r, 'VISIT', 'Visit', false, true, 'WARN', false, false, CAST(:rules AS JSONB), true)"
            ),
            {"r": REGISTER_ID, "rules": json.dumps(VISIT_RULES)},
        )


def visit(parcel="parcel-1", person="P-1", days=3, **extra):
    return ActivityInput(
        register_mnemonic=REG, activity_type="VISIT",
        occurred_at=(datetime.utcnow() - timedelta(days=days)).replace(microsecond=0),
        payload={"parcel_ref": parcel, "person_ref": person, **extra},
    )


async def test_schema_version_is_stamped_and_bumped_on_schema_change(service, activity_types, database):
    first, _ = await service.append(sown(), "da1", "STAFF_PORTAL")
    assert first.schema_version == 1

    schema = {"type": "object", "properties": {"crop": {"type": "string"}}}
    async with database.begin() as conn:
        # Re-seeding the same schema is not a change; a different one is.
        await conn.execute(text("UPDATE g2p_activity_types SET display_name = 'Sown!' WHERE activity_type_id = 't-sown'"))
        await conn.execute(
            text("UPDATE g2p_activity_types SET payload_schema = CAST(:s AS JSONB) WHERE activity_type_id = 't-sown'"),
            {"s": json.dumps(schema)},
        )
    service.registry._domain_services.clear()
    second, _ = await service.append(sown(plot="LND-9", crop="MAIZE"), "da1", "STAFF_PORTAL")
    assert second.schema_version == 2

    versions = await service.activity_type_schemas(ActivityTypeSchemaPayload(register_mnemonic=REG, activity_type="SOWN"))
    assert [v.schema_version for v in versions] == [2, 1]
    assert versions[0].payload_schema == schema


async def test_batch_gets_one_submission_id(service, activity_types):
    results = await service.append_many([planned(), planned(plot="LND-2")], "da1", "STAFF_PORTAL")
    ids = {r.activity.submission_id for r in results}
    assert len(ids) == 1 and None not in ids
    named = await service.append_many([planned(plot="LND-3")], "da1", "STAFF_PORTAL", submission_id="sync-7")
    assert named[0].activity.submission_id == "sync-7"


async def test_local_record_subject_ancestors_and_ownership(service, activity_types, database):
    await _add_visit_type(database)
    data, _ = await service.append(visit(), "da1", "STAFF_PORTAL")
    assert data.subject_type == "LOCAL_RECORD" and data.subject_id == "parcel-1"
    assert data.subject_internal_record_id == "parcel-1" and data.subject_register_mnemonic == "TestParcel"
    assert data.subject_ancestor_record_ids == ["person-1"]

    # parcel-2 is Bekele's, not Almaz's: rejected.
    assert await _code(service.append(visit(parcel="parcel-2", person="P-1"), "da1", "S")) == "ACT-ERR-005"
    # An unknown parcel is rejected (STRICT local record).
    assert await _code(service.append(visit(parcel="parcel-9"), "da1", "S")) == "ACT-ERR-005"

    # The profile tab: the parcel's own activities, and the person's through the parcel.
    parcel = await service.subject_activities(SubjectActivitiesPayload(subject_internal_record_id="parcel-1"))
    person = await service.subject_activities(SubjectActivitiesPayload(subject_internal_record_id="person-1"))
    person_only = await service.subject_activities(
        SubjectActivitiesPayload(subject_internal_record_id="person-1", include_descendants=False)
    )
    assert [a.activity_id for g in parcel for a in g.activities] == [data.activity_id]
    assert [a.activity_id for g in person for a in g.activities] == [data.activity_id]
    assert person[0].register_mnemonic == REG and person_only == []


async def test_latest_activity_for_form_defaults(service, activity_types, database):
    await _add_visit_type(database)
    await service.append(visit(days=9, note="old"), "da1", "STAFF_PORTAL")
    await service.append(visit(days=2, note="new"), "da1", "STAFF_PORTAL")
    latest = await service.latest_activity(
        LatestActivityPayload(register_mnemonic=REG, activity_type="VISIT", subject_internal_record_id="parcel-1")
    )
    assert latest.payload["note"] == "new"
    none = await service.latest_activity(
        LatestActivityPayload(register_mnemonic=REG, activity_type="VISIT", subject_internal_record_id="parcel-2")
    )
    assert none is None


async def test_outbox_enriches_and_aggregates_with_history(service, activity_types, database):
    await service.append(planned(), "da1", "STAFF_PORTAL")
    first, _ = await service.append(sown(area=1.5), "da1", "STAFF_PORTAL")
    await service.append(planned(plot="LND-2"), "da1", "STAFF_PORTAL")
    await service.append(sown(plot="LND-2", area=0.5), "da1", "STAFF_PORTAL")
    outbox = G2PActivityOutboxService()
    await outbox.process_batch()

    enriched = await service.get(REG, first.activity_id)
    assert enriched.enrichment == {"rainfall_mm": 42, "plot": "LND-1"}
    assert enriched.payload.get("rainfall_mm") is None  # never written into the activity

    current = await service.search_aggregates(SearchAggregatesPayload(register_mnemonic=REG, subject_id="P-1"))
    assert len(current) == 1
    assert current[0].aggregate_type == "AREA_SOWN" and current[0].period_key == "MEHER"
    assert current[0].aggregate_value == {"area_sown_ha": 2.0}

    # A correction recomputes the roll-up; the history keeps every value.
    await service.supersede(REG, first.activity_id, "measured again", "da1", "STAFF_PORTAL",
                            payload={**first.payload, "area_ha": 2.5})
    await outbox.process_batch()
    current = await service.search_aggregates(SearchAggregatesPayload(register_mnemonic=REG, subject_id="P-1"))
    assert current[0].aggregate_value == {"area_sown_ha": 3.0}
    history = await service.aggregate_history(
        AggregateHistoryPayload(register_mnemonic=REG, subject_id="P-1", aggregate_type="AREA_SOWN")
    )
    # Roll-ups are recomputed from current data when the worker runs, so the
    # first batch already saw both sowings.
    values = [h.aggregate_value["area_sown_ha"] for h in history]
    assert values[0] == 2.0 and values[-1] == 3.0 and len(values) >= 3

    # Processing again changes nothing (idempotent).
    assert await outbox.process_batch() == 0


async def test_activity_register_cannot_be_created_from_configuration(database):
    with pytest.raises(G2PRegistryException) as info:
        await G2PRegisterService.__new__(G2PRegisterService).create_register(
            register_mnemonic="Attendance", register_purpose="ACTIVITY"
        )
    assert info.value.code == "ACT-ERR-021"


async def test_existing_table_gets_new_columns(database):
    async with database.begin() as conn:
        await conn.execute(text("ALTER TABLE g2p_activity_field_works DROP COLUMN submission_id"))
    added = await G2PActivityPartitionService().add_missing_columns(G2PActivityFieldWork)
    assert added == ["submission_id"]
    assert await G2PActivityPartitionService().add_missing_columns(G2PActivityFieldWork) == []
