from datetime import date, datetime, timedelta

import pytest
from sqlalchemy import text

from openg2p_registry_core.errors import G2PRegistryException
from openg2p_registry_core.helpers.ethiopian_calendar import format_ethiopian_date
from openg2p_registry_core.schemas.activity import (
    ActivityInput,
    LockPeriodPayload,
    ResolveTemporaryReferencePayload,
    SearchActivitiesPayload,
    WorkListPayload,
)

pytestmark = pytest.mark.asyncio(loop_scope="session")

REG = "FieldWork"


def _days_ago(days: int) -> datetime:
    return (datetime.utcnow() - timedelta(days=days)).replace(microsecond=0)


def planned(plot="LND-1", season="MEHER", days=30, **extra):
    return ActivityInput(
        register_mnemonic=REG, activity_type="PLANNED", occurred_at=_days_ago(days),
        subject_type="FARMER_ID", subject_id="FR-1", payload={"plot_id": plot, "season": season, **extra},
    )


def sown(plot="LND-1", season="MEHER", crop="TEFF", area=1.5, days=20, **kwargs):
    payload = {"plot_id": plot, "season": season, "crop": crop, "area_ha": area, "woreda": "ET0401"}
    payload.update(kwargs.pop("payload", {}))
    return ActivityInput(
        register_mnemonic=REG, activity_type="SOWN", occurred_at=_days_ago(days),
        subject_type="FARMER_ID", subject_id="FR-1", payload=payload, **kwargs,
    )


def harvested(plot="LND-1", season="MEHER", days=1):
    return ActivityInput(
        register_mnemonic=REG, activity_type="HARVESTED", occurred_at=_days_ago(days),
        subject_type="FARMER_ID", subject_id="FR-1", payload={"plot_id": plot, "season": season},
    )


async def _code(awaitable) -> str:
    with pytest.raises(G2PRegistryException) as info:
        await awaitable
    return info.value.code


async def test_append_derives_context_promotes_columns_and_projects(service, activity_types, database):
    await service.append(planned(), "da1", "STAFF_PORTAL")
    data, outcome = await service.append(sown(), "da1", "STAFF_PORTAL")

    assert outcome == "CREATED"
    assert data.context_id
    assert data.columns["crop"] == "TEFF" and data.columns["area_ha"] == 1.5
    assert data.verification_status == "SUBMITTED"
    assert data.display == {"crop": "Teff"}
    assert data.reference_checks["plot_id"]["status"] == "RESOLVED"
    assert data.occurred_on_ec  # Ethiopian-calendar rendering of occurred_at

    async with database.connect() as conn:
        projection = (
            await conn.execute(text("SELECT stage, area_sown_ha, activity_count FROM g2p_activity_projection_field_works"))
        ).one()
        outbox = (await conn.execute(text("SELECT count(*) FROM g2p_activity_outbox"))).scalar()
    assert projection.stage == "SOWN" and float(projection.area_sown_ha) == 1.5 and projection.activity_count == 2
    assert outbox == 2


async def test_idempotency_returns_same_activity(service, activity_types):
    first, outcome1 = await service.append(sown(idempotency_key="odk-uuid-1"), "da1", "ODK")
    second, outcome2 = await service.append(sown(idempotency_key="odk-uuid-1"), "da1", "ODK")
    assert (outcome1, outcome2) == ("CREATED", "DUPLICATE")
    assert first.activity_id == second.activity_id


async def test_sequence_warns_or_blocks(service, activity_types):
    data, _ = await service.append(sown(), "da1", "STAFF_PORTAL")  # PLANNED missing → WARN
    assert data.rule_warnings and "PLANNED" in data.rule_warnings[0]
    code = await _code(service.append(harvested(plot="LND-2"), "da1", "STAFF_PORTAL"))  # SOWN missing → BLOCK
    assert code == "ACT-ERR-009"


