"""Postgres assertions for Individual + Household register rows."""

from __future__ import annotations

import time
from typing import Any, Callable, Optional

import pytest

try:
    import psycopg
except ImportError:  # pragma: no cover
    psycopg = None  # type: ignore


def query(dsn: str, sql: str, params: tuple | None = None) -> list[dict[str, Any]]:
    if psycopg is None:
        pytest.skip("psycopg not installed")
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params or ())
            if cur.description is None:
                return []
            cols = [c.name for c in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]


def fetch_intake_submission(dsn: str, submission_id: str) -> Optional[dict[str, Any]]:
    rows = query(
        dsn,
        """
        SELECT submission_id, form_id, register_id,
               draft_status, approval_status, finalized_at, approved_at,
               number_of_verifications_required, number_of_verifications_done
        FROM g2p_intake_form_submissions
        WHERE submission_id = %s
        """,
        (submission_id,),
    )
    return rows[0] if rows else None


def fetch_individual_by_id(dsn: str, internal_record_id: str) -> Optional[dict[str, Any]]:
    rows = query(
        dsn,
        """
        SELECT internal_record_id, first_name, middle_name, last_name,
               gender, birth_date, marital_status, record_status,
               address_line_1, postal_code, country_code,
               relationship_to_head,
               primary_livelihood, secondary_livelihood,
               employment_status, coping_strategies_index
        FROM g2p_register_individuals
        WHERE internal_record_id = %s
        """,
        (internal_record_id,),
    )
    return rows[0] if rows else None


def fetch_individual_by_first_name(dsn: str, first_name: str) -> Optional[dict[str, Any]]:
    rows = query(
        dsn,
        """
        SELECT internal_record_id, first_name, middle_name, last_name,
               gender, birth_date, marital_status, record_status,
               address_line_1, postal_code, country_code,
               relationship_to_head,
               primary_livelihood, secondary_livelihood,
               employment_status, coping_strategies_index
        FROM g2p_register_individuals
        WHERE first_name = %s
        ORDER BY created_at DESC NULLS LAST
        LIMIT 1
        """,
        (first_name,),
    )
    return rows[0] if rows else None


def fetch_household_by_id(dsn: str, internal_record_id: str) -> Optional[dict[str, Any]]:
    rows = query(
        dsn,
        """
        SELECT internal_record_id, household_head_name, headship_type,
               size_total, size_adults, size_children_u5,
               address_line_1, postal_code, country_code, record_status,
               record_name, dwelling_type, tenure_status,
               roof_material, wall_material, floor_material
        FROM g2p_register_households
        WHERE internal_record_id = %s
        """,
        (internal_record_id,),
    )
    return rows[0] if rows else None


def fetch_household_by_head_name(dsn: str, household_head_name: str) -> Optional[dict[str, Any]]:
    rows = query(
        dsn,
        """
        SELECT internal_record_id, household_head_name, headship_type,
               size_total, size_adults, size_children_u5,
               address_line_1, postal_code, country_code, record_status,
               record_name, dwelling_type, tenure_status,
               roof_material, wall_material, floor_material
        FROM g2p_register_households
        WHERE household_head_name = %s
        ORDER BY created_at DESC NULLS LAST
        LIMIT 1
        """,
        (household_head_name,),
    )
    return rows[0] if rows else None


def fetch_individual_land_by_link(
    dsn: str, link_internal_record_id: str
) -> list[dict[str, Any]]:
    return query(
        dsn,
        """
        SELECT internal_record_id, link_internal_record_id,
               land_access, land_size, productive_assets, record_status
        FROM g2p_register_individual_land
        WHERE link_internal_record_id = %s
        ORDER BY created_at DESC NULLS LAST
        """,
        (link_internal_record_id,),
    )


def fetch_household_assets_by_link(
    dsn: str, link_internal_record_id: str
) -> list[dict[str, Any]]:
    return query(
        dsn,
        """
        SELECT internal_record_id, link_internal_record_id,
               asset_type, asset_category, quantity, size_band, record_status
        FROM g2p_register_household_assets
        WHERE link_internal_record_id = %s
        ORDER BY created_at DESC NULLS LAST
        """,
        (link_internal_record_id,),
    )


