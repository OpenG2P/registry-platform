"""Staff Tier-2 E1: cross-register change-request reads."""

from __future__ import annotations

import pytest

from assertions.response import assert_success
from profile_params import with_register_profiles
from helpers.http import StaffClient
from helpers.profiles import RegisterProfile
from helpers.seed_manifest import subject


@pytest.mark.tier2
@pytest.mark.change_request
@with_register_profiles
def test_cross_register_change_reads(
    staff: StaffClient,
    step,
    profile: RegisterProfile,
):
    rid = subject(profile.key)["internal_record_id"]
    payload = {
        "subject_register_id": profile.register_id,
        "subject_record_id": rid,
    }

    step("get_number_of_cross_register_changes")
    count = assert_success(
        staff.post_json(
            "/change-requests/get_number_of_cross_register_changes",
            payload,
        ),
        "get_number_of_cross_register_changes",
    )
    assert count is not None

    step("get_cross_register_changes")
    assert_success(
        staff.post_json(
            "/change-requests/get_cross_register_changes",
            payload,
        ),
        "get_cross_register_changes",
    )
