"""DDL for activity tables: yearly range partitions and the append-only guard.

``create_all`` creates the partitioned parent table (the model declares
``PARTITION BY RANGE (occurred_at)``). This service adds:

* one partition per calendar year, from ``activity_partition_years_back``
  years ago to next year, plus a DEFAULT partition for anything outside;
* a trigger that rejects DELETE and any UPDATE touching columns other than the
  status and verification columns — the database-level half of "append-only";
* columns a newer platform version added to a model but an existing table
  lacks (``create_all`` never alters a table), so a deployed register picks up
  new activity fields on upgrade;
* on ``g2p_activity_types``, a trigger that increments ``schema_version`` when
  ``payload_schema`` changes and keeps every version in
  ``g2p_activity_type_schemas``.

Everything is idempotent, so it runs on every ``migrate`` and from the daily
maintenance task.
"""

import logging
from datetime import datetime

from openg2p_fastapi_common.context import dbengine
from openg2p_fastapi_common.service import BaseService
from sqlalchemy import text
from sqlalchemy.dialects import postgresql

from ..config import Settings

_config = Settings.get_config(strict=False)
_logger = logging.getLogger("g2p-activity-partition-service")

# Columns that may change after insert. Everything else is immutable.
MUTABLE_ACTIVITY_COLUMNS = (
    "status",
    "status_reason",
    "status_changed_by",
    "status_changed_at",
    "superseded_by_activity_id",
    "verification_status",
    "verified_by",
    "verified_at",
    "verification_remarks",
)

_GUARD_FUNCTION = """
CREATE OR REPLACE FUNCTION g2p_activity_append_only_guard() RETURNS trigger AS $$
DECLARE
    mutable text[] := ARRAY[{mutable}];
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Activity rows are append-only: DELETE is not allowed on %', TG_TABLE_NAME
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF (to_jsonb(NEW) - mutable) IS DISTINCT FROM (to_jsonb(OLD) - mutable) THEN
        RAISE EXCEPTION 'Activity rows are append-only: only status and verification columns may change on %',
            TG_TABLE_NAME
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
""".format(mutable=", ".join(f"'{column}'" for column in MUTABLE_ACTIVITY_COLUMNS))


_SCHEMA_VERSION_FUNCTION = """
CREATE OR REPLACE FUNCTION g2p_activity_type_schema_version() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.payload_schema IS DISTINCT FROM OLD.payload_schema THEN
            NEW.schema_version := COALESCE(OLD.schema_version, 1) + 1;
        ELSE
            NEW.schema_version := OLD.schema_version;
        END IF;
    ELSE
        NEW.schema_version := COALESCE(NEW.schema_version, 1);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

_SCHEMA_HISTORY_FUNCTION = """
CREATE OR REPLACE FUNCTION g2p_activity_type_schema_history() RETURNS trigger AS $$
BEGIN
    INSERT INTO g2p_activity_type_schemas
        (activity_type_id, schema_version, register_id, activity_type, payload_schema, created_at)
    VALUES (NEW.activity_type_id, NEW.schema_version, NEW.register_id, NEW.activity_type, NEW.payload_schema,
            now() AT TIME ZONE 'utc')
    ON CONFLICT (activity_type_id, schema_version) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""


