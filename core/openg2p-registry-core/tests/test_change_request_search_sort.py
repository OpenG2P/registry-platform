from __future__ import annotations

import ast
import textwrap
from pathlib import Path

_SERVICE_PATH = (
    Path(__file__).resolve().parents[1]
    / "src"
    / "openg2p_registry_core"
    / "services"
    / "g2p_register_change_request_service.py"
)


def _load_parse_change_request_search_sort():
    source = _SERVICE_PATH.read_text()
    tree = ast.parse(source)
    func_src = ""
    for node in tree.body:
        if not isinstance(node, ast.ClassDef) or node.name != "G2PRegisterChangeRequestService":
            continue
        for item in node.body:
            if (
                isinstance(item, ast.FunctionDef)
                and item.name == "_parse_change_request_search_sort"
            ):
                func_src = ast.get_source_segment(source, item) or ""
        break

    wrapper = "class _Parser:\n" + textwrap.indent(
        "@staticmethod\n" + func_src, "    "
    )
    namespace: dict = {}
    exec(wrapper, namespace)
    return namespace["_Parser"]._parse_change_request_search_sort


def _method_calls(method_name: str) -> set[str]:
    source = _SERVICE_PATH.read_text()
    tree = ast.parse(source)
    for node in tree.body:
        if not isinstance(node, ast.ClassDef) or node.name != "G2PRegisterChangeRequestService":
            continue
        for item in node.body:
            if isinstance(item, ast.AsyncFunctionDef) and item.name == method_name:
                return {
                    call.func.attr
                    for call in ast.walk(item)
                    if isinstance(call, ast.Call) and isinstance(call.func, ast.Attribute)
                }
    raise AssertionError(f"{method_name} was not found")


parse_sort = _load_parse_change_request_search_sort()


def test_empty_sort_by_defaults_to_created_at_desc():
    assert parse_sort(None) == (None, True)
    assert parse_sort("") == (None, True)
    assert parse_sort("   ") == (None, True)


def test_dash_prefix_bare_field_is_asc():
    assert parse_sort("created_at") == ("created_at", False)
    assert parse_sort("record_name") == ("record_name", False)
    assert parse_sort("created_by") == ("created_by", False)
    assert parse_sort("approval_status") == ("approval_status", False)


def test_dash_prefix_minus_is_desc():
    assert parse_sort("-created_at") == ("created_at", True)
    assert parse_sort("-record_name") == ("record_name", True)


def test_field_dir_still_accepted():
    assert parse_sort("created_at:desc") == ("created_at", True)
    assert parse_sort("created_at:asc") == ("created_at", False)
    assert parse_sort("record_name:DESC") == ("record_name", True)


def test_unknown_fields_are_parsed_and_resolved_by_hasattr():
    assert parse_sort("register_mnemonic") == ("register_mnemonic", False)
    assert parse_sort("-tab_label") == ("tab_label", True)
    assert parse_sort("search_text") == ("search_text", False)


def test_search_applies_parsed_sort():
    calls = _method_calls("_search_in_change_request")
    assert "_apply_change_request_search_sort" in calls
