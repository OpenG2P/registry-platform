"""Staff Tier-1: intake reject / delete correctness (API + DB)."""

from __future__ import annotations

import pytest

from assertions import db as db_assert
from assertions.dual import assert_intake_api_db
from assertions.response import assert_status_fields, assert_success
from profile_params import with_register_profiles
from helpers.config import Config
from helpers.flows.intake import create_and_finalize_intake, save_intake_section
from helpers.http import StaffClient
from helpers.profiles import RegisterProfile
from helpers.util import assert_ok


@pytest.mark.tier1
@pytest.mark.intake
@with_register_profiles
def test_intake_reject_finalized_submission(
    staff: StaffClient,
    cfg: Config,
    step,
    profile: RegisterProfile,
    household_id_for: str | None,
):
    created = create_and_finalize_intake(
        staff, cfg, profile, household_id=household_id_for, step=step
    )

    step("reject_intake_form_submission")
    rejected = assert_success(
        staff.post_json(
            "/intake-form-data/reject_intake_form_submission",
            {"submission_id": created.submission_id},
        ),
        "reject_intake",
    )
    assert isinstance(rejected, dict)
    assert_status_fields(
        rejected,
        approval_status="REJECTED",
        context="reject response",
    )

    step("get + DB dual-assert REJECTED")
    reget = assert_success(
        staff.post_json(
            "/intake-form-data/get_intake_form_submission",
            {"submission_id": created.submission_id},
        ),
        "get after reject",
    )
    assert isinstance(reget, dict)
    assert_status_fields(
        reget,
        draft_status="FINAL",
        approval_status="REJECTED",
        context="get after reject",
    )
    assert_intake_api_db(
        cfg.registry_dsn,
        created.submission_id,
        form_id=profile.intake_form_id,
        register_id=profile.register_id,
        draft_status="FINAL",
        approval_status="REJECTED",
        api_payload=reget,
        context=f"tier1_intake_reject:{profile.key}",
    )


@pytest.mark.tier1
@pytest.mark.intake
@with_register_profiles
def test_intake_delete_draft_submission(
    staff: StaffClient,
    cfg: Config,
    step,
    profile: RegisterProfile,
    household_id_for: str | None,
):
    """Save one section (DRAFT), delete, assert submission gone from DB."""
    from helpers.payloads import (
        build_household_section_payload,
        build_individual_section_payload,
        section_defs_for,
    )
    from helpers.util import unique_household_head_name, unique_individual_name

    section_defs = section_defs_for(profile)
    if profile.key == "individual":
        link_hh = household_id_for or cfg.household_id
        assert link_hh, "household link required"
        name = unique_individual_name(profile.search_marker)
        first_section = "in_demographic_details"
        own = build_individual_section_payload(first_section, link_hh, name)
    else:
        head = unique_household_head_name(profile.search_marker)
        first_section = "hh_composition_headship"
        own = build_household_section_payload(first_section, head)

    defn = section_defs[first_section]
    rows = [own] if isinstance(own, dict) else list(own)

    step(f"save draft section {first_section}")
    save = save_intake_section(
        staff,
        submission_id=None,
        section_id=first_section,
        section_payload=rows,
        section_register_id=defn["section_register_id"],
        form_id=profile.intake_form_id,
        register_id=profile.register_id,
        step=step,
    )
    save_payload = assert_ok(save, "save draft")
    submission_id = save_payload.get("submission_id")
    assert submission_id

    step("delete_intake_form_submission")
    assert_success(
        staff.post_json(
            "/intake-form-data/delete_intake_form_submission",
            {"submission_id": submission_id},
        ),
        "delete_intake",
    )

    step("DB row gone")
    row = db_assert.fetch_intake_submission(cfg.registry_dsn, submission_id)
    assert row is None, f"submission {submission_id} still in DB after delete: {row!r}"