async def test_repeatable_and_uniqueness(service, activity_types):
    await service.append(planned(), "da1", "STAFF_PORTAL")
    assert await _code(service.append(planned(), "da1", "STAFF_PORTAL")) == "ACT-ERR-010"
    await service.append(sown(crop="TEFF"), "da1", "STAFF_PORTAL")
    assert await _code(service.append(sown(crop="TEFF", area=2), "da1", "STAFF_PORTAL")) == "ACT-ERR-011"
    data, _ = await service.append(sown(crop="MAIZE"), "da1", "STAFF_PORTAL")  # intercrop: different crop
    assert data.columns["crop"] == "MAIZE"


async def test_payload_schema_and_strict_reference(service, activity_types):
    assert await _code(service.append(sown(area=-1), "da1", "STAFF_PORTAL")) == "ACT-ERR-004"
    assert await _code(service.append(sown(crop="COFFEE"), "da1", "STAFF_PORTAL")) == "ACT-ERR-005"


async def test_lenient_external_reference_and_temporary_ids(service, activity_types):
    data, _ = await service.append(sown(plot="XYZ-9"), "da1", "STAFF_PORTAL")
    assert data.reference_checks["plot_id"]["status"] == "UNRESOLVED"
    assert any("plot_id" in w for w in data.rule_warnings)

    down, _ = await service.append(sown(plot="DOWN-1"), "da1", "STAFF_PORTAL")
    assert down.reference_checks["plot_id"]["status"] == "UNVERIFIED"

    temp, _ = await service.append(sown(plot="TMP-7"), "da1", "ODK")
    assert temp.reference_checks["plot_id"]["status"] == "TEMPORARY"
    pending = await service.list_temporary_references(REG)
    assert [p.temporary_id for p in pending] == ["TMP-7"]

    await service.resolve_temporary_reference(
        ResolveTemporaryReferencePayload(
            register_mnemonic=REG, reference_field="plot_id", temporary_id="TMP-7", resolved_id="LND-77"
        ),
        "admin",
    )
    # New activities using the temporary ID get the resolved one.
    again, _ = await service.append(sown(plot="TMP-7", crop="MAIZE"), "da1", "ODK")
    assert again.payload["plot_id"] == "LND-77"
    assert await service.list_temporary_references(REG) == []


async def test_ethiopian_dates(service, activity_types):
    day = date.today() - timedelta(days=5)
    ec = format_ethiopian_date(day)
    data, _ = await service.append(
        ActivityInput(
            register_mnemonic=REG, activity_type="SOWN", occurred_on_ec=ec,
            payload={"plot_id": "LND-5", "season": "MEHER", "crop": "TEFF", "area_ha": 1, "event_date_ec": ec},
        ),
        "da1", "STAFF_PORTAL",
    )
    assert data.occurred_at == datetime.combine(day, datetime.min.time())
    assert data.occurred_on_ec == ec
    assert data.payload["event_date"] == day.isoformat() and "event_date_ec" not in data.payload
    assert data.columns["event_date"] == day.isoformat()
    assert await _code(
        service.append(
            ActivityInput(register_mnemonic=REG, activity_type="PLANNED", occurred_on_ec="2017-13-07",
                          payload={"plot_id": "LND-6", "season": "MEHER"}),
            "da1", "STAFF_PORTAL",
        )
    ) == "ACT-ERR-004"


async def test_backdating_future_and_period_lock(service, activity_types):
    assert await _code(service.append(planned(days=400), "da1", "STAFF_PORTAL")) == "ACT-ERR-012"
    assert await _code(service.append(planned(days=-3), "da1", "STAFF_PORTAL")) == "ACT-ERR-013"
    await service.lock_period(
        LockPeriodPayload(
            register_mnemonic=REG, period_start=date.today() - timedelta(days=60),
            period_end=date.today() - timedelta(days=10), reason="Meher closed",
        ),
        "admin",
    )
    assert await _code(service.append(planned(days=30), "da1", "STAFF_PORTAL")) == "ACT-ERR-014"
    data, _ = await service.append(planned(days=5), "da1", "STAFF_PORTAL")
    assert data.activity_type == "PLANNED"


