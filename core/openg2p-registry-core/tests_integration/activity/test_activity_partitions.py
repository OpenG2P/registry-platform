"""Yearly partitions when the DEFAULT partition already holds rows for the year.

An activity dated outside the existing yearly partitions lands in DEFAULT.
Creating that year's partition later must move those rows instead of failing
("updated partition constraint for default partition would be violated").
"""

import uuid
from datetime import datetime

import pytest
from sqlalchemy import text

from openg2p_registry_core.services import G2PActivityPartitionService

from .conftest import G2PActivityFieldWork

pytestmark = pytest.mark.asyncio(loop_scope="session")

TABLE = G2PActivityFieldWork.__tablename__
YEAR = 2150  # far outside default_years(): only DEFAULT can take it


async def _insert(conn, occurred_at: datetime) -> str:
    activity_id = str(uuid.uuid4())
    await conn.execute(
        text(
            f'INSERT INTO "{TABLE}" (activity_id, occurred_at, activity_type, recorded_at, recorded_by, channel, '
            "status, verification_status, payload) VALUES (:id, :at, 'SOWN', "
            "now() AT TIME ZONE 'utc', 'test', 'STAFF_PORTAL', 'ACTIVE', 'NOT_REQUIRED', '{}'::jsonb)"
        ),
        {"id": activity_id, "at": occurred_at},
    )
    return activity_id


async def _home(conn, activity_id: str) -> str:
    return (
        await conn.execute(
            text(f'SELECT tableoid::regclass::text FROM "{TABLE}" WHERE activity_id = :id'), {"id": activity_id}
        )
    ).scalar()


async def test_partition_for_year_with_rows_in_default_moves_them(database):
    async with database.begin() as conn:
        in_year = await _insert(conn, datetime(YEAR, 6, 15, 10))
        other = await _insert(conn, datetime(YEAR + 5, 1, 1))
        assert await _home(conn, in_year) == f"{TABLE}_default"

    partitions = G2PActivityPartitionService()
    assert await partitions.ensure_year_partition(TABLE, YEAR) is True

    async with database.begin() as conn:
        assert await _home(conn, in_year) == f"{TABLE}_y{YEAR}"
        assert await _home(conn, other) == f"{TABLE}_default"
        # DEFAULT is attached again and still takes out-of-range rows.
        late = await _insert(conn, datetime(YEAR + 7, 3, 1))
        assert await _home(conn, late) == f"{TABLE}_default"
        # The append-only guard is back on both the moved rows and DEFAULT.
        for activity_id in (in_year, other):
            with pytest.raises(Exception, match="append-only"):
                async with conn.begin_nested():
                    await conn.execute(text(f'DELETE FROM "{TABLE}" WHERE activity_id = :id'), {"id": activity_id})

    # Idempotent: a second run (and the full ensure) is a no-op that succeeds.
    assert await partitions.ensure_year_partition(TABLE, YEAR) is False
    await partitions.ensure_activity_table(G2PActivityFieldWork, years=[YEAR, YEAR + 5])
    async with database.begin() as conn:
        assert await _home(conn, in_year) == f"{TABLE}_y{YEAR}"
        assert await _home(conn, other) == f"{TABLE}_y{YEAR + 5}"
        assert await _home(conn, late) == f"{TABLE}_default"


async def test_ensure_partitions_for_dates_creates_missing_years(database):
    partitions = G2PActivityPartitionService()
    created = await partitions.ensure_partitions_for_dates(TABLE, [datetime(YEAR + 20, 1, 1), None])
    assert created == [YEAR + 20]
    assert await partitions.ensure_partitions_for_dates(TABLE, [datetime(YEAR + 20, 5, 5)]) == []
    async with database.begin() as conn:
        activity_id = await _insert(conn, datetime(YEAR + 20, 7, 1))
        assert await _home(conn, activity_id) == f"{TABLE}_y{YEAR + 20}"
