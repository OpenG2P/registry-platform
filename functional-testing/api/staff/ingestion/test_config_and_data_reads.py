"""Staff Tier-2 E1: ingestion-config + ingestion-data reads."""

from __future__ import annotations

import pytest

from assertions.response import assert_success
from helpers.http import StaffClient
from helpers.lists import as_list, first_id


_PAGE = {"current_page": 1, "page_size": 20}


@pytest.mark.tier2
def test_ingestion_config_and_data_reads(staff: StaffClient, step):
    step("ingestion-config list endpoints")
    key_paths = as_list(
        assert_success(
            staff.post_json(
                "/ingestion-config/get_all_incoming_key_paths",
                {},
                pagination_request=_PAGE,
            ),
            "get_all_incoming_key_paths",
        )
    )
    kid = first_id(key_paths, "key_path_id")
    if kid:
        assert_success(
            staff.post_json(
                "/ingestion-config/get_incoming_key_path",
                {"key_path_id": kid},
            ),
            "get_incoming_key_path",
        )

    patterns = as_list(
        assert_success(
            staff.post_json(
                "/ingestion-config/get_all_semantic_patterns",
                {},
                pagination_request=_PAGE,
            ),
            "get_all_semantic_patterns",
        )
    )
    pid = first_id(patterns, "semantic_pattern_id")
    if pid:
        assert_success(
            staff.post_json(
                "/ingestion-config/get_semantic_pattern",
                {"semantic_pattern_id": pid},
            ),
            "get_semantic_pattern",
        )

    reg_patterns = as_list(
        assert_success(
            staff.post_json(
                "/ingestion-config/get_all_register_semantic_patterns",
                {},
                pagination_request=_PAGE,
            ),
            "get_all_register_semantic_patterns",
        )
    )
    rpid = first_id(reg_patterns, "register_semantic_pattern_id")
    if rpid:
        assert_success(
            staff.post_json(
                "/ingestion-config/get_register_semantic_pattern",
                {"register_semantic_pattern_id": rpid},
            ),
            "get_register_semantic_pattern",
        )

    templates = as_list(
        assert_success(
            staff.post_json(
                "/ingestion-config/get_all_templates",
                {},
                pagination_request=_PAGE,
            ),
            "get_all_templates",
        )
    )
    tid = first_id(templates, "template_id")
    if tid:
        assert_success(
            staff.post_json(
                "/ingestion-config/get_template",
                {"template_id": tid},
            ),
            "get_template",
        )

    assert_success(
        staff.post_json(
            "/ingestion-config/get_all_subscription_activity_logs",
            {},
            pagination_request=_PAGE,
        ),
        "get_all_subscription_activity_logs",
    )

    step("ingestion-data summary + search")
    assert_success(
        staff.post_json("/ingestion-data/get_ingestion_summary_data", {}),
        "get_ingestion_summary_data",
    )
    hits = as_list(
        assert_success(
            staff.post_json(
                "/ingestion-data/search_in_ingestion_data",
                {},
                pagination_request=_PAGE,
            ),
            "search_in_ingestion_data",
        )
    )
    ingest_id = first_id(hits, "ingest_id")
    if ingest_id:
        assert_success(
            staff.post_json(
                "/ingestion-data/get_raw_payload",
                {"ingest_id": ingest_id},
            ),
            "get_raw_payload",
        )
        assert_success(
            staff.post_json(
                "/ingestion-data/get_enriched_and_transformed_payload",
                {"ingest_id": ingest_id},
            ),
            "get_enriched_and_transformed_payload",
        )
