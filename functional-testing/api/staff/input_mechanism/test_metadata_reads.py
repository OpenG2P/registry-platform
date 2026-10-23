"""Staff Tier-2 E1: input-mechanism-metadata reads."""

from __future__ import annotations

import pytest

from assertions.response import assert_success
from profile_params import with_register_profiles
from helpers.http import StaffClient
from helpers.profiles import RegisterProfile


_PAGE = {"current_page": 1, "page_size": 20}


@pytest.mark.tier2
@with_register_profiles
def test_input_mechanism_metadata_reads(
    staff: StaffClient,
    step,
    profile: RegisterProfile,
):
    step("get_all_input_mechanisms")
    assert_success(
        staff.post_json(
            "/input-mechanism-metadata/get_all_input_mechanisms",
            {"register_id": profile.register_id},
        ),
        "get_all_input_mechanisms",
    )

    step("VC configuration reads")
    assert_success(
        staff.post_json(
            "/input-mechanism-metadata/get_all_vc_configurations",
            {},
            pagination_request=_PAGE,
        ),
        "get_all_vc_configurations",
    )
    assert_success(
        staff.post_json(
            "/input-mechanism-metadata/get_vc_configuration_for_register",
            {"register_id": profile.register_id},
            pagination_request=_PAGE,
        ),
        "get_vc_configuration_for_register",
    )

    step("import-file configuration reads")
    assert_success(
        staff.post_json(
            "/input-mechanism-metadata/get_all_import_file_configurations",
            {},
            pagination_request=_PAGE,
        ),
        "get_all_import_file_configurations",
    )
    assert_success(
        staff.post_json(
            "/input-mechanism-metadata/get_import_file_configuration_for_register",
            {"register_id": profile.register_id},
            pagination_request=_PAGE,
        ),
        "get_import_file_configuration_for_register",
    )