async def test_context_required(service, activity_types):
    code = await _code(
        service.append(ActivityInput(register_mnemonic=REG, activity_type="PLANNED", occurred_at=_days_ago(1)),
                       "da1", "STAFF_PORTAL")
    )
    assert code == "ACT-ERR-006"
    note, _ = await service.append(
        ActivityInput(register_mnemonic=REG, activity_type="NOTE", occurred_at=_days_ago(1), payload={"t": "x"}),
        "da1", "STAFF_PORTAL",
    )
    assert note.context_id is None


async def test_supersede_void_and_projection(service, activity_types, database):
    await service.append(planned(), "da1", "STAFF_PORTAL")
    original, _ = await service.append(sown(area=1.5), "da1", "STAFF_PORTAL")
    corrected = await service.supersede(
        REG, original.activity_id, "area was measured wrongly", "sup1", "STAFF_PORTAL",
        payload={**original.payload, "area_ha": 1.2},
    )
    assert corrected.supersedes_activity_id == original.activity_id
    old = await service.get(REG, original.activity_id)
    assert old.status == "SUPERSEDED" and old.superseded_by_activity_id == corrected.activity_id

    async with database.connect() as conn:
        area = (await conn.execute(text("SELECT area_sown_ha FROM g2p_activity_projection_field_works"))).scalar()
    assert float(area) == 1.2

    assert await _code(service.void(REG, corrected.activity_id, "", "sup1")) == "ACT-ERR-016"
    voided = await service.void(REG, corrected.activity_id, "entered for the wrong farmer", "sup1")
    assert voided.status == "VOIDED"
    async with database.connect() as conn:
        stage = (await conn.execute(text("SELECT stage FROM g2p_activity_projection_field_works"))).scalar()
    assert stage == "PLANNED"
    assert await _code(service.void(REG, corrected.activity_id, "again", "sup1")) == "ACT-ERR-015"


async def test_verify_and_reject(service, activity_types, database):
    await service.append(planned(), "da1", "STAFF_PORTAL")
    a, _ = await service.append(sown(crop="TEFF"), "da1", "STAFF_PORTAL")
    b, _ = await service.append(sown(crop="MAIZE"), "da1", "STAFF_PORTAL")
    assert (await service.verify(REG, a.activity_id, "sup1")).verification_status == "VERIFIED"
    assert await _code(service.verify(REG, b.activity_id, "sup1", remarks=None, approve=False)) == "ACT-ERR-016"
    rejected = await service.verify(REG, b.activity_id, "sup1", remarks="photo missing", approve=False)
    assert rejected.verification_status == "REJECTED"
    assert await _code(service.verify(REG, a.activity_id, "sup1")) == "ACT-ERR-015"
    # a rejected SOWN no longer blocks a corrected one with the same crop
    again, _ = await service.append(sown(crop="MAIZE"), "da1", "STAFF_PORTAL")
    assert again.columns["crop"] == "MAIZE"


async def test_append_only_trigger(service, activity_types, database):
    await service.append(planned(), "da1", "STAFF_PORTAL")
    async with database.connect() as conn:
        with pytest.raises(Exception, match="append-only"):
            await conn.execute(text("UPDATE g2p_activity_field_works SET payload = '{}'::jsonb"))
        await conn.rollback()
        with pytest.raises(Exception, match="append-only"):
            await conn.execute(text("DELETE FROM g2p_activity_field_works"))
        await conn.rollback()


