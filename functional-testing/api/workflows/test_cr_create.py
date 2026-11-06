"""Change-request create — field pending; subject unchanged in API + DB."""

from __future__ import annotations

import pytest

from assertions import db as db_assert
from assertions.dual import assert_api_db_subject_match
from assertions.response import assert_success, assert_values_equal
from profile_params import with_register_profiles
from helpers.config import Config
from helpers.http import StaffClient
from helpers.profiles import RegisterProfile
from helpers.provision import create_field_cr, provision_record


@pytest.mark.change_request
@with_register_profiles
def test_cr_create_field_pending(
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

    step("get_change_request — expect PENDING (API + DB)")
    detail = assert_success(
        staff.post_json(
            "/change-requests/get_change_request",
            {"change_request_id": created.change_request_id},
        ),
        "get_change_request",
    )
    assert isinstance(detail, dict)
    assert str(detail.get("approval_status") or "").upper() == "PENDING"
    cr_row = db_assert.fetch_change_request(cfg.registry_dsn, created.change_request_id)
    assert cr_row, f"CR {created.change_request_id} missing in DB"
    assert_values_equal(
        detail.get("approval_status"),
        cr_row.get("approval_status"),
        field="approval_status",
        context="cr_create",
    )

    step(f"subject {profile.cr_field} unchanged while CR pending (API + DB)")
    api_record, db_row = assert_api_db_subject_match(
        staff,
        cfg.registry_dsn,
        profile,
        subject.internal_record_id,
        expected_fields=subject.fields,
        context=f"cr_create:{profile.key}",
    )
    assert api_record.get(profile.cr_field) != created.new_value, (
        f"{profile.cr_field} should not apply before CR approval"
    )
    assert db_row.get(profile.cr_field) != created.new_value, (
        f"DB {profile.cr_field} should not apply before CR approval"
    )

    step(
        f"cr_create OK [{profile.key}] change_request_id={created.change_request_id} "
        f"{profile.cr_field} -> {created.new_value!r}"
    )