class G2PActivityPartitionService(BaseService):
    async def add_missing_columns(self, model) -> list[str]:
        """Add the model's columns that the existing table lacks. Returns the columns added.

        New columns are added nullable unless they carry a server default, so
        existing rows stay valid. On a partitioned parent the column reaches
        every partition.
        """
        table = model.__table__
        dialect = postgresql.dialect()
        async with dbengine.get().begin() as conn:
            existing = set(
                (
                    await conn.execute(
                        text("SELECT column_name FROM information_schema.columns "
                             "WHERE table_schema = current_schema() AND table_name = :name"),
                        {"name": table.name},
                    )
                ).scalars()
            )
            if not existing:
                return []  # no table yet: create_migrate creates it whole
            added = []
            for column in table.columns:
                if column.name in existing:
                    continue
                ddl = f'ALTER TABLE "{table.name}" ADD COLUMN IF NOT EXISTS "{column.name}" ' + column.type.compile(
                    dialect=dialect
                )
                default = column.server_default
                if default is not None:
                    value = getattr(default.arg, "text", default.arg)
                    ddl += f" DEFAULT {value}"
                    if not column.nullable:
                        ddl += " NOT NULL"
                await conn.execute(text(ddl))
                added.append(column.name)
        if added:
            _logger.info("Added columns to %s: %s", table.name, added)
        return added

    async def ensure_activity_type_versioning(self) -> None:
        """Schema-version triggers on g2p_activity_types, and a history row for every current version."""
        async with dbengine.get().begin() as conn:
            await conn.execute(text(_SCHEMA_VERSION_FUNCTION))
            await conn.execute(text(_SCHEMA_HISTORY_FUNCTION))
            await conn.execute(text('DROP TRIGGER IF EXISTS "trg_activity_type_schema_version" ON g2p_activity_types'))
            await conn.execute(
                text(
                    'CREATE TRIGGER "trg_activity_type_schema_version" BEFORE INSERT OR UPDATE ON g2p_activity_types '
                    "FOR EACH ROW EXECUTE FUNCTION g2p_activity_type_schema_version()"
                )
            )
            await conn.execute(text('DROP TRIGGER IF EXISTS "trg_activity_type_schema_history" ON g2p_activity_types'))
            await conn.execute(
                text(
                    'CREATE TRIGGER "trg_activity_type_schema_history" AFTER INSERT OR UPDATE ON g2p_activity_types '
                    "FOR EACH ROW EXECUTE FUNCTION g2p_activity_type_schema_history()"
                )
            )
            await conn.execute(
                text(
                    "INSERT INTO g2p_activity_type_schemas "
                    "(activity_type_id, schema_version, register_id, activity_type, payload_schema, created_at) "
                    "SELECT activity_type_id, schema_version, register_id, activity_type, payload_schema, "
                    "now() AT TIME ZONE 'utc' FROM g2p_activity_types "
                    "ON CONFLICT (activity_type_id, schema_version) DO NOTHING"
                )
            )

    async def ensure_activity_table(self, activity_model, years: list[int] | None = None) -> None:
        """Create the partitioned parent table (if missing), yearly partitions, indexes and the guard trigger."""
        table = activity_model.__table__
        table_name = activity_model.__tablename__
        table.dialect_options["postgresql"]["partition_by"] = "RANGE (occurred_at)"
        await activity_model.create_migrate()
        await self.add_missing_columns(activity_model)
        years = years or self.default_years()
        async with dbengine.get().begin() as conn:
            partitioned = (
                await conn.execute(
                    text("SELECT count(*) FROM pg_partitioned_table p JOIN pg_class c ON c.oid = p.partrelid "
                         "WHERE c.relname = :name"),
                    {"name": table_name},
                )
            ).scalar()
            if not partitioned:
                raise RuntimeError(
                    f"{table_name} exists but is not partitioned; it was created before activity partitioning "
                    "and must be recreated"
                )
            await conn.execute(
                text(
                    f'CREATE INDEX IF NOT EXISTS "idx_{table_name}_search_text_trigram" ON "{table_name}" '
                    "USING gin (search_text gin_trgm_ops)"
                )
            )
            await conn.execute(
                text(
                    f'CREATE INDEX IF NOT EXISTS "idx_{table_name}_context_occurred" ON "{table_name}" '
                    "(context_id, occurred_at)"
                )
            )
            await conn.execute(
                text(
                    f'CREATE INDEX IF NOT EXISTS "idx_{table_name}_subject_ancestors" ON "{table_name}" '
                    "USING gin (subject_ancestor_record_ids jsonb_path_ops)"
                )
            )
            await conn.execute(text(_GUARD_FUNCTION))
            for year in years:
                await conn.execute(text(self._partition_ddl(table_name, year)))
            await conn.execute(
                text(f'CREATE TABLE IF NOT EXISTS "{table_name}_default" PARTITION OF "{table_name}" DEFAULT')
            )
            await conn.execute(text(f'DROP TRIGGER IF EXISTS "trg_{table_name}_append_only" ON "{table_name}"'))
            await conn.execute(
                text(
                    f'CREATE TRIGGER "trg_{table_name}_append_only" BEFORE UPDATE OR DELETE ON "{table_name}" '
                    "FOR EACH ROW EXECUTE FUNCTION g2p_activity_append_only_guard()"
                )
            )
        _logger.info("Activity table %s ready with partitions for %s", table_name, years)

    async def ensure_projection_table(self, projection_model) -> None:
        await projection_model.create_migrate()
        await self.add_missing_columns(projection_model)

    @staticmethod
    def default_years(now: datetime | None = None) -> list[int]:
        current = (now or datetime.utcnow()).year
        back = max(int(_config.activity_partition_years_back), 0)
        return list(range(current - back, current + 2))

    @staticmethod
    def _partition_ddl(table_name: str, year: int) -> str:
        # A new yearly partition cannot be attached if the DEFAULT partition
        # already holds rows for that year; creating partitions ahead of time
        # (next year is always included) keeps DEFAULT for out-of-range dates only.
        return (
            f'CREATE TABLE IF NOT EXISTS "{table_name}_y{year}" PARTITION OF "{table_name}" '
            f"FOR VALUES FROM ('{year}-01-01') TO ('{year + 1}-01-01')"
        )