async def test_partitions_route_rows(service, activity_types, database):
    await service.append(planned(), "da1", "STAFF_PORTAL")
    year = datetime.utcnow().year if (datetime.utcnow() - timedelta(days=30)).year == datetime.utcnow().year \
        else datetime.utcnow().year - 1
    async with database.connect() as conn:
        count = (await conn.execute(text(f"SELECT count(*) FROM g2p_activity_field_works_y{year}"))).scalar()
    assert count == 1


async def test_batch_non_atomic_and_atomic(service, activity_types):
    results = await service.append_many([planned(), planned()], "da1", "ODK", atomic=False)
    assert [r.outcome for r in results] == ["CREATED", "FAILED"]
    assert results[1].error_code == "ACT-ERR-010"
    with pytest.raises(G2PRegistryException):
        await service.append_many([planned(plot="LND-3"), planned(plot="LND-3")], "da1", "ODK", atomic=True)
    found, total = await service.search(
        SearchActivitiesPayload(register_mnemonic=REG, activity_types=["PLANNED"]), None
    )
    assert total == 1  # atomic batch rolled back entirely


async def test_search_timeline_and_work_list(service, activity_types):
    await service.append(planned(days=100), "da1", "STAFF_PORTAL")
    await service.append(sown(days=95), "da1", "STAFF_PORTAL")  # harvest due 90–150 days after → DUE
    await service.append(planned(plot="LND-2", days=300), "da1", "STAFF_PORTAL")
    await service.append(sown(plot="LND-2", days=200), "da1", "STAFF_PORTAL")  # >150 days → OVERDUE
    await service.append(planned(plot="LND-3", days=20), "da1", "STAFF_PORTAL")
    await service.append(sown(plot="LND-3", days=10), "da1", "STAFF_PORTAL")  # not yet due

    items, total = await service.work_list(WorkListPayload(register_mnemonic=REG), None)
    assert [(i.context_key, i.due_status) for i in items] == [("LND-2|MEHER", "OVERDUE"), ("LND-1|MEHER", "DUE")]

    timeline = await service.timeline(REG, items[0].context_id, None)
    assert [a.activity_type for a in timeline] == ["PLANNED", "SOWN"]

    found, total = await service.search(SearchActivitiesPayload(register_mnemonic=REG, subject_id="FR-1"), None)
    assert total == 6


async def test_data_policy_fails_closed(service, activity_types):
    await service.append(planned(), "da1", "STAFF_PORTAL")
    await service.append(sown(), "da1", "STAFF_PORTAL")
    policy_on_known_column = [{
        "target": "REGISTER_RECORD", "register_id": "reg-fieldwork",
        "expression": {"type": "CONDITION", "field_id": "woreda", "operator": "eq", "value": "ET0401"},
    }]
    policy_on_missing_column = [{
        "target": "REGISTER_RECORD", "register_id": "reg-fieldwork",
        "expression": {"type": "CONDITION", "field_id": "kebele", "operator": "eq", "value": "X"},
    }]
    from unittest.mock import patch

    with patch(
        "iam_core.helpers.data_policy_helper.DataPolicyHelper.resolve_register_record_policy",
        side_effect=lambda policies, register_id: policies[0]["expression"],
    ):
        _, allowed = await service.search(SearchActivitiesPayload(register_mnemonic=REG), None, policy_on_known_column)
        _, denied = await service.search(SearchActivitiesPayload(register_mnemonic=REG), None, policy_on_missing_column)
    assert allowed == 1  # only SOWN has woreda set
    assert denied == 0


async def test_external_format_only(service, activity_types, database):
    async with database.begin() as conn:
        await conn.execute(text(
            "UPDATE g2p_activity_types SET reference_rules = jsonb_set(reference_rules, '{plot_id,lookup}', 'false') "
            "WHERE activity_type = 'SOWN'"))
    data, _ = await service.append(sown(plot="ANY-FORMAT"), "da1", "STAFF_PORTAL")
    assert data.reference_checks["plot_id"]["status"] == "FORMAT_CHECKED"
    assert not any("plot_id" in w for w in (data.rule_warnings or []))