def fetch_individual_livelihood_by_link(
    dsn: str, link_internal_record_id: str
) -> list[dict[str, Any]]:
    return query(
        dsn,
        """
        SELECT internal_record_id, link_internal_record_id,
               primary_livelihood, secondary_livelihood, employment_status,
               coping_strategies_index, mobile_phone_type, record_status
        FROM g2p_register_individual_livelihoods
        WHERE link_internal_record_id = %s
        ORDER BY created_at DESC NULLS LAST
        """,
        (link_internal_record_id,),
    )


def fetch_household_housing_by_link(
    dsn: str, link_internal_record_id: str
) -> list[dict[str, Any]]:
    return query(
        dsn,
        """
        SELECT internal_record_id, link_internal_record_id,
               dwelling_type, roof_material, wall_material, floor_material,
               tenure_status, water_source_type, water_distance_minutes,
               sanitation_type, lighting_source, cooking_fuel_type, record_status
        FROM g2p_register_household_housing_and_services
        WHERE link_internal_record_id = %s
        ORDER BY created_at DESC NULLS LAST
        """,
        (link_internal_record_id,),
    )


def fetch_subject_history_by_change_request(
    dsn: str,
    *,
    profile_key: str,
    change_request_id: str,
) -> Optional[dict[str, Any]]:
    """History row written on subject CR approve (stores change_payload / new values)."""
    if profile_key == "household":
        table = "g2p_register_history_households"
        field_cols = "household_head_name, headship_type"
    else:
        table = "g2p_register_history_individuals"
        field_cols = "first_name, middle_name, last_name"
    rows = query(
        dsn,
        f"""
        SELECT history_record_id, internal_record_id, subject_internal_record_id,
               change_request_id, section_id, tab_id, {field_cols},
               approved_at, approved_by
        FROM {table}
        WHERE change_request_id = %s
        ORDER BY approved_at DESC NULLS LAST
        LIMIT 1
        """,
        (change_request_id,),
    )
    return rows[0] if rows else None


def fetch_supporting_history_by_change_request(
    dsn: str,
    *,
    history_table: str,
    change_request_id: str,
    extra_columns: str = "",
) -> Optional[dict[str, Any]]:
    cols = "history_record_id, internal_record_id, link_internal_record_id, change_request_id, section_id"
    if extra_columns:
        cols = f"{cols}, {extra_columns}"
    rows = query(
        dsn,
        f"""
        SELECT {cols}
        FROM {history_table}
        WHERE change_request_id = %s
        ORDER BY approved_at DESC NULLS LAST
        LIMIT 1
        """,
        (change_request_id,),
    )
    return rows[0] if rows else None

def fetch_change_request(dsn: str, change_request_id: str) -> Optional[dict[str, Any]]:
    rows = query(
        dsn,
        """
        SELECT change_request_id, internal_record_id, section_id, tab_id,
               approval_status, register_id
        FROM g2p_register_change_requests
        WHERE change_request_id = %s
        """,
        (change_request_id,),
    )
    return rows[0] if rows else None


def fetch_individual_middle_name(dsn: str, internal_record_id: str) -> Optional[str]:
    row = fetch_individual_by_id(dsn, internal_record_id)
    if not row:
        return None
    return row.get("middle_name")


def fetch_household_head_name(dsn: str, internal_record_id: str) -> Optional[str]:
    row = fetch_household_by_id(dsn, internal_record_id)
    if not row:
        return None
    return row.get("household_head_name")


def wait_until(
    predicate: Callable[[], Any],
    *,
    timeout_s: float = 60.0,
    interval_s: float = 2.0,
    description: str = "condition",
) -> Any:
    """Poll until predicate returns a truthy value or timeout."""
    deadline = time.time() + timeout_s
    last: Any = None
    while time.time() < deadline:
        last = predicate()
        if last:
            return last
        time.sleep(interval_s)
    raise AssertionError(f"timed out waiting for {description} after {timeout_s}s (last={last!r})")
