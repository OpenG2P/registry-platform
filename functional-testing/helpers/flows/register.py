"""Register search / wait / subject-record helpers."""

from __future__ import annotations

import time
from typing import Any

from helpers.config import REGISTER_INDIVIDUAL
from helpers.http import StaffClient
from helpers.profiles import RegisterProfile
from helpers.util import assert_ok, response_payload


def search_register_by_text(
    staff: StaffClient,
    text: str,
    *,
    register_id: str = REGISTER_INDIVIDUAL,
    page_size: int = 20,
) -> list[dict]:
    body = staff.post_json(
        "/register-data/search_in_a_register",
        {"register_id": register_id},
        pagination_request={"current_page": 1, "page_size": page_size, "search_text": text},
    )
    assert_ok(body, "search")
    payload = response_payload(body)
    return payload if isinstance(payload, list) else []


def hit_matches_identity(hit: dict, identity: str) -> bool:
    record_name = str(hit.get("record_name") or "")
    return (
        hit.get("first_name") == identity
        or hit.get("household_head_name") == identity
        or identity in str(hit.get("first_name") or "")
        or identity in str(hit.get("household_head_name") or "")
        or identity in record_name
        or identity in str(hit.get("search_text") or "")
        or identity in str(hit)
    )


def wait_for_register_record(
    staff: StaffClient,
    profile: RegisterProfile,
    identity: str,
    *,
    timeout: float = 90,
) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        hits = search_register_by_text(staff, identity, register_id=profile.register_id)
        for h in hits:
            if hit_matches_identity(h, identity):
                assert h.get("internal_record_id"), "search hit missing internal_record_id"
                return h
        time.sleep(3)
    raise AssertionError(
        f"{profile.key} record for {identity!r} not found within {timeout}s"
    )


def get_subject_record(
    staff: StaffClient, profile: RegisterProfile, internal_record_id: str
) -> dict[str, Any]:
    body = staff.post_json(
        "/register-data/get_subject_record",
        {
            "subject_register_id": profile.register_id,
            "subject_record_id": internal_record_id,
        },
    )
    payload = assert_ok(body, "get_subject_record")
    if isinstance(payload, dict) and isinstance(payload.get("record"), dict):
        return payload["record"]
    assert isinstance(payload, dict), "get_subject_record payload must be dict"
    return payload


def get_section_records_from_tab(
    staff: StaffClient,
    profile: RegisterProfile,
    subject_internal_record_id: str,
    *,
    tab_id: str,
    section_register_id: str,
) -> list[dict[str, Any]]:
    """Return records[] for a child/subject section_register_id from get_tab_records."""
    body = staff.post_json(
        "/register-data/get_tab_records",
        {
            "subject_register_id": profile.register_id,
            "subject_record_id": subject_internal_record_id,
            "tab_id": tab_id,
        },
    )
    assert_ok(body, f"get_tab_records:{tab_id}")
    groups = response_payload(body)
    if not isinstance(groups, list):
        return []
    for group in groups:
        if group.get("section_register_id") != section_register_id:
            continue
        records = group.get("records") or []
        return [r for r in records if isinstance(r, dict)]
    return []
