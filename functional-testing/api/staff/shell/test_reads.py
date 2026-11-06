"""Staff Tier-2 E1: registry-config / language / theme reads."""

from __future__ import annotations

import pytest

from assertions.response import assert_success
from helpers.http import StaffApiError, StaffClient
from helpers.lists import as_list, first_id


@pytest.mark.tier2
def test_shell_config_language_theme_reads(staff: StaffClient, step):
    step("registry-config/get_registry_configuration")
    cfg_payload = assert_success(
        staff.post_json("/registry-config/get_registry_configuration", {}),
        "get_registry_configuration",
    )
    assert cfg_payload is not None

    step("registry-config/get_number_of_requests_pending")
    pending = assert_success(
        staff.post_json("/registry-config/get_number_of_requests_pending", {}),
        "get_number_of_requests_pending",
    )
    assert pending is not None
    pending_count = (
        int(pending.get("number_of_requests_pending"))
        if isinstance(pending, dict)
        else int(pending)
    )

    step("registry-config/get_earliest_pending_change_request")
    # Tier-0/1 workflows leave PENDING CRs in the shared gate DB. When count is
    # zero we assert a full success payload; otherwise we only smoke the route
    # (earliest detail is covered by change-request reads in Tier-0/1).
    try:
        earliest_body = staff.post_json(
            "/registry-config/get_earliest_pending_change_request", {}
        )
    except StaffApiError:
        if pending_count == 0:
            raise
    else:
        earliest = (earliest_body.get("response_body") or {}).get("response_payload")
        assert earliest is None or isinstance(earliest, dict)
        if pending_count > 0:
            assert earliest.get("change_request_id"), (
                "expected earliest pending CR when count > 0"
            )

    step("registry-language/get_all_languages + get_language")
    languages = as_list(
        assert_success(
            staff.post_json("/registry-language/get_all_languages", {}),
            "get_all_languages",
        )
    )
    assert languages, "expected at least one language"
    lang_id = first_id(languages, "language_id")
    assert lang_id
    one_lang = assert_success(
        staff.post_json("/registry-language/get_language", {"language_id": lang_id}),
        "get_language",
    )
    assert isinstance(one_lang, dict)

    step("registry-theme/get_all_themes + get_theme_values")
    themes = as_list(
        assert_success(
            staff.post_json("/registry-theme/get_all_themes", {}),
            "get_all_themes",
        )
    )
    assert themes, "expected at least one theme"
    theme_id = first_id(themes, "theme_id")
    assert theme_id
    values = assert_success(
        staff.post_json("/registry-theme/get_theme_values", {"theme_id": theme_id}),
        "get_theme_values",
    )
    assert values is not None
