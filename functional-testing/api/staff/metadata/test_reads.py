"""Staff Tier-1: metadata read endpoints (registers, tabs, sections, intake form)."""

from __future__ import annotations

import pytest

from assertions.response import assert_success
from profile_params import with_register_profiles
from helpers.http import StaffClient
from helpers.profiles import RegisterProfile


@pytest.mark.tier1
@with_register_profiles
def test_register_and_intake_metadata_reads(
    staff: StaffClient,
    step,
    profile: RegisterProfile,
):
    step("register-metadata/get_all_registers")
    registers = assert_success(
        staff.post_json("/register-metadata/get_all_registers", {}),
        "get_all_registers",
    )
    reg_list = registers if isinstance(registers, list) else []
    assert any(
        isinstance(r, dict) and r.get("register_id") == profile.register_id
        for r in reg_list
    ), f"{profile.key} register missing from get_all_registers"

    step("register-section-metadata/get_all_sections")
    sections = assert_success(
        staff.post_json(
            "/register-section-metadata/get_all_sections",
            {"register_id": profile.register_id},
        ),
        "get_all_sections",
    )
    assert isinstance(sections, list) and sections

    step("register-section-metadata/get_section")
    section_id = profile.cr_section_id
    one = assert_success(
        staff.post_json(
            "/register-section-metadata/get_section",
            {"register_id": profile.register_id, "section_id": section_id},
        ),
        "get_section",
    )
    assert isinstance(one, dict)
    assert one.get("section_id") == section_id or one.get("section_id") is not None

    step("register-tab-metadata/get_all_tabs + get_tab")
    tabs = assert_success(
        staff.post_json(
            "/register-tab-metadata/get_all_tabs",
            {"register_id": profile.register_id},
        ),
        "get_all_tabs",
    )
    tab_list = tabs if isinstance(tabs, list) else []
    assert any(t.get("tab_id") == profile.primary_tab_id for t in tab_list if isinstance(t, dict))
    tab = assert_success(
        staff.post_json(
            "/register-tab-metadata/get_tab",
            {"tab_id": profile.primary_tab_id},
        ),
        "get_tab",
    )
    assert isinstance(tab, dict)

    step("intake-form-metadata/get_intake_form + get_all_intake_forms")
    forms = assert_success(
        staff.post_json("/intake-form-metadata/get_all_intake_forms", {}),
        "get_all_intake_forms",
    )
    form_list = forms if isinstance(forms, list) else []
    assert any(
        isinstance(f, dict) and f.get("form_id") == profile.intake_form_id
        for f in form_list
    )
    form = assert_success(
        staff.post_json(
            "/intake-form-metadata/get_intake_form",
            {"form_id": profile.intake_form_id},
        ),
        "get_intake_form",
    )
    assert isinstance(form, dict)

    step("intake-form-metadata/render_intake_form")
    rendered = assert_success(
        staff.post_json(
            "/intake-form-metadata/render_intake_form",
            {"form_id": profile.intake_form_id},
        ),
        "render_intake_form",
    )
    assert rendered is not None
