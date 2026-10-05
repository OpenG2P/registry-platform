"""Data scopes against PostgreSQL: publishing, immutability, resolution and record filtering.

Uses the test extension in conftest.py: TestPerson (a register) with TestParcel
(its child table register) and FieldWork (an activity register).
"""

import json
import time
from datetime import datetime

import pytest
import pytest_asyncio
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import async_sessionmaker

from openg2p_registry_core.config import Settings
from openg2p_registry_core.models import (
    G2PDataScope,
    G2PDataScopeVersion,
    G2PRegisterDefinition,
    G2PRegisterSection,
    G2PRegisterSectionDocument,
    G2PRegistryDocument,
)
from openg2p_registry_core.services import DataScopeCatalogueError, G2PDataScopeService

from .conftest import PARCEL_REGISTER_ID, PERSON_REGISTER_ID
from .test_activity_service import planned, sown

pytestmark = pytest.mark.asyncio(loop_scope="session")

CONTROLLER = "test-registry"

SECTIONS = [
    # (section_mnemonic, section_register_id, ui schema)
    ("person_identity", PERSON_REGISTER_ID, {"panels": [{"widgets": [
        {"widget": "text", "widget-data-path": f"{PERSON_REGISTER_ID}.functional_record_id"},
        {"widget": "text", "widget-data-path": f"{PERSON_REGISTER_ID}.record_name"},
        {"widget": "text", "widget-data-path": f"{PERSON_REGISTER_ID}.not_a_column"},  # left out, not an error
    ]}]}),
    ("person_parcels", PARCEL_REGISTER_ID, {"panels": [{"widgets": [
        {"widget": "table", "widget-data-path": f"{PARCEL_REGISTER_ID}.records", "widget-data-columns": [
            {"widget": "text", "widget-data-path": "record_name"},
            {"widget": "text", "widget-data-path": "geo_lowest_level_value_id"},
        ]},
    ]}]}),
    ("person_header", PERSON_REGISTER_ID, {"panels": [{"widgets": [
        {"widget": "scores-display", "widget-data-path": "c0000000-0000-4000-8000-000000000001.records"},
    ]}]}),  # shows nothing shareable: no scope
]


@pytest_asyncio.fixture(loop_scope="session")
async def scopes(database, tmp_path):
    for model in (G2PRegisterSection, G2PDataScope, G2PDataScopeVersion, G2PRegistryDocument,
                  G2PRegisterSectionDocument):
        await model.create_migrate()
    service = G2PDataScopeService()
    await service.ensure_guards()
    async with database.begin() as conn:
        # TRUNCATE does not fire the row guards, as intended for tests.
        await conn.execute(text("TRUNCATE g2p_data_scopes, g2p_data_scope_versions, g2p_register_sections"))
        for mnemonic, section_register_id, schema in SECTIONS:
            await conn.execute(
                text(
                    "INSERT INTO g2p_register_sections (register_id, section_id, section_register_id, "
                    "is_core_section, section_mnemonic, section_description, documents_required, "
                    "no_of_verifications_required, is_list, section_weightage, section_ui_schema, "
                    "cr_auto_approve_for_bene_portal, cr_auto_approve_for_agent_portal, "
                    "cr_auto_approve_for_staff_portal, cr_auto_approve_for_partner) VALUES "
                    "(:r, :m, :sr, false, :m, :d, false, 0, false, 0, CAST(:s AS JSONB), false, false, false, false)"
                ),
                {"r": PERSON_REGISTER_ID, "m": mnemonic, "sr": section_register_id, "d": mnemonic.replace("_", " "),
                 "s": json.dumps(schema)},
            )
    config = Settings.get_config(strict=False)
    saved = (config.consent_data_controller, config.data_scopes_catalogue_path, config.data_scopes_sync_check_seconds)
    catalogue_dir = tmp_path / "data-scopes"
    catalogue_dir.mkdir()
    config.consent_data_controller = CONTROLLER
    config.data_scopes_catalogue_path = str(catalogue_dir)
    config.data_scopes_sync_check_seconds = 0
    service.catalogue_file = catalogue_dir / "catalogue.json"
    yield service
    config.consent_data_controller, config.data_scopes_catalogue_path, config.data_scopes_sync_check_seconds = saved


def _write(service, content):
    service.catalogue_file.write_text(json.dumps(content))


async def _versions(database, name):
    async with async_sessionmaker(database, expire_on_commit=False)() as session:
        return (
            await session.execute(
                select(G2PDataScopeVersion).where(G2PDataScopeVersion.scope_name == name)
                .order_by(G2PDataScopeVersion.version)
            )
        ).scalars().all()


