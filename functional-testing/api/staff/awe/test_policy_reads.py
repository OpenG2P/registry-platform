"""Staff Tier-2 E1: AWE policy configuration reads."""

from __future__ import annotations

import pytest

from assertions.response import assert_success
from helpers.http import StaffClient
from helpers.lists import as_list, first_id


_PAGE = {"current_page": 1, "page_size": 20}


@pytest.mark.tier2
def test_awe_policy_reads(staff: StaffClient, step):
    step("get_all_awe_policy_configurations")
    rows = as_list(
        assert_success(
            staff.post_json(
                "/awe-policy-config/get_all_awe_policy_configurations",
                {},
                pagination_request=_PAGE,
            ),
            "get_all_awe_policy_configurations",
        )
    )
    pid = first_id(rows, "awe_policy_config_id")
    if pid:
        step("get_awe_policy_configuration")
        one = assert_success(
            staff.post_json(
                "/awe-policy-config/get_awe_policy_configuration",
                {"awe_policy_config_id": pid},
            ),
            "get_awe_policy_configuration",
        )
        assert isinstance(one, dict)
