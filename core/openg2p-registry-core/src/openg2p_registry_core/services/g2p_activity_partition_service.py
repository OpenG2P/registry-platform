"""DDL for activity tables: yearly range partitions and the append-only guard.

``create_all`` creates the partitioned parent table (the model declares
``PARTITION BY RANGE (occurred_at)``). This service adds:

* one partition per calendar year, from ``activity_partition_years_back``
  years ago to next year, plus a DEFAULT partition for anything outside;
* a trigger that rejects DELETE and any UPDATE touching columns other than the
  status and verification columns — the database-level half of "append-only".

Everything is idempotent, so it runs on every ``migrate`` and from the daily
maintenance task.
"""

import logging
from datetime import datetime

from openg2p_fastapi_common.context import dbengine
from openg2p_fastapi_common.service import BaseService
from sqlalchemy import text

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


class G2PActivityPartitionService(BaseService):
    async def ensure_activity_table(self, activity_model, years: list[int] | None = None) -> None:
        """Create the partitioned parent table (if missing), yearly partitions, indexes and the guard trigger."""
        table = activity_model.__table__
        table_name = activity_model.__tablename__
        table.dialect_options["postgresql"]["partition_by"] = "RANGE (occurred_at)"
        await activity_model.create_migrate()
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
