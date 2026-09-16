"""Staff Tier-1: change-request reject + pending/summary reads."""

from __future__ import annotations

import pytest

from assertions import db as db_assert
from assertions.response import assert_success, assert_values_equal
from profile_params import with_register_profiles
from helpers.config import Config
from helpers.flows.change_request import create_field_cr
from helpers.http import StaffClient
from helpers.profiles import RegisterProfile
from helpers.provision import provision_record
from helpers.seed_manifest import subject
from helpers.util import assert_ok


@pytest.mark.tier1
@pytest.mark.change_request
@with_register_profiles
def test_change_request_reject_keeps_subject_unchanged(
    staff: StaffClient,
    cfg: Config,
    step,
    profile: RegisterProfile,
    household_id_for: str | None,
):
    subject_rec = provision_record(
        staff, cfg, profile, household_id=household_id_for, step=step
    )
    before = subject_rec.fields.get(profile.cr_field)

    created = create_field_cr(
        staff,
        cfg,
        profile,
        subject_internal_record_id=subject_rec.internal_record_id,
        identity_value=subject_rec.identity_value,
        step=step,
    )

    step("reject_change_request")
    assert_ok(
        staff.post_json(
            "/change-requests/reject_change_request",
            {
                "change_request_id": created.change_request_id,
                "rejection_reason": "func-tier1-reject",
            },
        ),
        "reject_cr",
    )

    step("get_change_request REJECTED")
    detail = assert_success(
        staff.post_json(
            "/change-requests/get_change_request",
            {"change_request_id": created.change_request_id},
        ),
        "get_cr after reject",
    )
    assert isinstance(detail, dict)
    assert str(detail.get("approval_status") or "").upper() == "REJECTED"
    cr_row = db_assert.fetch_change_request(cfg.registry_dsn, created.change_request_id)
    assert cr_row
    assert_values_equal(
        detail.get("approval_status"),
        cr_row.get("approval_status"),
        field="approval_status",
        context=f"tier1_cr_reject:{profile.key}",
    )

    step("subject field unchanged after CR reject")
    from helpers.flows.register import get_subject_record

    api_rec = get_subject_record(staff, profile, subject_rec.internal_record_id)
    assert_values_equal(
        before,
        api_rec.get(profile.cr_field),
        field=profile.cr_field,
        context=f"tier1_cr_reject_subject:{profile.key}",
    )


@pytest.mark.tier1
@pytest.mark.change_request
@with_register_profiles
def test_change_request_pending_count_and_summary(
    staff: StaffClient,
    cfg: Config,
    step,
    profile: RegisterProfile,
):
    """Pending CR APIs against seeded subject (create one pending CR)."""
    seeded = subject(profile.key)
    rid = seeded["internal_record_id"]

    created = create_field_cr(
        staff,
        cfg,
        profile,
        subject_internal_record_id=rid,
        identity_value=seeded["identity_value"],
        step=step,
    )

    step("get_number_of_pending_change_requests")
    pending = assert_success(
        staff.post_json(
            "/change-requests/get_number_of_pending_change_requests",
            {
                "subject_register_id": profile.register_id,
                "subject_record_id": rid,
                "tab_id": profile.primary_tab_id,
            },
        ),
        "pending_count",
    )
    assert pending is not None
    # Payload may be int or dict with count field
    count = pending if isinstance(pending, int) else (
        pending.get("number_of_pending_change_requests")
        if isinstance(pending, dict)
        else None
    )
    assert count is None or int(count) >= 1

    step("get_register_change_request_summary_data")
    summary = assert_success(
        staff.post_json(
            "/change-requests/get_register_change_request_summary_data",
            {"register_id": profile.register_id},
        ),
        "cr_summary",
    )
    assert summary is not None

    step("get_verifications_for_change_request (empty ok)")
    verifs = assert_success(
        staff.post_json(
            "/change-requests/get_verifications_for_change_request",
            {"change_request_id": created.change_request_id},
        ),
        "cr_verifications",
    )
    assert verifs is not None

    step("search_in_change_request")
    search = assert_success(
        staff.post_json(
            "/change-requests/search_in_change_request",
            {"register_id": profile.register_id},
            pagination_request={"current_page": 1, "page_size": 20, "search_text": ""},
        ),
        "search_cr",
    )
    assert search is not None

    # Leave CR pending — reject to avoid polluting seed subject for later runs
    step("cleanup: reject pending seed CR")
    assert_ok(
        staff.post_json(
            "/change-requests/reject_change_request",
            {
                "change_request_id": created.change_request_id,
                "rejection_reason": "func-tier1-cleanup",
            },
        ),
        "cleanup_reject_cr",
    )
