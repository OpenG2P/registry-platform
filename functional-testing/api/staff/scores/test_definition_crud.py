"""Staff Tier-2 E3: computation-score CRUD + export + CR sequence check."""

from __future__ import annotations

import time
import uuid

import pytest

from assertions.response import assert_success
from profile_params import with_register_profiles
from helpers.flows.change_request import create_field_cr
from helpers.http import StaffClient
from helpers.lists import as_list
from helpers.profiles import RegisterProfile
from helpers.provision import provision_record
from helpers.config import Config
from helpers.seed_manifest import subject
from helpers.util import assert_ok


_PAGE = {"current_page": 1, "page_size": 50}


@pytest.mark.tier2
@with_register_profiles
def test_computation_score_definition_crud(
    staff: StaffClient,
    step,
    profile: RegisterProfile,
):
    score_type = f"FUNC_T2_{uuid.uuid4().hex[:10]}"
    def_id = None
    attr_id = None
    try:
        step("create_score_definition")
        created = assert_success(
            staff.post_json(
                "/computation-score/create_score_definition",
                {
                    "register_id": profile.register_id,
                    "score_type": score_type,
                },
            ),
            "create_score_definition",
        )
        assert isinstance(created, dict)
        def_payload = created.get("score_definition") if isinstance(created.get("score_definition"), dict) else created
        def_id = def_payload.get("score_definition_id")
        assert def_id

        step("create_score_contributing_attribute")
        attr = assert_success(
            staff.post_json(
                "/computation-score/create_score_contributing_attribute",
                {
                    "score_definition_id": def_id,
                    "attribute_name": profile.cr_field,
                    "attribute_weightage": 1.0,
                    "attribute_computation_required": False,
                },
            ),
            "create_score_contributing_attribute",
        )
        assert isinstance(attr, dict)
        attr_payload = (
            attr.get("contributing_attribute")
            if isinstance(attr.get("contributing_attribute"), dict)
            else (
                attr.get("score_contributing_attribute")
                if isinstance(attr.get("score_contributing_attribute"), dict)
                else attr
            )
        )
        attr_id = attr_payload.get("contributing_attribute_id")
        assert attr_id

        step("get_score_contributing_attributes")
        attrs_payload = assert_success(
            staff.post_json(
                "/computation-score/get_score_contributing_attributes",
                {"score_definition_id": def_id},
                pagination_request=_PAGE,
            ),
            "get_attrs",
        )
        if isinstance(attrs_payload, dict) and "contributing_attributes" in attrs_payload:
            attrs = as_list(attrs_payload.get("contributing_attributes"))
        else:
            attrs = as_list(attrs_payload)
        assert any(
            isinstance(a, dict) and a.get("contributing_attribute_id") == attr_id
            for a in attrs
        ), f"created attr {attr_id} not in {attrs!r}"

        step("update_score_contributing_attribute")
        assert_success(
            staff.post_json(
                "/computation-score/update_score_contributing_attribute",
                {
                    "contributing_attribute_id": attr_id,
                    "attribute_weightage": 2.0,
                },
            ),
            "update_attr",
        )

        step("update_score_definition")
        assert_success(
            staff.post_json(
                "/computation-score/update_score_definition",
                {"score_definition_id": def_id, "is_enabled": True},
            ),
            "update_definition",
        )
    finally:
        if attr_id:
            step("delete_score_contributing_attribute")
            assert_success(
                staff.post_json(
                    "/computation-score/delete_score_contributing_attribute",
                    {"contributing_attribute_id": attr_id},
                ),
                "delete_attr",
            )
        if def_id:
            step("delete_score_definition")
            assert_success(
                staff.post_json(
                    "/computation-score/delete_score_definition",
                    {"score_definition_id": def_id},
                ),
                "delete_definition",
            )


@pytest.mark.tier2
@with_register_profiles
def test_export_register_records_appears_in_queue(
    staff: StaffClient,
    step,
    profile: RegisterProfile,
):
    rid = subject(profile.key)["internal_record_id"]
    step("export_register_records")
    assert_ok(
        staff.post_json(
            "/register-data/export_register_records",
            {
                "register_id": profile.register_id,
                "export_format": "XLSX",
                "selected_internal_record_ids": [rid],
            },
        ),
        "export_register_records",
    )

    step("poll get_export_queue_records")
    deadline = time.time() + 30
    found = False
    while time.time() < deadline:
        rows = as_list(
            assert_success(
                staff.post_json(
                    "/register-data/get_export_queue_records",
                    {},
                    pagination_request=_PAGE,
                ),
                "get_export_queue_records",
            )
        )
        if rows:
            found = True
            break
        time.sleep(1)
    assert found, "export queue remained empty after export_register_records"


@pytest.mark.tier2
@pytest.mark.change_request
@with_register_profiles
def test_check_change_request_sequence(
    staff: StaffClient,
    cfg: Config,
    step,
    profile: RegisterProfile,
    household_id_for: str | None,
):
    subject_rec = provision_record(
        staff, cfg, profile, household_id=household_id_for, step=step
    )
    created = create_field_cr(
        staff,
        cfg,
        profile,
        subject_internal_record_id=subject_rec.internal_record_id,
        identity_value=subject_rec.identity_value,
        step=step,
    )
    try:
        step("check_change_request_sequence")
        assert_success(
            staff.post_json(
                "/change-requests/check_change_request_sequence",
                {"change_request_id": created.change_request_id},
            ),
            "check_change_request_sequence",
        )
    finally:
        step("cleanup reject CR")
        assert_ok(
            staff.post_json(
                "/change-requests/reject_change_request",
                {
                    "change_request_id": created.change_request_id,
                    "rejection_reason": "func-tier2-sequence-cleanup",
                },
            ),
            "reject_cr_cleanup",
        )
