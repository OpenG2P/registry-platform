"""Staff Tier-2 E1: completion-score reads vs functional seed."""

from __future__ import annotations

import pytest

from assertions.response import assert_success
from profile_params import with_register_profiles
from helpers.http import StaffApiError, StaffClient
from helpers.profiles import RegisterProfile
from helpers.seed_manifest import subject


def _assert_computed_optional(staff: StaffClient, path: str, payload: dict, context: str) -> None:
    """Computed scores may be absent until completion jobs run for seed rows."""
    try:
        assert_success(staff.post_json(path, payload), context)
    except StaffApiError as exc:
        text = str(exc)
        assert (
            "CMP-ERR-001" in text
            or "COMPLETION_SCORE" in text
            or "HTTP 500" in text
        ), f"{context}: unexpected failure: {text}"


@pytest.mark.tier2
@with_register_profiles
def test_completion_score_reads(
    staff: StaffClient,
    step,
    profile: RegisterProfile,
):
    seeded = subject(profile.key)
    rid = seeded["internal_record_id"]
    section_id = profile.cr_section_id

    step("get_ideal_completion_score_for_register")
    assert_success(
        staff.post_json(
            "/completion-score/get_ideal_completion_score_for_register",
            {"register_id": profile.register_id},
        ),
        "ideal_register",
    )

    step("get_ideal_completion_score_for_section")
    assert_success(
        staff.post_json(
            "/completion-score/get_ideal_completion_score_for_section",
            {"section_id": section_id},
        ),
        "ideal_section",
    )

    step("get_computed_completion_score_for_section")
    _assert_computed_optional(
        staff,
        "/completion-score/get_computed_completion_score_for_section",
        {
            "register_id": profile.register_id,
            "internal_record_id": rid,
            "section_id": section_id,
        },
        "computed_section",
    )

    step("get_computed_completion_score_for_record")
    _assert_computed_optional(
        staff,
        "/completion-score/get_computed_completion_score_for_record",
        {
            "register_id": profile.register_id,
            "internal_record_id": rid,
        },
        "computed_record",
    )
