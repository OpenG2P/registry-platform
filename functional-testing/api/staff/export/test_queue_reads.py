"""Staff Tier-2 E1: export queue read."""

from __future__ import annotations

import pytest

from assertions.response import assert_success
from helpers.http import StaffClient


@pytest.mark.tier2
def test_export_queue_reads(staff: StaffClient, step):
    step("get_export_queue_records")
    payload = assert_success(
        staff.post_json(
            "/register-data/get_export_queue_records",
            {},
            pagination_request={"current_page": 1, "page_size": 20},
        ),
        "get_export_queue_records",
    )
    assert payload is not None
