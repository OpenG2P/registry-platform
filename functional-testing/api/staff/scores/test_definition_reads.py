"""Staff Tier-2 E1: computation-score definition reads."""

from __future__ import annotations

import pytest

from assertions.response import assert_success
from profile_params import with_register_profiles
from helpers.http import StaffClient
from helpers.lists import as_list, first_id
from helpers.profiles import RegisterProfile


_PAGE = {"current_page": 1, "page_size": 20}


@pytest.mark.tier2
@with_register_profiles
def test_score_definition_reads(
    staff: StaffClient,
    step,
    profile: RegisterProfile,
):
    step("get_score_definitions")
    defs = as_list(
        assert_success(
            staff.post_json(
                "/computation-score/get_score_definitions",
                {"register_id": profile.register_id},
                pagination_request=_PAGE,
            ),
            "get_score_definitions",
        )
    )
    def_id = first_id(defs, "score_definition_id")
    if not def_id:
        return

    step("get_score_contributing_attributes")
    assert_success(
        staff.post_json(
            "/computation-score/get_score_contributing_attributes",
            {"score_definition_id": def_id},
            pagination_request=_PAGE,
        ),
        "get_score_contributing_attributes",
    )
