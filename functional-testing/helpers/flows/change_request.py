"""Change-request create / approve flows."""

from __future__ import annotations

from typing import Any, Optional

from helpers.config import (
    Config,
    HH_ASSETS_SECTION_ID,
    HH_HOUSING_TABLE_SECTION_ID,
    INDIVIDUAL_LAND_SECTION_ID,
    INDIVIDUAL_LIVELIHOOD_TABLE_SECTION_ID,
)
from helpers.http import StaffClient
from helpers.models import ChangeRequestResult
from helpers.profiles import INDIVIDUAL, RegisterProfile
from helpers.util import assert_ok, noop, response_payload, unique_cr_value, StepFn

# Primary supporting section exercised for CR+history per profile
PROFILE_SUPPORTING_CR: dict[str, dict[str, Any]] = {
    "individual": {
        "supporting_key": "individual_land",
        "section_id": INDIVIDUAL_LAND_SECTION_ID,
        "field_name": "land_size",
        "new_value": 9.75,
        # Single land row; match keeps selection stable if more rows appear later.
        "row_match": {"land_access": True},
    },
    "household": {
        "supporting_key": "household_assets",
        "section_id": HH_ASSETS_SECTION_ID,
        "field_name": "quantity",
        "new_value": 11,
        # Assets is_list — tab order is not guaranteed; pin the LAND row.
        "row_match": {"asset_type": "LAND", "asset_category": "plot"},
    },
}


def create_field_cr(
    staff: StaffClient,
    cfg: Config,
    profile: RegisterProfile,
    *,
    subject_internal_record_id: str,
    identity_value: str,
    new_value: Optional[str] = None,
    step: StepFn = noop,
) -> ChangeRequestResult:
    section_id = profile.cr_section_id
    field_name = profile.cr_field
    if new_value is None:
        prefix = "FuncHead" if profile.key == "household" else "FuncMid"
        new_value = unique_cr_value(prefix)

    step("get_all_sections")
    sections_body = staff.post_json(
        "/register-section-metadata/get_all_sections",
        {"register_id": profile.register_id},
    )
    assert_ok(sections_body, "get_all_sections")
    sections = response_payload(sections_body)
    meta = next(
        (
            s
            for s in (sections if isinstance(sections, list) else [])
            if s.get("section_id") == section_id
        ),
        None,
    )
    assert meta, f"section {section_id} not in get_all_sections"
    section_register_id = meta.get("section_register_id")
    is_core = bool(meta.get("is_core_section"))

    step("get_all_tabs")
    tabs_body = staff.post_json(
        "/register-tab-metadata/get_all_tabs",
        {"register_id": profile.register_id},
    )
    assert_ok(tabs_body, "get_all_tabs")
    tabs = response_payload(tabs_body) if isinstance(response_payload(tabs_body), list) else []
    tab_ids = [
        t["tab_id"]
        for t in sorted(tabs, key=lambda t: t.get("tab_order", 0))
        if t.get("tab_id")
    ]

    tab_id = None
    for tid in tab_ids:
        sb = staff.post_json("/register-tab-metadata/get_sections", {"tab_id": tid})
        assert_ok(sb, f"get_sections:{tid}")
        sp = response_payload(sb)
        sids = [
            s.get("section_id")
            for s in (
                sp
                if isinstance(sp, list)
                else sp.get("sections", [])
                if isinstance(sp, dict)
                else []
            )
        ]
        if section_id in sids:
            tab_id = tid
            break
    assert tab_id, f"section {section_id} not on any tab"

    step("get_tab_records")
    tab_records = staff.post_json(
        "/register-data/get_tab_records",
        {
            "subject_register_id": profile.register_id,
            "subject_record_id": subject_internal_record_id,
            "tab_id": tab_id,
        },
    )
    assert_ok(tab_records, "get_tab_records")
    groups = response_payload(tab_records) if isinstance(response_payload(tab_records), list) else []
    record_id = None
    for g in groups:
        if g.get("section_register_id") != section_register_id:
            continue
        recs = g.get("records") or []
        if recs:
            record_id = recs[0].get("internal_record_id")
    assert record_id, f"no record for section_register_id={section_register_id}"

    change_payload = [
        {"internal_record_id": record_id, "edit_action": "UPDATE", field_name: new_value}
    ]
    request_payload = {
        "register_id": profile.register_id,
        "tab_id": tab_id,
        "section_id": section_id,
        "section_register_id": section_register_id,
        "internal_record_id": subject_internal_record_id,
        "change_payload": change_payload,
    }

    if is_core:
        step("create_change_request_for_core_data")
        cr_body = staff.post_json(
            "/change-requests-core-data/create_change_request_for_core_data",
            request_payload,
        )
    else:
        step("create_change_request")
        cr_body = staff.post_json(
            "/change-requests/create_change_request",
            request_payload,
        )
    assert_ok(cr_body, "create_cr")
    cr_payload = response_payload(cr_body)
    cr_id = cr_payload.get("change_request_id") if isinstance(cr_payload, dict) else None
    assert cr_id, f"no change_request_id in response: {cr_body}"

    step(f"created CR {cr_id}: {field_name} -> {new_value!r}")
    return ChangeRequestResult(
        change_request_id=cr_id,
        identity_value=identity_value,
        new_value=new_value,
        section_id=section_id,
        field_name=field_name,
    )


