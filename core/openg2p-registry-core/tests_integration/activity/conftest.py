"""Fixtures for activity register tests against a real PostgreSQL.

Run on their own (the unit tests in tests/ stub core modules for the whole run):

    pytest tests_integration/activity

Set ACTIVITY_TEST_DB_URL (default postgresql+asyncpg://postgres:postgres@localhost:55432/registry_test)
to a disposable database; the public schema is dropped and recreated. Tests are
skipped when the database is not reachable.

    docker run -d --name rp-activity-pg -e POSTGRES_PASSWORD=postgres \\
        -e POSTGRES_DB=registry_test -p 55432:5432 postgres:16
"""

import os
import sys
import types
from datetime import date

import pytest
import pytest_asyncio
from sqlalchemy import Date, Numeric, String, text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import Mapped, mapped_column

from openg2p_fastapi_common.context import dbengine

DB_URL = os.environ.get(
    "ACTIVITY_TEST_DB_URL", "postgresql+asyncpg://postgres:postgres@localhost:55432/registry_test"
)

# ---------------------------------------------------------------- test extension

from openg2p_registry_core.models import G2PActivity, G2PActivityProjection  # noqa: E402
from openg2p_registry_core.services import G2PActivityDomainService  # noqa: E402


class G2PActivityFieldWork(G2PActivity):
    __tablename__ = "g2p_activity_field_works"
    __table_args__ = {"extend_existing": True}

    plot_id: Mapped[str] = mapped_column(String, nullable=True, index=True)
    season: Mapped[str] = mapped_column(String, nullable=True)
    crop: Mapped[str] = mapped_column(String, nullable=True)
    area_ha: Mapped[float] = mapped_column(Numeric, nullable=True)
    event_date: Mapped[date] = mapped_column(Date, nullable=True)
    woreda: Mapped[str] = mapped_column(String, nullable=True)


class G2PActivityProjectionFieldWork(G2PActivityProjection):
    __tablename__ = "g2p_activity_projection_field_works"
    __table_args__ = {"extend_existing": True}

    plot_id: Mapped[str] = mapped_column(String, nullable=True)
    season: Mapped[str] = mapped_column(String, nullable=True)
    stage: Mapped[str] = mapped_column(String, nullable=True)
    area_sown_ha: Mapped[float] = mapped_column(Numeric, nullable=True)
    woreda: Mapped[str] = mapped_column(String, nullable=True)


class G2PActivityDomainServiceFieldWork(G2PActivityDomainService):
    def build_context(self, activity_type, subject_type, subject_id, payload):
        if payload.get("plot_id") and payload.get("season"):
            return {
                "context_key": f"{payload['plot_id']}|{payload['season']}",
                "context_type": "PLOT_SEASON",
                "subject_type": subject_type,
                "subject_id": subject_id,
                "attributes": {"plot_id": payload["plot_id"], "season": payload["season"]},
            }
        return None

    def project(self, context, activities):
        stage = activities[-1].activity_type
        sown = [a for a in activities if a.activity_type == "SOWN"]
        return {
            "plot_id": (context.attributes or {}).get("plot_id"),
            "season": (context.attributes or {}).get("season"),
            "stage": stage,
            "area_sown_ha": sown[-1].area_ha if sown else None,
            "woreda": activities[-1].woreda,
        }

    async def resolve_external_reference(self, rule, value):
        if value.startswith("DOWN-"):
            return None
        return {"found": value.startswith("LND-")}


extensions = types.ModuleType("openg2p_registry_extensions")
register_domain = types.ModuleType("openg2p_registry_extensions.register_domain")
models_module = types.ModuleType("openg2p_registry_extensions.register_domain.models")
services_module = types.ModuleType("openg2p_registry_extensions.register_domain.services")
models_module.G2PActivityFieldWork = G2PActivityFieldWork
models_module.G2PActivityProjectionFieldWork = G2PActivityProjectionFieldWork
services_module.G2PActivityDomainServiceFieldWork = G2PActivityDomainServiceFieldWork
sys.modules.update(
    {
        "openg2p_registry_extensions": extensions,
        "openg2p_registry_extensions.register_domain": register_domain,
        "openg2p_registry_extensions.register_domain.models": models_module,
        "openg2p_registry_extensions.register_domain.services": services_module,
    }
)

REGISTER_ID = "reg-fieldwork"

SOWN_SCHEMA = {
    "type": "object",
    "required": ["plot_id", "season", "crop", "area_ha"],
    "properties": {
        "plot_id": {"type": "string"},
        "season": {"type": "string", "enum": ["MEHER", "BELG"]},
        "crop": {"type": "string"},
        "area_ha": {"type": "number", "exclusiveMinimum": 0, "maximum": 1000},
        "event_date": {"type": "string", "format": "date"},
        "woreda": {"type": "string"},
    },
}


