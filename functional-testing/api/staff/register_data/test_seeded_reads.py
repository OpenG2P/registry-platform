"""Staff Tier-1: register-data reads against deterministic functional seed."""

from __future__ import annotations

import pytest

from assertions.dual import assert_api_db_subject_match, assert_supporting_api_db
from assertions.response import assert_success, assert_values_equal
from profile_params import with_register_profiles
from helpers.config import (
    Config,
    DEMOGRAPHIC_SECTION_ID,
    HH_COMPOSITION_HEADSHIP_SECTION_ID,
    REGISTER_HOUSEHOLD_ASSET,
    REGISTER_INDIVIDUAL_LAND,
)
from helpers.flows.register import (
    hit_matches_identity,
    search_register_by_text,
)
from helpers.http import StaffClient
from helpers.profiles import RegisterProfile
from helpers.seed_manifest import subject, supporting_rows


def _seed_supporting_key(profile: RegisterProfile) -> str:
    return "individual_land" if profile.key == "individual" else "household_assets"


def _seed_supporting_expected(profile: RegisterProfile) -> dict[str, list[dict]]:
    key = _seed_supporting_key(profile)
    rows = []
    for entry in supporting_rows(key):
        fields = dict(entry["fields"])
        fields.pop("record_status", None)
        rows.append(fields)
    return {key: rows}


@pytest.mark.tier1
@pytest.mark.register
@with_register_profiles
def test_seeded_search_and_subject_dual_assert(
    staff: StaffClient,
    cfg: Config,
    step,
    profile: RegisterProfile,
):
    """search_in_a_register + get_subject_record ↔ DB for seed subjects."""
    seeded = subject(profile.key)
    rid = seeded["internal_record_id"]
    identity = seeded["identity_value"]
    term = seeded["search_terms"][0]

    step(f"search_in_a_register term={term!r}")
    hits = search_register_by_text(staff, term, register_id=profile.register_id)
    assert any(
        hit_matches_identity(h, identity) and h.get("internal_record_id") == rid
        for h in hits
    ), f"seed subject {rid} not in search hits for {term!r}: {hits!r}"

    step(f"get_subject_record + DB dual-assert {rid}")
    assert_api_db_subject_match(
        staff,
        cfg.registry_dsn,
        profile,
        rid,
        expected_fields=seeded["fields"],
        context=f"tier1_seeded_subject:{profile.key}",
    )


@pytest.mark.tier1
@pytest.mark.register
@with_register_profiles
def test_seeded_summary_section_and_supporting_tabs(
    staff: StaffClient,
    cfg: Config,
    step,
    profile: RegisterProfile,
):
    """get_register_summary_data, get_section_records, supporting get_tab_records."""
    seeded = subject(profile.key)
    rid = seeded["internal_record_id"]

    step("get_register_summary_data")
    summary = assert_success(
        staff.post_json(
            "/register-data/get_register_summary_data",
            {"register_id": profile.register_id},
        ),
        "get_register_summary_data",
    )
    assert isinstance(summary, list)
    assert any(
        isinstance(row, dict) and row.get("register_id") == profile.register_id
        for row in summary
    )

    step("get_section_records for subject register")
    section_payload = assert_success(
        staff.post_json(
            "/register-data/get_section_records",
            {
                "subject_register_id": profile.register_id,
                "subject_record_id": rid,
                "section_register_id": profile.register_id,
            },
        ),
        "get_section_records:subject",
    )
    records = section_payload if isinstance(section_payload, list) else []
    assert records, "expected at least the subject row from get_section_records"
    hit = next(
        (r for r in records if isinstance(r, dict) and r.get("internal_record_id") == rid),
        None,
    )
    assert hit, f"subject {rid} missing from get_section_records: {records!r}"
    assert_values_equal(
        seeded["fields"][profile.identity_field],
        hit.get(profile.identity_field),
        field=profile.identity_field,
        context=f"tier1_section_records:{profile.key}",
    )

    step("supporting get_tab_records dual-assert")
    assert_supporting_api_db(
        staff,
        cfg.registry_dsn,
        profile,
        rid,
        _seed_supporting_expected(profile),
        context=f"tier1_seeded_supporting:{profile.key}",
    )


@pytest.mark.tier1
@pytest.mark.register
@with_register_profiles
def test_seeded_schema_and_version_history_apis(
    staff: StaffClient,
    cfg: Config,
    step,
    profile: RegisterProfile,
):
    """Schema definition + version/history endpoints (may be empty for seed rows)."""
    seeded = subject(profile.key)
    rid = seeded["internal_record_id"]
    section_id = (
        DEMOGRAPHIC_SECTION_ID
        if profile.key == "individual"
        else HH_COMPOSITION_HEADSHIP_SECTION_ID
    )
    tab_id = profile.primary_tab_id

    step("get_schema_definition_for_register_section")
    schema = assert_success(
        staff.post_json(
            "/register-data/get_schema_definition_for_register_section",
            {"register_id": profile.register_id, "section_id": section_id},
        ),
        "get_schema_definition",
    )
    assert isinstance(schema, dict)
    assert schema.get("section_id") == section_id or schema.get("register_id") or schema

    step("get_number_of_versions")
    versions = assert_success(
        staff.post_json(
            "/register-data/get_number_of_versions",
            {
                "register_id": profile.register_id,
                "internal_record_id": rid,
                "tab_id": tab_id,
            },
        ),
        "get_number_of_versions",
    )
    # Seed rows may have zero history; payload shape must still be valid.
    assert versions is not None

    step("get_version_dates")
    dates = assert_success(
        staff.post_json(
            "/register-data/get_version_dates",
            {
                "register_id": profile.register_id,
                "internal_record_id": rid,
                "tab_id": tab_id,
            },
        ),
        "get_version_dates",
    )
    assert dates is not None

    step("get_record_history")
    history = assert_success(
        staff.post_json(
            "/register-data/get_record_history",
            {
                "register_id": profile.register_id,
                "internal_record_id": rid,
                "tab_id": tab_id,
            },
        ),
        "get_record_history",
    )
    assert history is not None

    # Touch supporting section_register via get_section_records for land/assets
    child_register = (
        REGISTER_INDIVIDUAL_LAND
        if profile.key == "individual"
        else REGISTER_HOUSEHOLD_ASSET
    )
    step(f"get_section_records child {child_register}")
    child_rows = assert_success(
        staff.post_json(
            "/register-data/get_section_records",
            {
                "subject_register_id": profile.register_id,
                "subject_record_id": rid,
                "section_register_id": child_register,
            },
        ),
        "get_section_records:child",
    )
    child_list = child_rows if isinstance(child_rows, list) else []
    expected_ids = {r["internal_record_id"] for r in supporting_rows(_seed_supporting_key(profile))}
    got_ids = {
        r.get("internal_record_id")
        for r in child_list
        if isinstance(r, dict) and r.get("internal_record_id")
    }
    assert expected_ids <= got_ids, f"missing supporting ids {expected_ids - got_ids}"