def create_supporting_update_cr(
    staff: StaffClient,
    cfg: Config,
    profile: RegisterProfile,
    *,
    subject_internal_record_id: str,
    identity_value: str,
    supporting_key: Optional[str] = None,
    field_name: Optional[str] = None,
    new_value: Any = None,
    step: StepFn = noop,
) -> ChangeRequestResult:
    """UPDATE an existing child TABLE row (land/assets/…) and return the CR."""
    defaults = PROFILE_SUPPORTING_CR[profile.key]
    supporting_key = supporting_key or defaults["supporting_key"]
    section_id = defaults["section_id"] if supporting_key == defaults["supporting_key"] else None
    if section_id is None:
        section_id = {
            "individual_land": INDIVIDUAL_LAND_SECTION_ID,
            "individual_livelihood": INDIVIDUAL_LIVELIHOOD_TABLE_SECTION_ID,
            "household_assets": HH_ASSETS_SECTION_ID,
            "household_housing": HH_HOUSING_TABLE_SECTION_ID,
        }[supporting_key]
    field_name = field_name or defaults["field_name"]
    if new_value is None:
        new_value = defaults["new_value"]

    step("get_all_sections (supporting)")
    sections_body = staff.post_json(
        "/register-section-metadata/get_all_sections",
        {"register_id": profile.register_id},
    )
    assert_ok(sections_body, "get_all_sections")
    sections = response_payload(sections_body)
    meta = next(
        (
            s
            for s in (sections if isinstance(sections, list) else [])
            if s.get("section_id") == section_id
        ),
        None,
    )
    assert meta, f"section {section_id} not in get_all_sections"
    section_register_id = meta.get("section_register_id")

    step("locate tab for supporting section")
    tabs_body = staff.post_json(
        "/register-tab-metadata/get_all_tabs",
        {"register_id": profile.register_id},
    )
    assert_ok(tabs_body, "get_all_tabs")
    tabs = response_payload(tabs_body) if isinstance(response_payload(tabs_body), list) else []
    tab_ids = [
        t["tab_id"]
        for t in sorted(tabs, key=lambda t: t.get("tab_order", 0))
        if t.get("tab_id")
    ]
    tab_id = None
    for tid in tab_ids:
        sb = staff.post_json("/register-tab-metadata/get_sections", {"tab_id": tid})
        assert_ok(sb, f"get_sections:{tid}")
        sp = response_payload(sb)
        sids = [
            s.get("section_id")
            for s in (
                sp
                if isinstance(sp, list)
                else sp.get("sections", [])
                if isinstance(sp, dict)
                else []
            )
        ]
        if section_id in sids:
            tab_id = tid
            break
    assert tab_id, f"section {section_id} not on any tab"

    step("get_tab_records for supporting row")
    tab_records = staff.post_json(
        "/register-data/get_tab_records",
        {
            "subject_register_id": profile.register_id,
            "subject_record_id": subject_internal_record_id,
            "tab_id": tab_id,
        },
    )
    assert_ok(tab_records, "get_tab_records")
    groups = response_payload(tab_records) if isinstance(response_payload(tab_records), list) else []
    row_match = defaults.get("row_match") or {}
    record_id = None
    candidate_rows: list[dict] = []
    for g in groups:
        if g.get("section_register_id") != section_register_id:
            continue
        for rec in g.get("records") or []:
            if isinstance(rec, dict):
                candidate_rows.append(rec)

    def _matches(rec: dict) -> bool:
        for key, expected in row_match.items():
            actual = rec.get(key)
            if actual != expected and str(actual) != str(expected):
                return False
        return True

    for rec in candidate_rows:
        if _matches(rec):
            record_id = rec.get("internal_record_id")
            break
    if record_id is None and not row_match and candidate_rows:
        record_id = candidate_rows[0].get("internal_record_id")
    assert record_id, (
        f"no supporting row for section_register_id={section_register_id} "
        f"matching {row_match!r}; candidates={candidate_rows!r}"
    )

    change_payload = [
        {
            "internal_record_id": record_id,
            "edit_action": "UPDATE",
            "link_internal_record_id": subject_internal_record_id,
            field_name: new_value,
        }
    ]
    request_payload = {
        "register_id": profile.register_id,
        "tab_id": tab_id,
        "section_id": section_id,
        "section_register_id": section_register_id,
        "internal_record_id": subject_internal_record_id,
        "change_payload": change_payload,
    }

    step(f"create_change_request supporting {supporting_key}.{field_name}")
    cr_body = staff.post_json(
        "/change-requests/create_change_request",
        request_payload,
    )
    assert_ok(cr_body, "create_supporting_cr")
    cr_payload = response_payload(cr_body)
    cr_id = cr_payload.get("change_request_id") if isinstance(cr_payload, dict) else None
    assert cr_id, f"no change_request_id in response: {cr_body}"

    step(f"created supporting CR {cr_id}: {supporting_key}.{field_name} -> {new_value!r}")
    return ChangeRequestResult(
        change_request_id=cr_id,
        identity_value=identity_value,
        new_value=str(new_value),
        section_id=section_id,
        field_name=field_name,
        supporting_key=supporting_key,
        raw_new_value=new_value,
        child_internal_record_id=record_id,
    )


def create_middle_name_cr(
    staff: StaffClient,
    cfg: Config,
    *,
    subject_internal_record_id: str,
    first_name: str,
    new_middle_name: Optional[str] = None,
    step: StepFn = noop,
) -> ChangeRequestResult:
    """Back-compat wrapper for Individual middle_name CR (UI fixtures)."""
    return create_field_cr(
        staff,
        cfg,
        INDIVIDUAL,
        subject_internal_record_id=subject_internal_record_id,
        identity_value=first_name,
        new_value=new_middle_name,
        step=step,
    )


def verify_and_approve_cr(
    staff: StaffClient, change_request_id: str, step: StepFn = noop
) -> None:
    step("add_verification_for_change_request")
    assert_ok(
        staff.post_json(
            "/change-requests/add_verification_for_change_request",
            {"change_request_id": change_request_id, "is_approved": True},
        ),
        "add_verification_for_cr",
    )
    step("approve_change_request")
    assert_ok(
        staff.post_json(
            "/change-requests/approve_change_request",
            {"change_request_id": change_request_id},
        ),
        "approve_cr",
    )
