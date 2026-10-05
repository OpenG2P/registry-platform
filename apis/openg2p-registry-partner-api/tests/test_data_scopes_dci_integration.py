"""DCI search filtered by data scopes, end to end on the reference extension against PostgreSQL.

The reference extension's real register definitions, sections and outgoing DCI
template (individual_to_dci.json.j2): an Individual with a linked
IndividualDisability record (a child table register). The default scopes (one
per section) are published from the sections, the record is searched through
G2PDciService and rendered by the real template.

Run with the reference extension importable as openg2p_registry_extensions:

    PYTHONPATH=src:<dir with openg2p_registry_extensions -> reference extension> pytest tests

PARTNER_TEST_DB_URL (default postgresql+asyncpg://postgres:postgres@localhost:55432/registry_partner_scopes_test)
is created if missing and its public schema is dropped and recreated. Skipped when
PostgreSQL is not reachable.
"""

import asyncio
import importlib
import json
import os
from datetime import datetime
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

DB_URL = os.environ.get(
    "PARTNER_TEST_DB_URL", "postgresql+asyncpg://postgres:postgres@localhost:55432/registry_partner_scopes_test"
)
CONTROLLER = "reference-registry"
UIN = "UIN-SCOPES-1"


def _extension_dir() -> Path:
    module = importlib.import_module("openg2p_registry_extensions")
    return Path(module.__file__).parent


