"""Staff Tier-2 E1: register-data get_scores / get_score_history."""

from __future__ import annotations

import pytest

from assertions.response import assert_success
from profile_params import with_register_profiles
from helpers.http import StaffClient
from helpers.lists import as_list
from helpers.profiles import RegisterProfile
from helpers.seed_manifest import subject


_PAGE = {"current_page": 1, "page_size": 20}


@pytest.mark.tier2
@with_register_profiles
def test_register_score_reads(
    staff: StaffClient,
    step,
    profile: RegisterProfile,
):
    rid = subject(profile.key)["internal_record_id"]

    step("get_scores")
    scores = assert_success(
        staff.post_json(
            "/register-data/get_scores",
            {"link_internal_record_id": rid},
        ),
        "get_scores",
    )
    assert scores is not None

    score_type = None
    for row in as_list(scores):
        if isinstance(row, dict) and row.get("score_type"):
            score_type = row["score_type"]
            break
    if not score_type:
        defs = as_list(
            assert_success(
                staff.post_json(
                    "/computation-score/get_score_definitions",
                    {"register_id": profile.register_id},
                    pagination_request=_PAGE,
                ),
                "defs_for_history",
            )
        )
        for d in defs:
            if isinstance(d, dict) and d.get("score_type"):
                score_type = d["score_type"]
                break
    if not score_type:
        score_type = "FUNC_TIER2"

    step(f"get_score_history score_type={score_type}")
    assert_success(
        staff.post_json(
            "/register-data/get_score_history",
            {
                "link_internal_record_id": rid,
                "score_type": score_type,
            },
        ),
        "get_score_history",
    )
