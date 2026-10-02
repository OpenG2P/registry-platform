"""Shared dual-validation helpers for API scenarios."""

from __future__ import annotations

from typing import Any

from assertions import db as db_assert
from assertions.response import assert_values_equal
from helpers.config import (
    HOUSEHOLD_HOUSING_SERVICES_TAB_ID,
    INDIVIDUAL_LIVELIHOOD_TAB_ID,
    REGISTER_HOUSEHOLD_ASSET,
    REGISTER_HOUSEHOLD_HOUSING,
    REGISTER_INDIVIDUAL_LAND,
    REGISTER_INDIVIDUAL_LIVELIHOOD,
)
from helpers.flows.register import get_section_records_from_tab, get_subject_record
from helpers.http import StaffClient
from helpers.profiles import RegisterProfile

# supporting_key → (section_register_id, register UI tab_id, db fetch fn)
_SUPPORTING_SPECS: dict[str, dict[str, Any]] = {
    "individual_land": {
        "section_register_id": REGISTER_INDIVIDUAL_LAND,
        "tab_id": INDIVIDUAL_LIVELIHOOD_TAB_ID,
        "fetch_db": db_assert.fetch_individual_land_by_link,
        "match_fields": ("land_access", "land_size", "productive_assets"),
        "history_table": "g2p_register_history_individual_land",
        "history_extra_columns": "land_access, land_size",
    },
    "individual_livelihood": {
        "section_register_id": REGISTER_INDIVIDUAL_LIVELIHOOD,
        "tab_id": INDIVIDUAL_LIVELIHOOD_TAB_ID,
        "fetch_db": db_assert.fetch_individual_livelihood_by_link,
        "match_fields": (
            "primary_livelihood",
            "secondary_livelihood",
            "employment_status",
            "coping_strategies_index",
            "mobile_phone_type",
        ),
        "history_table": "g2p_register_history_individual_livelihoods",
        "history_extra_columns": "primary_livelihood, employment_status, mobile_phone_type",
    },
    "household_assets": {
        "section_register_id": REGISTER_HOUSEHOLD_ASSET,
        "tab_id": HOUSEHOLD_HOUSING_SERVICES_TAB_ID,
        "fetch_db": db_assert.fetch_household_assets_by_link,
        "match_fields": ("asset_type", "asset_category", "quantity", "size_band"),
        "history_table": "g2p_register_history_household_assets",
        "history_extra_columns": "asset_type, quantity",
    },
    "household_housing": {
        "section_register_id": REGISTER_HOUSEHOLD_HOUSING,
        "tab_id": HOUSEHOLD_HOUSING_SERVICES_TAB_ID,
        "fetch_db": db_assert.fetch_household_housing_by_link,
        "match_fields": (
            "dwelling_type",
            "roof_material",
            "wall_material",
            "floor_material",
            "tenure_status",
            "water_source_type",
            "water_distance_minutes",
            "sanitation_type",
            "lighting_source",
            "cooking_fuel_type",
        ),
        "history_table": "g2p_register_history_household_housing_and_services",
        "history_extra_columns": "dwelling_type, tenure_status, water_source_type",
    },
}


def fetch_subject_db(dsn: str, profile: RegisterProfile, internal_record_id: str) -> dict[str, Any]:
    if profile.key == "household":
        row = db_assert.fetch_household_by_id(dsn, internal_record_id)
    else:
        row = db_assert.fetch_individual_by_id(dsn, internal_record_id)
    assert row, f"{profile.key} {internal_record_id} missing in DB"
    return row


def fetch_subject_db_by_identity(
    dsn: str, profile: RegisterProfile, identity: str
) -> dict[str, Any]:
    if profile.key == "household":
        row = db_assert.fetch_household_by_head_name(dsn, identity)
    else:
        row = db_assert.fetch_individual_by_first_name(dsn, identity)
    assert row, f"{profile.key} identity={identity!r} missing in DB"
    return row