async def _create_database() -> bool:
    base, name = DB_URL.rsplit("/", 1)
    admin = create_async_engine(f"{base}/postgres", isolation_level="AUTOCOMMIT")
    try:
        async with admin.connect() as conn:
            exists = (await conn.execute(text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": name})).scalar()
            if not exists:
                await conn.execute(text(f'CREATE DATABASE "{name}"'))
        return True
    except Exception:
        return False
    finally:
        await admin.dispose()


async def _run_sql_file(engine, path: Path) -> None:
    async with engine.connect() as conn:
        raw = await conn.get_raw_connection()
        await raw.driver_connection.execute(path.read_text())


async def _setup():
    from openg2p_fastapi_common.context import dbengine

    if not await _create_database():
        return None
    engine = create_async_engine(DB_URL)
    async with engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
    dbengine.set(engine)

    from openg2p_registry_core import models as core_models
    from openg2p_registry_core.services import G2PDataScopeService

    models = importlib.import_module("openg2p_registry_extensions.register_domain.models")
    for model in (core_models.G2PRegisterDefinition, core_models.G2PRegisterSection, core_models.G2PDataScope,
                  core_models.G2PDataScopeVersion, core_models.G2PRegistryDocument,
                  core_models.G2PRegisterSectionDocument, core_models.G2PRegisterScore):
        await model.create_migrate()
    for name, model in vars(models).items():
        if name.startswith("G2PRegister") and not name.startswith("G2PRegisterHistory") \
                and isinstance(model, type) and "__tablename__" in model.__dict__:
            await model.create_migrate()
    metadata = _extension_dir() / "meta_data" / "register-metadata"
    await _run_sql_file(engine, metadata / "g2p_register_definitions.sql")
    await _run_sql_file(engine, metadata / "g2p_register_sections.sql")

    now = "now() AT TIME ZONE 'utc'"
    base_columns = "internal_record_id, record_name, created_by, created_at, last_approved_at, last_approved_by, " \
                   "record_status"
    base_values = f"'t', {now}, {now}, 't', 'ACTIVE'"
    async with engine.begin() as conn:
        await conn.execute(text(
            f"INSERT INTO g2p_register_individuals ({base_columns}, foundational_id, functional_record_id, "
            f"first_name, last_name, birth_date, gender) VALUES "
            f"('ind-1', 'Almaz Bekele', {base_values}, '{UIN}', 'IND-1', 'Almaz', 'Bekele', '1990-01-01', 'FEMALE')"
        ))
        await conn.execute(text(
            f"INSERT INTO g2p_register_individual_disabilities ({base_columns}, link_internal_record_id, "
            f"disability_domain, disability_severity) VALUES "
            f"('dis-1', 'Vision', {base_values}, 'ind-1', 'VISION', 'A_LOT_OF_DIFFICULTY')"
        ))

    scopes = G2PDataScopeService()
    await scopes.ensure_guards()
    return engine, scopes


@pytest.fixture(scope="module")
def env():
    from openg2p_registry_core.config import Settings

    config = Settings.get_config(strict=False)
    saved = config.consent_data_controller
    config.consent_data_controller = CONTROLLER
    loop = asyncio.new_event_loop()
    try:
        prepared = loop.run_until_complete(_setup())
        if prepared is None:
            pytest.skip(f"PostgreSQL not reachable at {DB_URL}")
        engine, scopes = prepared
        yield loop, scopes
        loop.run_until_complete(engine.dispose())
    finally:
        config.consent_data_controller = saved
        loop.close()


def _service(scopes):
    from openg2p_registry_core.helpers import TemplateHelper
    from openg2p_registry_core.services import G2PDocumentService, G2PRegisterService

    from openg2p_registry_partner_api.search.dci.services.g2p_dci_service import G2PDciService

    G2PDocumentService.get_component() or G2PDocumentService()
    templates = TemplateHelper.get_component() or TemplateHelper()
    template_dir = _extension_dir() / "templates"
    templates.get_template = lambda store_id, bucket=None: (template_dir / store_id).read_text()

    service = G2PDciService.__new__(G2PDciService)
    service.register_service = G2PRegisterService.__new__(G2PRegisterService)
    service.data_scopes = scopes

    async def data_model_id():
        return "dci"

    async def template_store_id(register_id, data_model_id):
        return "individual_to_dci.json.j2", None

    service._get_data_model_id = data_model_id
    service._get_template_store_id = template_store_id
    return service


def _message():
    from openg2p_registry_partner_api.search.dci.schemas.dci_request import (
        DciSearchCriteria,
        DciSearchRequest,
        DciSearchRequestItem,
    )

    criteria = DciSearchCriteria(
        reg_type="Individual", reg_record_type="spdci-extensions-dci:Individual", query_type="expression",
        query={"type": "expression", "value": {"expression": {"query": {"foundational_id": {"$eq": UIN}}}}},
    )
    return DciSearchRequest(transaction_id="t", search_request=[
        DciSearchRequestItem(reference_id="r1", search_criteria=criteria)])


def _search(loop, scopes, scope_names, enforce=True):
    from openg2p_registry_partner_api.search.dci.services.g2p_dci_service import ConsentScopeGrant

    grants = {"r1": ConsentScopeGrant([f"{CONTROLLER}.{n}" for n in scope_names], datetime.utcnow())}
    items = loop.run_until_complete(_service(scopes).search(
        "sig", None, _message(),
        consent_scopes_by_ref=grants if enforce else None,
        consent_subjects_by_ref={"r1": UIN} if enforce else None,
    ))
    records = items[0].data.reg_records
    assert len(records) == 1
    return records[0], json.dumps(records[0])


def test_default_section_scopes_published(env):
    loop, scopes = env
    listed = {s["scope_id"]: s for s in loop.run_until_complete(scopes.list_scopes())}
    demographic = listed[f"{CONTROLLER}.individual_demographic_details"]
    assert demographic["versions"][0]["fields"] == ["section:individual_demographic_details"]
    assert "Individual.first_name" in demographic["versions"][0]["resolved_fields"]
    assert listed[f"{CONTROLLER}.individual_disabilities"]["versions"][0]["resolved_fields"] == [
        "IndividualDisability.disability_domain", "IndividualDisability.disability_severity"]
    # The extension's catalogue (meta_data/data-scopes/data_scopes.json): a finer
    # scope, and a section scope it relabels.
    name = listed[f"{CONTROLLER}.individual_name"]
    assert name["source"] == "EXTENSION" and name["versions"][0]["resolved_fields"] == [
        "Individual.first_name", "Individual.last_name", "Individual.middle_name"]
    assert listed[f"{CONTROLLER}.individual_identifier"]["label"] == "Identifiers"


def test_finer_scope(env):
    loop, scopes = env
    record, rendered = _search(loop, scopes, ["individual_name"])
    assert record["demographic_info"]["name"]["given_name"] == "Almaz"
    assert record["demographic_info"]["birth_date"] == "" and record["demographic_info"]["sex"] == "unknown"
    assert UIN not in rendered


def test_consented_section_only(env):
    loop, scopes = env
    record, rendered = _search(loop, scopes, ["individual_demographic_details"])
    name = record["demographic_info"]["name"]
    assert name["given_name"] == "Almaz" and name["surname"] == "Bekele"
    # foundational_id is in the demographic section here; the functional ID and
    # the linked disability record are not consented.
    assert "IND-1" not in rendered
    assert record["disability_info"] == [] and record["is_disabled"] is False


def test_child_register_records_only(env):
    loop, scopes = env
    record, rendered = _search(loop, scopes, ["individual_disabilities"])
    assert record["disability_info"] == [
        {"functional_limitation_type": "Seeing", "functional_limitations_level": "a lot of difficulty"}
    ]
    assert record["demographic_info"]["name"]["given_name"] == ""
    # The consent-subject check needed the foundational ID; it is not returned.
    for value in ("Almaz", "Bekele", UIN, "IND-1", "1990-01-01"):
        assert value not in rendered


def test_unknown_and_foreign_scopes_return_no_data(env):
    loop, scopes = env
    from openg2p_registry_partner_api.search.dci.services.g2p_dci_service import ConsentScopeGrant

    grants = {"r1": ConsentScopeGrant(["farmer-registry.individual_demographic_details",
                                       f"{CONTROLLER}.no_such_scope"], datetime.utcnow())}
    items = loop.run_until_complete(_service(scopes).search(
        "sig", None, _message(), consent_scopes_by_ref=grants, consent_subjects_by_ref={"r1": UIN}))
    rendered = json.dumps(items[0].data.reg_records)
    for value in ("Almaz", "Bekele", UIN, "IND-1", "Seeing"):
        assert value not in rendered


def test_enforcement_off_returns_everything(env):
    loop, scopes = env
    record, rendered = _search(loop, scopes, [], enforce=False)
    for value in ("Almaz", UIN, "Seeing"):
        assert value in rendered
