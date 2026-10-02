"""Intake verify + approve — register row present; API + DB fields match."""

from __future__ import annotations

import pytest

from assertions import db as db_assert
from assertions.dual import (
    assert_api_db_subject_match,
    assert_intake_api_db,
    assert_supporting_api_db,
)
from assertions.response import assert_status_fields, assert_success
from profile_params import with_register_profiles
from helpers.config import Config
from helpers.http import StaffClient
from helpers.profiles import RegisterProfile
from helpers.provision import (
    approve_two_stage_awe,
    create_and_finalize_intake,
    search_register_by_text,
)


@pytest.mark.intake
@pytest.mark.register
@with_register_profiles
def test_intake_verify_approve_and_register(
    staff: StaffClient,
    cfg: Config,
    step,
    profile: RegisterProfile,
    household_id_for: str | None,
):
    created = create_and_finalize_intake(
        staff, cfg, profile, household_id=household_id_for, step=step
    )

    step(f"search intake submissions for identity {created.identity_value}")
    search = staff.post_json(
        "/intake-form-data/search_in_intake_form_submissions",
        {"register_id": profile.register_id},
        pagination_request={
            "current_page": 1,
            "page_size": 20,
            "search_text": created.identity_value,
        },
    )
    assert_success(search, "search_in_intake_form_submissions")

    approve_two_stage_awe(
        cfg,
        artifact_type="registry.intake_form",
        artifact_id=created.submission_id,
        search_text=created.identity_value,
        step=step,
    )

    step("poll API + DB until submission APPROVED (AWE webhook is async)")

    def _approved_submission():
        payload = assert_success(
            staff.post_json(
                "/intake-form-data/get_intake_form_submission",
                {"submission_id": created.submission_id},
            ),
            "get after approve",
        )
        if (
            isinstance(payload, dict)
            and str(payload.get("approval_status") or "").upper() == "APPROVED"
        ):
            return payload
        return None

    approved = db_assert.wait_until(
        _approved_submission,
        timeout_s=90.0,
        interval_s=3.0,
        description=f"submission {created.submission_id} APPROVED after AWE",
    )
    assert isinstance(approved, dict)
    assert_status_fields(
        approved,
        draft_status="FINAL",
        approval_status="APPROVED",
        context="get after approve",
    )
    assert_intake_api_db(
        cfg.registry_dsn,
        created.submission_id,
        form_id=profile.intake_form_id,
        register_id=profile.register_id,
        draft_status="FINAL",
        approval_status="APPROVED",
        api_payload=approved,
        context=f"intake_approve:{profile.key}",
    )

    step("poll register search until record appears")

    def _find_in_register():
        hits = search_register_by_text(
            staff, created.identity_value, register_id=profile.register_id
        )
        return next(
            (
                h
                for h in hits
                if created.identity_value in str(h.get("record_name") or "")
                or created.identity_value in str(h)
                or h.get(profile.identity_field) == created.identity_value
            ),
            None,
        )

    record = db_assert.wait_until(
        _find_in_register,
        timeout_s=90.0,
        interval_s=3.0,
        description=f"{profile.key} identity={created.identity_value} in register search",
    )
    internal_id = record.get("internal_record_id")
    assert internal_id, "search hit missing internal_record_id"
    step(f"register hit: internal_record_id={internal_id}")

    step("strict API ↔ DB subject field match")
    assert_api_db_subject_match(
        staff,
        cfg.registry_dsn,
        profile,
        internal_id,
        expected_fields=created.fields,
        context=f"intake_approve:{profile.key}",
    )

    if created.supporting:
        step(f"strict API ↔ DB supporting tables: {sorted(created.supporting)}")
        assert_supporting_api_db(
            staff,
            cfg.registry_dsn,
            profile,
            internal_id,
            created.supporting,
            context=f"intake_approve:{profile.key}",
        )

    step(
        f"intake_approve OK [{profile.key}] submission_id={created.submission_id} "
        f"internal_record_id={internal_id}"
    )
