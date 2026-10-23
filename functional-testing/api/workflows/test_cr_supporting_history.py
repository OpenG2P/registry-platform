"""Supporting TABLE CR approve — child field applied + history row written."""

from __future__ import annotations

import pytest

from assertions import db as db_assert
from assertions.dual import (
    assert_supporting_api_db,
    assert_supporting_history_for_cr,
    supporting_spec,
)
from assertions.response import assert_success, assert_values_equal
from profile_params import with_register_profiles
from helpers.config import Config
from helpers.flows.change_request import PROFILE_SUPPORTING_CR
from helpers.http import StaffClient
from helpers.profiles import RegisterProfile
from helpers.provision import (
    create_supporting_update_cr,
    provision_record,
    verify_and_approve_cr,
)


@pytest.mark.change_request
@with_register_profiles
def test_cr_supporting_approve_writes_history(
    staff: StaffClient,
    cfg: Config,
    step,
    profile: RegisterProfile,
    household_id_for: str | None,
):
    subject = provision_record(
        staff, cfg, profile, household_id=household_id_for, step=step
    )
    assert subject.supporting, f"{profile.key} provision missing supporting rows"

    defaults = PROFILE_SUPPORTING_CR[profile.key]
    supporting_key = defaults["supporting_key"]
    field_name = defaults["field_name"]
    new_value = defaults["new_value"]

    step(f"baseline supporting dual-assert ({supporting_key})")
    assert_supporting_api_db(
        staff,
        cfg.registry_dsn,
        profile,
        subject.internal_record_id,
        {supporting_key: subject.supporting[supporting_key]},
        context=f"cr_supporting_baseline:{profile.key}",
    )

    created = create_supporting_update_cr(
        staff,
        cfg,
        profile,
        subject_internal_record_id=subject.internal_record_id,
        identity_value=subject.identity_value,
        step=step,
    )
    verify_and_approve_cr(staff, created.change_request_id, step=step)

    step("validate supporting CR APPROVED (API + DB)")
    detail = assert_success(
        staff.post_json(
            "/change-requests/get_change_request",
            {"change_request_id": created.change_request_id},
        ),
        "get_change_request after supporting approve",
    )
    assert isinstance(detail, dict)
    assert str(detail.get("approval_status") or "").upper() == "APPROVED"
    cr_row = db_assert.fetch_change_request(cfg.registry_dsn, created.change_request_id)
    assert cr_row, f"CR {created.change_request_id} missing"
    assert_values_equal(
        detail.get("approval_status"),
        cr_row.get("approval_status"),
        field="approval_status",
        context="cr_supporting_approve",
    )

    expected_rows = [dict(subject.supporting[supporting_key][0])]
    expected_rows[0][field_name] = created.raw_new_value

    step(f"poll supporting {supporting_key}.{field_name} applied (API + DB)")

    def _applied():
        spec = supporting_spec(supporting_key)
        db_rows = spec["fetch_db"](cfg.registry_dsn, subject.internal_record_id)
        for row in db_rows:
            if str(row.get(field_name)) == str(new_value) or row.get(field_name) == new_value:
                return row
        return None

    db_assert.wait_until(
        _applied,
        timeout_s=60.0,
        interval_s=2.0,
        description=f"{supporting_key}.{field_name}={new_value!r}",
    )
    assert_supporting_api_db(
        staff,
        cfg.registry_dsn,
        profile,
        subject.internal_record_id,
        {supporting_key: expected_rows},
        context=f"cr_supporting_approve:{profile.key}",
    )

    step("validate supporting history row (CR linkage; domain fields not on history schema)")
    assert_supporting_history_for_cr(
        cfg.registry_dsn,
        supporting_key=supporting_key,
        change_request_id=created.change_request_id,
        context=f"cr_supporting_history:{profile.key}",
    )

    step(
        f"cr_supporting_approve OK [{profile.key}] "
        f"{supporting_key}.{field_name}={new_value!r} cr={created.change_request_id}"
    )
