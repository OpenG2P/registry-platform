"""Approval must apply an explicit null parent link (household delink).

Loads only the methods under test from the service source so the test does
not need the full runtime.
"""
from __future__ import annotations

import ast
import textwrap
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace

from sqlalchemy import Date as SQLDate

_SERVICE_PATH = (
    Path(__file__).resolve().parents[1]
    / "src"
    / "openg2p_registry_core"
    / "services"
    / "g2p_register_change_request_service.py"
)


def _load_service():
    source = _SERVICE_PATH.read_text()
    tree = ast.parse(source)
    methods: list[str] = []
    for node in tree.body:
        if not isinstance(node, ast.ClassDef) or node.name != "G2PRegisterChangeRequestService":
            continue
        for item in node.body:
            if isinstance(item, ast.FunctionDef) and item.name in {
                "_normalize_model_value",
                "_update_existing_record",
            }:
                methods.append(ast.get_source_segment(source, item) or "")
        break
    assert len(methods) == 2, "expected _normalize_model_value and _update_existing_record"
    wrapper = "class _Service:\n" + textwrap.indent("\n".join(methods), "    ")
    namespace: dict = {
        "inspect": lambda _model: SimpleNamespace(
            columns={
                "link_internal_record_id": SimpleNamespace(type=object()),
                "first_name": SimpleNamespace(type=object()),
                "internal_record_id": SimpleNamespace(type=object()),
            }
        ),
        "SQLDate": SQLDate,
        "datetime": datetime,
    }
    exec(wrapper, namespace)
    return namespace["_Service"]


_Service = _load_service()


def _existing(**fields):
    defaults = {
        "internal_record_id": "ind-1",
        "link_internal_record_id": "hh-1",
        "first_name": "Ada",
    }
    defaults.update(fields)
    return SimpleNamespace(**defaults)


def test_explicit_null_link_clears_existing_parent():
    existing = _existing()
    _Service()._update_existing_record(
        existing,
        {"link_internal_record_id": None, "first_name": None},
        {
            "edit_action": "UPDATE",
            "internal_record_id": "ind-1",
            "link_internal_record_id": None,
        },
        object,
    )
    assert existing.link_internal_record_id is None
    assert existing.first_name == "Ada"
    assert existing.internal_record_id == "ind-1"


def test_explicit_null_link_applies_when_schema_dict_omits_none():
    existing = _existing()
    _Service()._update_existing_record(
        existing,
        {"first_name": "Ada"},
        {
            "edit_action": "UPDATE",
            "internal_record_id": "ind-1",
            "link_internal_record_id": None,
        },
        object,
    )
    assert existing.link_internal_record_id is None


def test_omitted_link_leaves_existing_parent():
    existing = _existing()
    _Service()._update_existing_record(
        existing,
        {"link_internal_record_id": None, "first_name": "Ada Lovelace"},
        {
            "edit_action": "UPDATE",
            "internal_record_id": "ind-1",
            "first_name": "Ada Lovelace",
        },
        object,
    )
    assert existing.link_internal_record_id == "hh-1"
    assert existing.first_name == "Ada Lovelace"


def test_new_link_replaces_existing_parent():
    existing = _existing()
    _Service()._update_existing_record(
        existing,
        {"link_internal_record_id": "hh-2"},
        {
            "edit_action": "UPDATE",
            "internal_record_id": "ind-1",
            "link_internal_record_id": "hh-2",
        },
        object,
    )
    assert existing.link_internal_record_id == "hh-2"
