"""Change-request approve — field applied; API + DB must match."""

from __future__ import annotations

import pytest

from assertions import db as db_assert
from assertions.dual import (
    assert_api_db_subject_match,
    assert_subject_history_for_cr,
    fetch_subject_db,
)
from assertions.response import assert_success, assert_values_equal
from profile_params import with_register_profiles
from helpers.config import Config
from helpers.http import StaffClient
from helpers.profiles import RegisterProfile
from helpers.provision import (
    approve_two_stage_awe,
    create_field_cr,
    get_subject_record,
    provision_record,
)


@pytest.mark.change_request
@with_register_profiles
def test_cr_approve_applies_field(
    staff: StaffClient,
    cfg: Config,
    step,
    profile: RegisterProfile,
    household_id_for: str | None,
):
    subject = provision_record(
        staff, cfg, profile, household_id=household_id_for, step=step
    )
    created = create_field_cr(
        staff,
        cfg,
        profile,
        subject_internal_record_id=subject.internal_record_id,
        identity_value=subject.identity_value,
        step=step,
    )

    approve_two_stage_awe(
        cfg,
        artifact_type="registry.change_request",
        artifact_id=created.change_request_id,
        search_text=subject.identity_value,
        step=step,
    )

    step(f"poll subject until {profile.cr_field} updates")

    def _field_applied():
        record = get_subject_record(staff, profile, subject.internal_record_id)
        if record.get(profile.cr_field) == created.new_value:
            return record
        return None

    api_record = db_assert.wait_until(
        _field_applied,
        timeout_s=60.0,
        interval_s=2.0,
        description=f"{profile.cr_field}={created.new_value!r} on subject record",
    )
    assert api_record[profile.cr_field] == created.new_value

    step("validate CR APPROVED (API + DB)")
    detail = assert_success(
        staff.post_json(
            "/change-requests/get_change_request",
            {"change_request_id": created.change_request_id},
        ),
        "get_change_request after approve",
    )
    assert isinstance(detail, dict)
    assert str(detail.get("approval_status") or "").upper() == "APPROVED"
    cr_row = db_assert.fetch_change_request(cfg.registry_dsn, created.change_request_id)
    assert cr_row, f"CR {created.change_request_id} missing"
    assert_values_equal(
        detail.get("approval_status"),
        cr_row.get("approval_status"),
        field="approval_status",
        context="cr_approve",
    )

    step("strict API ↔ DB subject match including new field value")
    expected = dict(subject.fields)
    expected[profile.cr_field] = created.new_value
    db_assert.wait_until(
        lambda: (
            fetch_subject_db(cfg.registry_dsn, profile, subject.internal_record_id).get(
                profile.cr_field
            )
            == created.new_value
            or None
        ),
        timeout_s=30.0,
        interval_s=2.0,
        description=f"DB {profile.cr_field} applied",
    )
    assert_api_db_subject_match(
        staff,
        cfg.registry_dsn,
        profile,
        subject.internal_record_id,
        expected_fields=expected,
        context=f"cr_approve:{profile.key}",
    )

    step("validate subject history row for approved CR")
    assert_subject_history_for_cr(
        cfg.registry_dsn,
        profile,
        change_request_id=created.change_request_id,
        subject_internal_record_id=subject.internal_record_id,
        field_name=profile.cr_field,
        expected_new_value=created.new_value,
        context=f"cr_approve:{profile.key}",
    )

    step(
        f"cr_approve OK [{profile.key}] change_request_id={created.change_request_id} "
        f"{profile.cr_field}={created.new_value}"
    )