async def test_default_scopes_one_per_section(scopes, database):
    outcome = await scopes.sync()
    assert outcome == {"person_identity": "created", "person_parcels": "created"}
    listed = {s["scope_id"]: s for s in await scopes.list_scopes()}
    identity = listed[f"{CONTROLLER}.person_identity"]
    assert identity["status"] == "ACTIVE" and identity["current_version"] == 1 and identity["source"] == "SECTION"
    assert identity["versions"][0]["fields"] == ["section:person_identity"]
    assert identity["versions"][0]["resolved_fields"] == ["TestPerson.functional_record_id", "TestPerson.record_name"]
    assert listed[f"{CONTROLLER}.person_parcels"]["versions"][0]["resolved_fields"] == [
        "TestParcel.geo_lowest_level_value_id", "TestParcel.record_name"]


async def test_publishing_is_idempotent_versioned_and_retires(scopes, database):
    await scopes.sync()
    assert set((await scopes.sync()).values()) == {"unchanged"}

    _write(scopes, {"scopes": [
        {"name": "contact", "label": "Contact", "fields": ["TestPerson.record_name"]},
        {"name": "person_identity", "label": "Identity"},  # relabel a section scope
    ]})
    outcome = await scopes.sync()
    assert outcome["contact"] == "created"
    assert outcome["person_identity"] == "updated"  # same fields: relabelled, no new version
    assert set((await scopes.sync()).values()) == {"unchanged"}

    _write(scopes, {"scopes": [
        {"name": "contact", "label": "Contact", "fields": ["TestPerson.record_name", "TestPerson.functional_record_id"]},
        {"name": "person_identity", "label": "Identity"},
    ]})
    assert (await scopes.sync())["contact"] == "version 2"
    assert [v.resolved_fields for v in await _versions(database, "contact")] == [
        ["TestPerson.record_name"], ["TestPerson.functional_record_id", "TestPerson.record_name"]]

    # Removed from the catalogue (and the section scope excluded): retired, versions kept.
    _write(scopes, {"exclude_section_scopes": ["person_parcels"], "scopes": [{"name": "person_identity"}]})
    outcome = await scopes.sync()
    assert outcome["contact"] == "retired" and outcome["person_parcels"] == "retired"
    listed = {s["name"]: s for s in await scopes.list_scopes()}
    assert listed["contact"]["status"] == "RETIRED" and len(listed["contact"]["versions"]) == 2

    # A retired scope's ID is never reused.
    _write(scopes, {"scopes": [{"name": "contact", "fields": ["TestPerson.record_name"]}]})
    with pytest.raises(DataScopeCatalogueError, match="never reused"):
        await scopes.sync()


async def test_unknown_references_are_refused(scopes, database):
    await scopes.sync()
    _write(scopes, {
        "exclude_section_scopes": ["no_such_section"],
        "field_renames": {"TestPerson.old": "TestPerson.nope"},
        "scopes": [
            {"name": "bad", "fields": ["TestPerson.nope", "Nowhere.x", "section:missing", "FieldWork.activity.nope"]},
            {"name": "not valid!", "fields": ["TestPerson.record_name"]},
        ],
    })
    with pytest.raises(DataScopeCatalogueError) as info:
        await scopes.sync()
    message = str(info.value)
    for expected in ("TestPerson has no field 'nope'", "no register 'Nowhere'", "no section 'missing'",
                     "FieldWork.activity has no field 'nope'", "no section 'no_such_section'", "'not valid!'",
                     "field_renames"):
        assert expected in message
    # Not strict (start-up): logged, and the published catalogue stays as it was.
    assert await scopes.sync(strict=False) is None
    assert {s["name"] for s in await scopes.list_scopes()} == {"person_identity", "person_parcels"}


async def test_versions_and_scopes_are_immutable(scopes, database):
    await scopes.sync()
    for statement in (
        "UPDATE g2p_data_scope_versions SET resolved_fields = '[]'::jsonb",
        "DELETE FROM g2p_data_scope_versions",
        "DELETE FROM g2p_data_scopes",
        "UPDATE g2p_data_scopes SET scope_name = 'renamed'",
    ):
        with pytest.raises(Exception) as info:
            async with database.begin() as conn:
                await conn.execute(text(statement))
        assert "immutable" in str(info.value) or "never" in str(info.value)
    async with database.begin() as conn:  # label/status may change
        await conn.execute(text("UPDATE g2p_data_scopes SET label = 'x' WHERE scope_name = 'person_identity'"))


async def test_resolution_by_consent_issue_time(scopes, database):
    _write(scopes, {"scopes": [{"name": "contact", "fields": ["TestPerson.record_name"]}]})
    await scopes.sync()
    time.sleep(0.01)
    between = datetime.utcnow()
    time.sleep(0.01)
    _write(scopes, {"scopes": [{"name": "contact", "fields": ["TestPerson.record_name", "TestPerson.created_by"]}]})
    await scopes.sync()

    older = await scopes.resolve([f"{CONTROLLER}.contact"], between)
    assert older.grant == {"TestPerson": frozenset({"record_name"})}  # the widening does not reach it
    newer = await scopes.resolve([f"{CONTROLLER}.contact"], datetime.utcnow())
    assert newer.grant == {"TestPerson": frozenset({"record_name", "created_by"})}

    # Another controller's scopes and unknown scopes grant nothing.
    assert (await scopes.resolve(["other-registry.contact", f"{CONTROLLER}.nope", "contact"], None)).grant == {}
    combined = await scopes.resolve([f"{CONTROLLER}.contact", f"{CONTROLLER}.person_parcels"], between)
    assert set(combined.grant) == {"TestPerson", "TestParcel"}


