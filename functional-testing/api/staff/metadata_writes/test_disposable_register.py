"""Staff Tier-2 E5: disposable register / section / tab / intake-form metadata writes."""

from __future__ import annotations

import uuid

import pytest

from assertions.response import assert_success
from helpers.http import StaffClient
from helpers.util import assert_ok


@pytest.mark.tier2
def test_disposable_register_metadata_lifecycle(staff: StaffClient, step):
    """Never mutate Individual/Household — create a temporary register tree and tear it down."""
    suffix = uuid.uuid4().hex[:8]
    mnemonic = f"func_tier2_reg_{suffix}"
    register_id = None
    section_id = None
    tab_id = None
    tab_section_id = None
    form_id = None
    form_tab_id = None
    try:
        step("create_register")
        reg = assert_success(
            staff.post_json(
                "/register-metadata/create_register",
                {
                    "register_mnemonic": mnemonic,
                    "register_description": "func tier2 disposable",
                    "dedup_is_enabled": False,
                    "completion_score_required": False,
                    "outgest_applicable": False,
                },
            ),
            "create_register",
        )
        assert isinstance(reg, dict)
        register_id = reg.get("register_id")
        assert register_id

        step("create_section")
        section = assert_success(
            staff.post_json(
                "/register-section-metadata/create_section",
                {
                    "section_register_id": register_id,
                    "register_id": register_id,
                    "section_mnemonic": f"func_tier2_sec_{suffix}",
                    "section_description": "func tier2 section",
                    "is_list": False,
                    "is_core_section": False,
                    "section_weightage": 1.0,
                },
            ),
            "create_section",
        )
        assert isinstance(section, dict)
        section_id = section.get("section_id")
        assert section_id

        step("update_section + ui_schema")
        assert_success(
            staff.post_json(
                "/register-section-metadata/update_section",
                {
                    "section_id": section_id,
                    "section_description": "func tier2 section updated",
                },
            ),
            "update_section",
        )
        assert_success(
            staff.post_json(
                "/register-section-metadata/update_section_ui_schema",
                {
                    "section_id": section_id,
                    "section_ui_schema": {"type": "object", "properties": {}},
                },
            ),
            "update_section_ui_schema",
        )

        step("create_tab + add_section")
        tab = assert_success(
            staff.post_json(
                "/register-tab-metadata/create_tab",
                {
                    "register_id": register_id,
                    "tab_label": f"func_tier2_tab_{suffix}",
                    "tab_order": 0,
                    "is_active": True,
                },
            ),
            "create_tab",
        )
        assert isinstance(tab, dict)
        tab_id = tab.get("tab_id")
        assert tab_id

        link = assert_success(
            staff.post_json(
                "/register-tab-metadata/add_section",
                {
                    "register_id": register_id,
                    "tab_id": tab_id,
                    "section_id": section_id,
                    "section_order": 0,
                },
            ),
            "add_section",
        )
        assert isinstance(link, dict)
        tab_section_id = link.get("tab_section_id")

        step("register schema / dedup updates on disposable register")
        assert_success(
            staff.post_json(
                "/register-metadata/update_dedup_is_enabled",
                {"register_id": register_id, "dedup_is_enabled": True},
            ),
            "update_dedup_is_enabled",
        )
        assert_success(
            staff.post_json(
                "/register-metadata/update_dedup_threshold_score",
                {"register_id": register_id, "dedup_threshold_score": 0.8},
            ),
            "update_dedup_threshold_score",
        )
        assert_success(
            staff.post_json(
                "/register-metadata/update_search_result_schema",
                {
                    "register_id": register_id,
                    "search_result_schema": [],
                },
            ),
            "update_search_result_schema",
        )
        assert_success(
            staff.post_json(
                "/register-metadata/update_deduplication_schema",
                {
                    "register_id": register_id,
                    "deduplicate_schema": [],
                },
            ),
            "update_deduplication_schema",
        )
        assert_success(
            staff.post_json(
                "/register-metadata/update_register_schema",
                {
                    "register_id": register_id,
                    "filter_schema": [],
                },
            ),
            "update_register_schema",
        )
        assert_success(
            staff.post_json(
                "/register-metadata/edit_register",
                {
                    "register_id": register_id,
                    "register_description": "func tier2 disposable updated",
                },
            ),
            "edit_register",
        )

        step("create_intake_form + tab")
        form = assert_success(
            staff.post_json(
                "/intake-form-metadata/create_intake_form",
                {
                    "register_id": register_id,
                    "form_mnemonic": f"func_tier2_form_{suffix}",
                    "form_description": "func tier2 form",
                    "number_of_verifications": 0,
                },
            ),
            "create_intake_form",
        )
        assert isinstance(form, dict)
        form_id = form.get("form_id")
        assert form_id

        form_tab = assert_success(
            staff.post_json(
                "/intake-form-metadata/create_tab",
                {
                    "form_id": form_id,
                    "tab_label": f"func_form_tab_{suffix}",
                    "tab_order": 0,
                },
            ),
            "create_intake_form_tab",
        )
        assert isinstance(form_tab, dict)
        form_tab_id = form_tab.get("tab_id")
        assert form_tab_id

        step("get disposable artefacts")
        assert_success(
            staff.post_json(
                "/register-section-metadata/get_section",
                {"section_id": section_id, "register_id": register_id},
            ),
            "get_section",
        )
        assert_success(
            staff.post_json("/register-tab-metadata/get_tab", {"tab_id": tab_id}),
            "get_tab",
        )
        assert_success(
            staff.post_json(
                "/intake-form-metadata/get_intake_form",
                {"form_id": form_id},
            ),
            "get_intake_form",
        )
    finally:
        if form_tab_id:
            assert_ok(
                staff.post_json(
                    "/intake-form-metadata/delete_tab",
                    {"tab_id": form_tab_id},
                ),
                "delete_intake_form_tab",
            )
        if form_id:
            assert_ok(
                staff.post_json(
                    "/intake-form-metadata/delete_intake_form",
                    {"form_id": form_id},
                ),
                "delete_intake_form",
            )
        if tab_section_id:
            assert_ok(
                staff.post_json(
                    "/register-tab-metadata/remove_section",
                    {"tab_section_id": tab_section_id},
                ),
                "remove_tab_section",
            )
        if tab_id:
            assert_ok(
                staff.post_json(
                    "/register-tab-metadata/delete_tab",
                    {"tab_id": tab_id},
                ),
                "delete_tab",
            )
        if section_id:
            assert_ok(
                staff.post_json(
                    "/register-section-metadata/delete_section",
                    {"section_id": section_id},
                ),
                "delete_section",
            )
        if register_id:
            assert_ok(
                staff.post_json(
                    "/register-metadata/delete_register",
                    {"register_id": register_id},
                ),
                "delete_register",
            )
