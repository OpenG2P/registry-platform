"""Typed participants, a crop season replacing another, and loading sample activities."""

import json
from datetime import datetime, timedelta

import pytest
from sqlalchemy import text

from openg2p_registry_core.errors import G2PRegistryException
from openg2p_registry_core.schemas.activity import (
    ActivityInput,
    ParticipantInput,
    SearchActivitiesPayload,
    SubjectActivitiesPayload,
)
from openg2p_registry_core.services import G2PActivitySampleService

from .conftest import REGISTER_ID
from .test_activity_service import REG, planned

pytestmark = pytest.mark.asyncio(loop_scope="session")

ROLES = {
    "parcel": {"field": "parcel_ref", "primary": True},
    "person": {"field": "person_ref"},
    "inspector": {"field": "inspector_id"},
}
RULES = {
    "parcel_ref": {"kind": "LOCAL_RECORD", "register": "TestParcel", "match": "internal_record_id", "mode": "STRICT"},
    "person_ref": {"kind": "LOCAL_RECORD", "register": "TestPerson", "match": "functional_record_id",
                   "mode": "STRICT"},
    "inspector_id": {"kind": "EXTERNAL", "system": "staff-registry", "mode": "LENIENT", "lookup": False},
}


async def _add_inspection_type(database):
    async with database.begin() as conn:
        await conn.execute(
            text("INSERT INTO g2p_activity_types (activity_type_id, register_id, activity_type, display_name, "
                 "requires_context, is_repeatable, sequence_enforcement, allow_future_dated, requires_verification, "
                 "reference_rules, participant_roles, is_active) VALUES ('t-insp', :r, 'INSPECTED', 'Inspected', "
                 "false, true, 'WARN', false, false, CAST(:rules AS JSONB), CAST(:roles AS JSONB), true)"),
            {"r": REGISTER_ID, "rules": json.dumps(RULES), "roles": json.dumps(ROLES)},
        )


def inspection(**payload):
    return ActivityInput(register_mnemonic=REG, activity_type="INSPECTED",
                         occurred_at=(datetime.utcnow() - timedelta(days=2)).replace(microsecond=0),
                         payload=payload, participants=[ParticipantInput(role="inspector", id="STAFF-9")])


async def test_participants_are_typed_and_searchable(service, activity_types, database):
    await _add_inspection_type(database)
    data, _ = await service.append(inspection(parcel_ref="parcel-1", person_ref="P-1"), "da1", "STAFF_PORTAL")
    # The inspector came as a participant and filled its payload field.
    assert data.payload["inspector_id"] == "STAFF-9"
    by_role = {p.role: p for p in data.participants}
    assert by_role["parcel"].is_primary and by_role["parcel"].ref_kind == "LOCAL"
    assert by_role["parcel"].ref_register == "TestParcel" and by_role["parcel"].internal_record_id == "parcel-1"
    assert by_role["person"].internal_record_id == "person-1"
    assert by_role["inspector"].ref_kind == "EXTERNAL" and by_role["inspector"].ref_system == "staff-registry"

    found, total = await service.search(
        SearchActivitiesPayload(register_mnemonic=REG, participant_id="STAFF-9", participant_role="inspector"), None)
    assert total == 1 and found[0].activity_id == data.activity_id
    _, none = await service.search(
        SearchActivitiesPayload(register_mnemonic=REG, participant_id="STAFF-9", participant_role="person"), None)
    assert none == 0
    # The person's profile finds it through the person role, not the subject.
    [group] = await service.subject_activities(
        SubjectActivitiesPayload(subject_internal_record_id="person-1", include_descendants=False))
    assert [a.activity_id for a in group.activities] == [data.activity_id]

    with pytest.raises(G2PRegistryException) as unknown:
        await service.append(ActivityInput(
            register_mnemonic=REG, activity_type="INSPECTED", occurred_at=datetime.utcnow(),
            payload={"parcel_ref": "parcel-1"}, participants=[ParticipantInput(role="vet", id="V1")]), "da1", "S")
    assert unknown.value.code == "ACT-ERR-004"


async def test_a_crop_season_can_replace_another(service, activity_types, database):
    first, _ = await service.append(planned(plot="LND-7"), "da1", "STAFF_PORTAL")
    second, _ = await service.append(planned(plot="LND-7", season="BELG", replaces=first.context_id),
                                     "da1", "STAFF_PORTAL")
    async with database.connect() as conn:
        rows = {r.context_id: r for r in (await conn.execute(text(
            "SELECT context_id, status, replaces_context_id, replaced_by_context_id, close_reason "
            "FROM g2p_activity_contexts"))).all()}
        projected = {r.context_id: r for r in (await conn.execute(text(
            "SELECT context_id, context_status, replaced_by_context_id, replaces_context_id "
            "FROM g2p_activity_projection_field_works"))).all()}
    old, new = rows[first.context_id], rows[second.context_id]
    assert new.replaces_context_id == old.context_id and old.replaced_by_context_id == new.context_id
    assert old.status == "CLOSED" and "Replaced by" in old.close_reason
    assert projected[first.context_id].replaced_by_context_id == second.context_id
    assert projected[second.context_id].replaces_context_id == first.context_id


async def test_samples_load_once_through_the_write_path(service, activity_types, database):
    loader = G2PActivitySampleService()
    assert await loader.load(REG) == 3  # plan, sowing, and the sowing's correction
    assert await loader.load(REG) == 0  # already loaded
    async with database.connect() as conn:
        rows = (await conn.execute(text(
            "SELECT activity_type, status, verification_status, area_ha, recorded_by, channel "
            "FROM g2p_activity_field_works ORDER BY recorded_at"))).all()
    assert [(r.activity_type, r.status) for r in rows] == [
        ("PLANNED", "ACTIVE"), ("SOWN", "SUPERSEDED"), ("SOWN", "ACTIVE")]
    assert rows[1].verification_status == "VERIFIED" and float(rows[2].area_ha) == 1.2
    assert {r.channel for r in rows} == {"SYSTEM"} and rows[0].recorded_by == "sample-data"
