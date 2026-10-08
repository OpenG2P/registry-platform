"""Staff Tier-2 E1: registrant authentication provider / status / history reads."""

from __future__ import annotations

import pytest

from assertions.response import assert_success
from profile_params import with_register_profiles
from helpers.http import StaffClient
from helpers.profiles import RegisterProfile
from helpers.seed_manifest import subject


@pytest.mark.tier2
@with_register_profiles
def test_registrant_auth_reads(
    staff: StaffClient,
    step,
    profile: RegisterProfile,
):
    rid = subject(profile.key)["internal_record_id"]

    step("get_available_authentication_providers")
    assert_success(
        staff.post_json(
            "/register-data/get_available_authentication_providers",
            {"register_id": profile.register_id},
        ),
        "get_available_authentication_providers",
    )

    step("get_registrant_authentication_status")
    assert_success(
        staff.post_json(
            "/register-data/get_registrant_authentication_status",
            {"internal_record_id": rid},
        ),
        "get_registrant_authentication_status",
    )

    step("get_registrant_authentication_history")
    assert_success(
        staff.post_json(
            "/register-data/get_registrant_authentication_history",
            {"internal_record_id": rid},
        ),
        "get_registrant_authentication_history",
    )