def assert_api_db_subject_match(
    staff: StaffClient,
    cfg_dsn: str,
    profile: RegisterProfile,
    internal_record_id: str,
    *,
    expected_fields: dict[str, Any] | None = None,
    context: str = "",
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Load subject via API + DB and require profile.match_fields to be equal."""
    api_record = get_subject_record(staff, profile, internal_record_id)
    db_row = fetch_subject_db(cfg_dsn, profile, internal_record_id)
    label = context or f"{profile.key}:{internal_record_id}"

    for field in profile.match_fields:
        api_val = api_record.get(field)
        db_val = db_row.get(field)
        if expected_fields and field in expected_fields:
            assert_values_equal(
                expected_fields[field], api_val, field=f"API.{field}", context=label
            )
            assert_values_equal(
                expected_fields[field], db_val, field=f"DB.{field}", context=label
            )
        assert_values_equal(api_val, db_val, field=field, context=label)

    return api_record, db_row


def assert_intake_api_db(
    dsn: str,
    submission_id: str,
    *,
    form_id: str,
    register_id: str,
    draft_status: str,
    approval_status: str,
    api_payload: dict[str, Any],
    context: str = "",
) -> dict[str, Any]:
    """Strictly match intake submission API payload against DB row."""
    row = db_assert.fetch_intake_submission(dsn, submission_id)
    assert row, f"{context}: submission {submission_id} not in DB"

    assert_values_equal(
        api_payload.get("draft_status"),
        row.get("draft_status"),
        field="draft_status",
        context=context,
    )
    assert_values_equal(
        api_payload.get("approval_status"),
        row.get("approval_status"),
        field="approval_status",
        context=context,
    )
    assert str(row.get("form_id")) == form_id, (
        f"{context}: form_id DB={row.get('form_id')!r} expected {form_id!r}"
    )
    assert str(row.get("register_id")) == register_id, (
        f"{context}: register_id DB={row.get('register_id')!r} expected {register_id!r}"
    )
    assert str(row.get("draft_status") or "").upper() == draft_status.upper()
    assert str(row.get("approval_status") or "").upper() == approval_status.upper()
    if draft_status.upper() == "FINAL":
        assert row.get("finalized_at") is not None, f"{context}: finalized_at missing"
    return row


def _row_matches_expected(
    row: dict[str, Any], expected: dict[str, Any], fields: tuple[str, ...]
) -> bool:
    for field in fields:
        if field not in expected:
            continue
        try:
            assert_values_equal(expected[field], row.get(field), field=field, context="match")
        except AssertionError:
            return False
    return True


def assert_supporting_api_db(
    staff: StaffClient,
    dsn: str,
    profile: RegisterProfile,
    subject_internal_record_id: str,
    supporting: dict[str, list[dict[str, Any]]],
    *,
    context: str = "",
) -> None:
    """Dual-assert child TABLE rows (expected ↔ get_tab_records ↔ DB)."""
    label = context or f"{profile.key}:{subject_internal_record_id}:supporting"

    for key, expected_rows in supporting.items():
        spec = _SUPPORTING_SPECS.get(key)
        assert spec, f"{label}: unknown supporting key {key!r}"
        fields: tuple[str, ...] = spec["match_fields"]
        section_register_id = spec["section_register_id"]
        tab_id = spec["tab_id"]

        def _ready():
            api_rows = get_section_records_from_tab(
                staff,
                profile,
                subject_internal_record_id,
                tab_id=tab_id,
                section_register_id=section_register_id,
            )
            db_rows = spec["fetch_db"](dsn, subject_internal_record_id)
            if len(api_rows) >= len(expected_rows) and len(db_rows) >= len(expected_rows):
                return api_rows, db_rows
            return None

        api_rows, db_rows = db_assert.wait_until(
            _ready,
            timeout_s=90.0,
            interval_s=3.0,
            description=f"{label}:{key} rows present",
        )

        assert len(api_rows) >= len(expected_rows), (
            f"{label}:{key}: API rows={len(api_rows)} expected>={len(expected_rows)}"
        )
        assert len(db_rows) >= len(expected_rows), (
            f"{label}:{key}: DB rows={len(db_rows)} expected>={len(expected_rows)}"
        )

        for i, expected in enumerate(expected_rows):
            api_hit = next(
                (r for r in api_rows if _row_matches_expected(r, expected, fields)),
                None,
            )
            assert api_hit, (
                f"{label}:{key}[{i}]: no API row matching {expected!r}; api={api_rows!r}"
            )
            db_hit = next(
                (r for r in db_rows if _row_matches_expected(r, expected, fields)),
                None,
            )
            assert db_hit, (
                f"{label}:{key}[{i}]: no DB row matching {expected!r}; db={db_rows!r}"
            )

            link_api = api_hit.get("link_internal_record_id") or subject_internal_record_id
            assert_values_equal(
                subject_internal_record_id,
                link_api,
                field="link_internal_record_id",
                context=f"{label}:{key}[{i}]:API",
            )
            assert_values_equal(
                subject_internal_record_id,
                db_hit.get("link_internal_record_id"),
                field="link_internal_record_id",
                context=f"{label}:{key}[{i}]:DB",
            )

            for field in fields:
                if field not in expected:
                    continue
                assert_values_equal(
                    expected[field],
                    api_hit.get(field),
                    field=f"API.{field}",
                    context=f"{label}:{key}[{i}]",
                )
                assert_values_equal(
                    expected[field],
                    db_hit.get(field),
                    field=f"DB.{field}",
                    context=f"{label}:{key}[{i}]",
                )
                assert_values_equal(
                    api_hit.get(field),
                    db_hit.get(field),
                    field=field,
                    context=f"{label}:{key}[{i}]",
                )


def assert_subject_history_for_cr(
    dsn: str,
    profile: RegisterProfile,
    *,
    change_request_id: str,
    subject_internal_record_id: str,
    field_name: str,
    expected_new_value: Any,
    context: str = "",
) -> dict[str, Any]:
    """After subject CR approve: history row linked to the CR.

    Domain field values are asserted only when ``profile.history_persists_cr_field``
    is True (field declared on the history schema). Live-register application is
    covered separately by ``assert_api_db_subject_match``.
    """
    label = context or f"{profile.key}:history:{change_request_id}"

    def _ready():
        return db_assert.fetch_subject_history_by_change_request(
            dsn, profile_key=profile.key, change_request_id=change_request_id
        )

    row = db_assert.wait_until(
        _ready,
        timeout_s=60.0,
        interval_s=2.0,
        description=f"{label} history row",
    )
    assert_values_equal(
        change_request_id,
        row.get("change_request_id"),
        field="change_request_id",
        context=label,
    )
    assert_values_equal(
        subject_internal_record_id,
        row.get("subject_internal_record_id") or row.get("internal_record_id"),
        field="subject_internal_record_id",
        context=label,
    )
    if profile.history_persists_cr_field:
        assert_values_equal(
            expected_new_value,
            row.get(field_name),
            field=f"history.{field_name}",
            context=label,
        )
    return row


def assert_supporting_history_for_cr(
    dsn: str,
    *,
    supporting_key: str,
    change_request_id: str,
    context: str = "",
) -> dict[str, Any]:
    """After supporting TABLE CR approve: history row linked to the CR.

    Child TABLE history schemas are core-only (no domain fields), so we assert
    linkage — not land_size/quantity/etc. Live-register application is covered
    by ``assert_supporting_api_db``.
    """
    spec = _SUPPORTING_SPECS.get(supporting_key)
    assert spec, f"unknown supporting key {supporting_key!r}"
    label = context or f"{supporting_key}:history:{change_request_id}"

    def _ready():
        return db_assert.fetch_supporting_history_by_change_request(
            dsn,
            history_table=spec["history_table"],
            change_request_id=change_request_id,
            extra_columns="",
        )

    row = db_assert.wait_until(
        _ready,
        timeout_s=60.0,
        interval_s=2.0,
        description=f"{label} history row",
    )
    assert_values_equal(
        change_request_id,
        row.get("change_request_id"),
        field="change_request_id",
        context=label,
    )
    return row


def supporting_spec(supporting_key: str) -> dict[str, Any]:
    spec = _SUPPORTING_SPECS.get(supporting_key)
    assert spec, f"unknown supporting key {supporting_key!r}"
    return spec
