"""Register browse + detail read with response + DB validation."""

from __future__ import annotations

import pytest

from assertions import db as db_assert
from assertions.dual import assert_api_db_subject_match
from assertions.response import assert_success, assert_values_equal
from profile_params import with_register_profiles
from helpers.config import Config
from helpers.http import StaffClient
from helpers.profiles import RegisterProfile
from helpers.provision import create_field_cr, provision_record, response_payload


def _extract_ordered_tab_ids(tabs_body: dict) -> list[str]:
    tabs = response_payload(tabs_body) or []
    if not isinstance(tabs, list):
        return []
    ordered = sorted(tabs, key=lambda tab: tab.get("tab_order", 0))
    return [tab["tab_id"] for tab in ordered if tab.get("tab_id")]


@pytest.mark.register
@pytest.mark.intake
@pytest.mark.change_request
@with_register_profiles
def test_register_read_browse_tabs(
    staff: StaffClient,
    cfg: Config,
    step,
    profile: RegisterProfile,
    household_id_for: str | None,
):
    subject = provision_record(
        staff, cfg, profile, household_id=household_id_for, step=step
    )

    step("create pending CR so CR detail APIs are exercised")
    pending_cr = create_field_cr(
        staff,
        cfg,
        profile,
        subject_internal_record_id=subject.internal_record_id,
        identity_value=subject.identity_value,
        step=step,
    )

    step("get_register_summary_data")
    summary = assert_success(
        staff.post_json(
            "/register-data/get_register_summary_data",
            {"register_id": profile.register_id},
        ),
        "get_register_summary_data",
    )
    assert isinstance(summary, list), f"expected list summary payload, got {type(summary).__name__}"
    assert any(
        isinstance(row, dict) and row.get("register_id") == profile.register_id
        for row in summary
    ), f"{profile.key} register missing from summary list"

    step(f"get_subject_record {subject.internal_record_id}")
    assert_api_db_subject_match(
        staff,
        cfg.registry_dsn,
        profile,
        subject.internal_record_id,
        expected_fields=subject.fields,
        context=f"register_read:{profile.key}",
    )

    step("get_all_tabs")
    tabs_body = staff.post_json(
        "/register-tab-metadata/get_all_tabs",
        {"register_id": profile.register_id},
    )
    assert_success(tabs_body, "get_all_tabs")
    tab_ids = _extract_ordered_tab_ids(tabs_body)
    assert tab_ids, "register has no tabs"

    crs_seen = 0
    for tab_id in tab_ids:
        step(f"browse tab {tab_id}")
        assert_success(
            staff.post_json(
                "/register-tab-metadata/get_sections",
                {"tab_id": tab_id},
            ),
            f"get_sections:{tab_id}",
        )
        assert_success(
            staff.post_json(
                "/register-data/get_tab_records",
                {
                    "subject_register_id": profile.register_id,
                    "subject_record_id": subject.internal_record_id,
                    "tab_id": tab_id,
                },
            ),
            f"get_tab_records:{tab_id}",
        )

        cr_body = staff.post_json(
            "/change-requests/get_change_requests",
            {
                "subject_register_id": profile.register_id,
                "subject_record_id": subject.internal_record_id,
                "tab_id": tab_id,
            },
            pagination_request={"current_page": 1, "page_size": 20},
        )
        assert_success(cr_body, f"get_change_requests:{tab_id}")
        items = response_payload(cr_body) or []
        if isinstance(items, list):
            crs_seen += len(items)

    assert crs_seen >= 1, (
        f"expected pending CR {pending_cr.change_request_id} to appear in tab CR lists"
    )

    step("validate DB change request PENDING")
    cr_row = db_assert.fetch_change_request(cfg.registry_dsn, pending_cr.change_request_id)
    assert cr_row, f"pending CR {pending_cr.change_request_id} missing in DB"
    assert_values_equal(
        "PENDING",
        str(cr_row.get("approval_status") or "").upper(),
        field="approval_status",
        context="register_read CR DB",
    )
    detail = assert_success(
        staff.post_json(
            "/change-requests/get_change_request",
            {"change_request_id": pending_cr.change_request_id},
        ),
        "get_change_request",
    )
    assert isinstance(detail, dict)
    assert_values_equal(
        detail.get("approval_status"),
        cr_row.get("approval_status"),
        field="approval_status",
        context="register_read CR API↔DB",
    )

    step(
        f"register_read OK [{profile.key}] tabs={len(tab_ids)} crs_seen={crs_seen} "
        f"pending_cr={pending_cr.change_request_id}"
    )
