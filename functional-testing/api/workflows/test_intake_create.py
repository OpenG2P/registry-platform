"""Intake create — finalize happy path with response + DB validation."""

from __future__ import annotations

import pytest

from assertions.dual import assert_intake_api_db
from assertions.response import assert_status_fields, assert_success
from profile_params import with_register_profiles
from helpers.config import Config
from helpers.http import StaffClient
from helpers.profiles import RegisterProfile
from helpers.provision import create_and_finalize_intake


@pytest.mark.intake
@with_register_profiles
def test_intake_create_finalize_and_validate(
    staff: StaffClient,
    cfg: Config,
    step,
    profile: RegisterProfile,
    household_id_for: str | None,
):
    created = create_and_finalize_intake(
        staff, cfg, profile, household_id=household_id_for, step=step
    )

    step("validate API: draft_status=FINAL after finalize")
    reget = staff.post_json(
        "/intake-form-data/get_intake_form_submission",
        {"submission_id": created.submission_id},
    )
    reget_payload = assert_success(reget, "get after finalize")
    assert isinstance(reget_payload, dict)
    assert_status_fields(
        reget_payload,
        draft_status="FINAL",
        approval_status="PENDING",
        context="get after finalize",
    )

    step("validate DB matches API")
    assert_intake_api_db(
        cfg.registry_dsn,
        created.submission_id,
        form_id=profile.intake_form_id,
        register_id=profile.register_id,
        draft_status="FINAL",
        approval_status="PENDING",
        api_payload=reget_payload,
        context=f"intake_create:{profile.key}",
    )

    step(
        f"intake_create OK [{profile.key}] submission_id={created.submission_id} "
        f"identity={created.identity_value}"
    )
