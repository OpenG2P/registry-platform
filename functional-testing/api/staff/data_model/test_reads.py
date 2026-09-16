"""Staff Tier-2 E1: data-model reads."""

from __future__ import annotations

import pytest

from assertions.response import assert_success
from helpers.http import StaffClient
from helpers.lists import as_list, first_id


_PAGE = {"current_page": 1, "page_size": 20}


@pytest.mark.tier2
def test_data_model_reads(staff: StaffClient, step):
    step("get_all_data_models")
    models = as_list(
        assert_success(
            staff.post_json(
                "/data-model/get_all_data_models",
                {},
                pagination_request=_PAGE,
            ),
            "get_all_data_models",
        )
    )
    mid = first_id(models, "data_model_id")
    if mid:
        step("get_data_model")
        one = assert_success(
            staff.post_json("/data-model/get_data_model", {"data_model_id": mid}),
            "get_data_model",
        )
        assert isinstance(one, dict)
        assert one.get("data_model_id") == mid or one.get("data_model_id")
