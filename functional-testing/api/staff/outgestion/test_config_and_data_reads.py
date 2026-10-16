"""Staff Tier-2 E1: outgestion-config + outgestion-data reads."""

from __future__ import annotations

import pytest

from assertions.response import assert_success
from helpers.http import StaffClient
from helpers.lists import as_list, first_id


_PAGE = {"current_page": 1, "page_size": 20}


@pytest.mark.tier2
def test_outgestion_config_and_data_reads(staff: StaffClient, step):
    step("outgestion-config topics + templates")
    topics = as_list(
        assert_success(
            staff.post_json(
                "/outgestion-config/get_all_topics",
                {},
                pagination_request=_PAGE,
            ),
            "get_all_topics",
        )
    )
    topic_id = first_id(topics, "topic_id")
    if topic_id:
        assert_success(
            staff.post_json("/outgestion-config/get_topic", {"topic_id": topic_id}),
            "get_topic",
        )

    templates = as_list(
        assert_success(
            staff.post_json(
                "/outgestion-config/get_all_templates",
                {},
                pagination_request=_PAGE,
            ),
            "get_all_templates",
        )
    )
    tid = first_id(templates, "template_id")
    if tid:
        assert_success(
            staff.post_json("/outgestion-config/get_template", {"template_id": tid}),
            "get_template",
        )

    step("outgestion-data summary + search")
    assert_success(
        staff.post_json("/outgestion-data/get_outgestion_summary_data", {}),
        "get_outgestion_summary_data",
    )
    assert_success(
        staff.post_json(
            "/outgestion-data/search_in_outgestion_data",
            {},
            pagination_request=_PAGE,
        ),
        "search_in_outgestion_data",
    )