async def test_retired_scope_still_honoured(scopes, database):
    _write(scopes, {"scopes": [{"name": "contact", "fields": ["TestPerson.record_name"]}]})
    await scopes.sync()
    _write(scopes, {"scopes": []})
    assert (await scopes.sync())["contact"] == "retired"
    assert (await scopes.resolve([f"{CONTROLLER}.contact"], datetime.utcnow())).grant == {
        "TestPerson": frozenset({"record_name"})}


async def test_republished_when_sections_change(scopes, database):
    await scopes.list_scopes()  # first read publishes
    async with database.begin() as conn:
        await conn.execute(text("DELETE FROM g2p_register_sections WHERE section_mnemonic = 'person_parcels'"))
    listed = {s["name"]: s["status"] for s in await scopes.list_scopes()}
    assert listed == {"person_identity": "ACTIVE", "person_parcels": "RETIRED"}


async def test_register_record_with_child_records_filtered(scopes, database):
    from openg2p_registry_core.models.g2p_register import G2PRegister  # noqa: F401
    from openg2p_registry_core.services import G2PDocumentService, G2PRegisterHierarchicalService

    from .conftest import G2PRegisterTestPerson

    G2PDocumentService.get_component() or G2PDocumentService()
    await scopes.sync()
    hierarchy = G2PRegisterHierarchicalService.__new__(G2PRegisterHierarchicalService)
    async with async_sessionmaker(database, expire_on_commit=False)() as session:
        definition = await session.get(G2PRegisterDefinition, PERSON_REGISTER_ID)
        person = await session.get(G2PRegisterTestPerson, "person-1")
        record = await hierarchy.enrich_record_hierarchy(definition, person, session)
    assert record["test_parcel"][0]["record_name"] == "Parcel one"

    allowed = await scopes.resolve([f"{CONTROLLER}.person_parcels"], datetime.utcnow())
    out = allowed.filter_register_record(record, "TestPerson", await scopes.nested_keys())
    assert out["record_name"] is None and out["functional_record_id"] is None and out["internal_record_id"] is None
    parcel = out["test_parcel"][0]
    assert parcel["record_name"] == "Parcel one"
    assert parcel["internal_record_id"] is None and parcel["link_internal_record_id"] is None
    assert set(parcel) == set(record["test_parcel"][0])  # same shape, values only where consented

    allowed = await scopes.resolve([f"{CONTROLLER}.person_identity"], datetime.utcnow())
    out = allowed.filter_register_record(record, "TestPerson", await scopes.nested_keys())
    assert out["functional_record_id"] == "P-1" and out["record_name"] == "Almaz"
    assert out["test_parcel"] == []


async def test_activity_records_filtered(scopes, service, activity_types, database):
    _write(scopes, {"scopes": [{
        "name": "field_work",
        "fields": ["FieldWork.activity.crop", "FieldWork.activity.area_ha", "FieldWork.context.stage",
                   "FieldWork.aggregate.aggregate_value"],
    }]})
    await scopes.sync()
    await service.append(planned(), "da1", "STAFF_PORTAL")
    data, _ = await service.append(sown(), "da1", "STAFF_PORTAL")

    from .conftest import G2PActivityFieldWork

    async with async_sessionmaker(database, expire_on_commit=False)() as session:
        row = (
            await session.execute(select(G2PActivityFieldWork).where(
                G2PActivityFieldWork.activity_id == data.activity_id))
        ).scalar_one()
    record = {k: v for k, v in row.to_dict().items() if k != "search_text"}
    allowed = await scopes.resolve([f"{CONTROLLER}.field_work"], datetime.utcnow())
    out = allowed.filter_flat(record, "FieldWork.activity")
    assert out["crop"] == "TEFF" and float(out["area_ha"]) == 1.5
    assert out["subject_id"] is None and out["payload"] is None and out["plot_id"] is None
    assert set(out) == set(record)
    assert allowed.filter_flat({"stage": "SOWN", "subject_id": "P-1"}, "FieldWork.context") == {
        "stage": "SOWN", "subject_id": None}


async def test_activity_only_registry_without_sections(scopes, database):
    """A registry with no register sections (e.g. only activity registers) gets its scopes from the catalogue."""
    async with database.begin() as conn:
        await conn.execute(text("TRUNCATE g2p_register_sections"))
    _write(scopes, {"scopes": [{"name": "field_work", "fields": ["FieldWork.activity.*"]}]})
    assert await scopes.sync() == {"field_work": "created"}