async def _prepare_database():
    engine = create_async_engine(DB_URL)
    try:
        async with engine.begin() as conn:
            await conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
            await conn.execute(text("CREATE SCHEMA public"))
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
    except Exception:
        await engine.dispose()
        return None
    dbengine.set(engine)

    from openg2p_registry_core.models import (
        G2PActivityContext,
        G2PActivityIdempotencyKey,
        G2PActivityIndicator,
        G2PActivityOdkFailure,
        G2PActivityOdkForm,
        G2PActivityOutbox,
        G2PActivityPeriodLock,
        G2PActivityTemporaryReference,
        G2PActivityType,
        G2PAttribute,
        G2PAttributeValue,
        G2PRegisterDefinition,
    )
    from openg2p_registry_core.services import G2PActivityPartitionService

    for model in (
        G2PRegisterDefinition,
        G2PActivityType,
        G2PActivityContext,
        G2PActivityPeriodLock,
        G2PActivityIdempotencyKey,
        G2PActivityOutbox,
        G2PActivityTemporaryReference,
        G2PActivityIndicator,
        G2PActivityOdkForm,
        G2PActivityOdkFailure,
        G2PAttribute,
        G2PAttributeValue,
    ):
        await model.create_migrate()
    partitions = G2PActivityPartitionService()
    await partitions.ensure_activity_table(G2PActivityFieldWork)
    await partitions.ensure_projection_table(G2PActivityProjectionFieldWork)

    async with engine.begin() as conn:
        await conn.execute(
            text(
                "INSERT INTO g2p_register_definitions (register_id, register_mnemonic, register_subject, "
                "register_purpose, functional_id_generation_required, has_image, dedup_is_enabled, "
                "completion_score_required, outgest_applicable, requires_registrant_authentication) "
                "VALUES (:id, 'FieldWork', 'Field work', 'ACTIVITY', false, false, false, false, false, false)"
            ),
            {"id": REGISTER_ID},
        )
        await conn.execute(
            text(
                "INSERT INTO g2p_attributes (attribute_id, attribute_code, attribute_display, is_hierarchical) "
                "VALUES ('attr-crop', 'CROP', 'Crop', false)"
            )
        )
        for code, display in (("TEFF", "Teff"), ("MAIZE", "Maize")):
            await conn.execute(
                text(
                    "INSERT INTO g2p_attribute_values (value_id, attribute_id, value_code, value_display, sort_order) "
                    "VALUES (:id, 'attr-crop', :code, :display, 0)"
                ),
                {"id": f"val-{code}", "code": code, "display": display},
            )
    return engine


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def database():
    engine = await _prepare_database()
    if engine is None:
        pytest.skip(f"PostgreSQL not reachable at {DB_URL}")
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(loop_scope="session")
async def activity_types(database):
    """(Re)seed activity types for each test and clear activity data."""
    from openg2p_registry_core.services import G2PActivityReferenceService

    async with database.begin() as conn:
        for table in (
            "g2p_activity_field_works",
            "g2p_activity_projection_field_works",
            "g2p_activity_contexts",
            "g2p_activity_idempotency_keys",
            "g2p_activity_outbox",
            "g2p_activity_period_locks",
            "g2p_activity_temporary_references",
            "g2p_activity_types",
            "g2p_activity_indicators",
            "g2p_activity_odk_forms",
            "g2p_activity_odk_failures",
        ):
            # TRUNCATE bypasses the append-only row trigger, as intended for tests.
            await conn.execute(text(f"TRUNCATE {table}"))
        await conn.execute(
            text(
                "INSERT INTO g2p_activity_types (activity_type_id, register_id, activity_type, display_name, "
                "payload_schema, requires_context, is_repeatable, uniqueness_fields, requires_prior_types, "
                "sequence_enforcement, due_rule, max_backdate_days, allow_future_dated, requires_verification, "
                "reference_rules, ethiopian_date_fields, is_active) VALUES "
                "('t-planned', :r, 'PLANNED', 'Planned', NULL, true, false, NULL, NULL, 'WARN', NULL, 365, false, "
                " false, NULL, NULL, true),"
                "('t-sown', :r, 'SOWN', 'Sown', CAST(:sown_schema AS JSONB), true, true, CAST('[\"crop\"]' AS JSONB), "
                " CAST('[\"PLANNED\"]' AS JSONB), 'WARN', NULL, 365, false, true, CAST(:sown_refs AS JSONB), "
                " CAST('[\"event_date\"]' AS JSONB), true),"
                "('t-harvested', :r, 'HARVESTED', 'Harvested', NULL, true, false, NULL, CAST('[\"SOWN\"]' AS JSONB), "
                " 'BLOCK', CAST('{\"after_type\": \"SOWN\", \"min_days\": 90, \"max_days\": 150}' AS JSONB), 365, "
                " false, false, NULL, NULL, true),"
                "('t-note', :r, 'NOTE', 'Note', NULL, false, true, NULL, NULL, 'WARN', NULL, NULL, false, false, "
                " NULL, NULL, true)"
            ),
            {
                "r": REGISTER_ID,
                "sown_schema": __import__("json").dumps(SOWN_SCHEMA),
                "sown_refs": __import__("json").dumps(
                    {
                        "crop": {"kind": "ATTRIBUTE", "attribute": "CROP", "mode": "STRICT"},
                        "plot_id": {
                            "kind": "EXTERNAL",
                            "system": "farmer-registry.land",
                            "mode": "LENIENT",
                            "temporary_prefix": "TMP-",
                        },
                    }
                ),
            },
        )
    # Fresh caches per test (attribute labels are cached).
    G2PActivityReferenceService.get_component  # noqa: B018
    yield


@pytest.fixture
def service(database):
    from openg2p_registry_core.services import G2PActivityService

    svc = G2PActivityService()
    svc.references._cache._values.clear()
    return svc
