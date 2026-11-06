"""Staff Tier-2 E2: language + theme CRUD with cleanup (no factory/default deletes)."""

from __future__ import annotations

import uuid

import pytest

from assertions.response import assert_success
from helpers.http import StaffClient
from helpers.lists import as_list


def _theme_values() -> list[dict[str, str]]:
    return [
        {"attribute_name": "primary_color_1", "attribute_value": "#112233"},
        {"attribute_name": "primary_color_2", "attribute_value": "#445566"},
        {"attribute_name": "secondary_color_1", "attribute_value": "#778899"},
        {"attribute_name": "secondary_color_2", "attribute_value": "#aabbcc"},
        {"attribute_name": "secondary_color_3", "attribute_value": "#ddeeff"},
        {"attribute_name": "neutral_color_1", "attribute_value": "#111111"},
        {"attribute_name": "neutral_color_2", "attribute_value": "#eeeeee"},
        {"attribute_name": "font_family", "attribute_value": "Inter"},
        {"attribute_name": "font_url", "attribute_value": "https://example.invalid/font"},
        {"attribute_name": "dashboard_image", "attribute_value": ""},
    ]


@pytest.mark.tier2
def test_language_crud_with_cleanup(staff: StaffClient, step):
    suffix = uuid.uuid4().hex[:8]
    code = f"f{suffix[:7]}"  # keep short language_code
    label = f"FuncTier2Lang-{suffix}"
    language_id = None
    try:
        step("create_language")
        created = assert_success(
            staff.post_json(
                "/registry-language/create_language",
                {
                    "language_code": code,
                    "language_label": label,
                    "is_default": False,
                },
            ),
            "create_language",
        )
        assert isinstance(created, dict)
        language_id = created.get("language_id")
        assert language_id

        step("get_language")
        got = assert_success(
            staff.post_json(
                "/registry-language/get_language",
                {"language_id": language_id},
            ),
            "get_language",
        )
        assert isinstance(got, dict)
        assert got.get("language_label") == label or got.get("language_code") == code

        step("update_language")
        new_label = f"{label}-upd"
        assert_success(
            staff.post_json(
                "/registry-language/update_language",
                {
                    "language_id": language_id,
                    "language_label": new_label,
                },
            ),
            "update_language",
        )
    finally:
        if language_id:
            step("remove_language")
            assert_success(
                staff.post_json(
                    "/registry-language/remove_language",
                    {"language_id": language_id},
                ),
                "remove_language",
            )


@pytest.mark.tier2
def test_theme_crud_with_cleanup(staff: StaffClient, step):
    suffix = uuid.uuid4().hex[:8]
    mnemonic = f"func_tier2_theme_{suffix}"
    theme_id = None
    try:
        step("create_theme")
        created = assert_success(
            staff.post_json(
                "/registry-theme/create_theme",
                {
                    "theme_mnemonic": mnemonic,
                    "theme_values": _theme_values(),
                },
            ),
            "create_theme",
        )
        assert isinstance(created, dict)
        theme_id = created.get("theme_id")
        assert theme_id

        step("get_theme_values")
        assert_success(
            staff.post_json(
                "/registry-theme/get_theme_values",
                {"theme_id": theme_id},
            ),
            "get_theme_values",
        )

        step("update_theme_values")
        assert_success(
            staff.post_json(
                "/registry-theme/update_theme_values",
                {
                    "theme_id": theme_id,
                    "theme_attribute_values": [
                        {"attribute_name": "primary_color_1", "attribute_value": "#abcdef"},
                    ],
                },
            ),
            "update_theme_values",
        )

        themes = as_list(
            assert_success(
                staff.post_json("/registry-theme/get_all_themes", {}),
                "get_all_themes",
            )
        )
        match = next(
            (t for t in themes if isinstance(t, dict) and t.get("theme_id") == theme_id),
            None,
        )
        assert match is not None
        assert match.get("is_factory_shipped") in (False, None, "FALSE", "false")
    finally:
        if theme_id:
            step("remove_theme")
            assert_success(
                staff.post_json(
                    "/registry-theme/remove_theme",
                    {"theme_id": theme_id},
                ),
                "remove_theme",
            )


@pytest.mark.tier2
def test_registry_config_update_reversible(staff: StaffClient, step):
    step("get_registry_configuration")
    cfg = assert_success(
        staff.post_json("/registry-config/get_registry_configuration", {}),
        "get_registry_configuration",
    )
    assert isinstance(cfg, dict)
    configuration_id = cfg.get("configuration_id")
    original_name = cfg.get("registry_name")
    if not configuration_id or original_name is None:
        pytest.skip("registry configuration missing id/name")

    marker = f"{original_name} [func-tier2]"
    try:
        step("update_registry_configuration (temp name)")
        assert_success(
            staff.post_json(
                "/registry-config/update_registry_configuration",
                {
                    "configuration_id": configuration_id,
                    "registry_name": marker,
                },
            ),
            "update_registry_configuration",
        )
        updated = assert_success(
            staff.post_json("/registry-config/get_registry_configuration", {}),
            "get after update",
        )
        assert isinstance(updated, dict)
        assert updated.get("registry_name") == marker
    finally:
        step("restore registry_name")
        assert_success(
            staff.post_json(
                "/registry-config/update_registry_configuration",
                {
                    "configuration_id": configuration_id,
                    "registry_name": original_name,
                },
            ),
            "restore_registry_configuration",
        )
