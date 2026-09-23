"""Change requests on supporting (child) sections inherit the subject register's record_name.

Loads only the method under test from the service source (like
test_change_request_search_sort.py) so the test does not need the full runtime.
"""
from __future__ import annotations

import ast
import asyncio
import textwrap
from pathlib import Path
from types import SimpleNamespace

_SERVICE_PATH = (
    Path(__file__).resolve().parents[1]
    / "src"
    / "openg2p_registry_core"
    / "services"
    / "g2p_register_change_request_service.py"
)


def _load_resolver():
    source = _SERVICE_PATH.read_text()
    tree = ast.parse(source)
    func_src = ""
    for node in tree.body:
        if not isinstance(node, ast.ClassDef) or node.name != "G2PRegisterChangeRequestService":
            continue
        for item in node.body:
            if isinstance(item, ast.AsyncFunctionDef) and item.name == "_resolve_change_request_record_name":
                func_src = ast.get_source_segment(source, item) or ""
        break
    assert func_src, "_resolve_change_request_record_name not found"
    wrapper = "class _Service:\n" + textwrap.indent(func_src, "    ")
    namespace: dict = {
        "AsyncSession": object,
        "_logger": SimpleNamespace(warning=lambda *a, **k: None),
    }
    exec(wrapper, namespace)
    return namespace["_Service"]


_Service = _load_resolver()
FARMER = "farmer-register"
CROP = "crop-register"


class _Stub(_Service):
    def __init__(self, subject=None, fail=False):
        self.subject = subject
        self.fail = fail
        self.lookups: list[tuple[str, str]] = []

    async def _get_register_class_and_schema(self, register_id, session):
        if self.fail:
            raise RuntimeError("boom")
        return None, f"class:{register_id}", None

    async def _get_existing_record(self, register_class, internal_record_id, session):
        self.lookups.append((register_class, internal_record_id))
        return self.subject


def _run(coro):
    return asyncio.run(coro)


def test_child_section_inherits_subject_record_name():
    svc = _Stub(subject=SimpleNamespace(record_name="Lance Hoffman"))
    assert _run(svc._resolve_change_request_record_name("s", FARMER, CROP, "rec-1", "CROP_TEFF SUMMER")) == "Lance Hoffman"
    assert svc.lookups == [(f"class:{FARMER}", "rec-1")]


def test_child_section_without_subject_keeps_section_name():
    svc = _Stub(subject=None)
    assert _run(svc._resolve_change_request_record_name("s", FARMER, CROP, "rec-1", "Crop 1234")) == "Crop 1234"


def test_same_register_keeps_payload_name_without_lookup():
    svc = _Stub(subject=SimpleNamespace(record_name="Lance Hoffman"))
    assert _run(svc._resolve_change_request_record_name("s", FARMER, FARMER, "rec-1", "Lance H.")) == "Lance H."
    assert svc.lookups == []


def test_same_register_falls_back_to_live_record_name():
    svc = _Stub(subject=SimpleNamespace(record_name="Lance Hoffman"))
    assert _run(svc._resolve_change_request_record_name("s", FARMER, FARMER, "rec-1", None)) == "Lance Hoffman"


def test_no_session_or_ids_returns_section_name():
    svc = _Stub(subject=SimpleNamespace(record_name="X"))
    assert _run(svc._resolve_change_request_record_name(None, FARMER, CROP, "rec-1", "Crop 1")) == "Crop 1"
    assert _run(svc._resolve_change_request_record_name("s", FARMER, CROP, None, "Crop 1")) == "Crop 1"
    assert svc.lookups == []


def test_lookup_failure_is_not_fatal():
    svc = _Stub(fail=True)
    assert _run(svc._resolve_change_request_record_name("s", FARMER, CROP, "rec-1", "Crop 1")) == "Crop 1"
