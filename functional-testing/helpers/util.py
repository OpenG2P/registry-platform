"""Small shared helpers used by flows and UI scripts."""

from __future__ import annotations

import uuid
from typing import Any, Callable

StepFn = Callable[[str], None]


def noop(_msg: str) -> None:
    return None


def unique_individual_name(marker: str) -> tuple[str, str, str]:
    suffix = uuid.uuid4().hex[:8]
    return f"{marker}{suffix}", "Func", "Tester"


def unique_household_head_name(marker: str) -> str:
    return f"{marker}Head{uuid.uuid4().hex[:8]}"


def unique_cr_value(prefix: str = "FuncMid") -> str:
    return f"{prefix}{uuid.uuid4().hex[:8]}"


def response_payload(body: dict) -> Any:
    return (body.get("response_body") or {}).get("response_payload") or {}


def assert_ok(body: dict, label: str) -> Any:
    header = body.get("response_header") or {}
    if header.get("response_status") == "ERROR":
        raise AssertionError(
            f"{label} -> ERROR {header.get('response_error_code')}: "
            f"{header.get('response_error_message')}"
        )
    return response_payload(body)


def extract_section_record_ids(save_payload: dict, section_register_id: str) -> list[str]:
    """internal_record_id values returned for a section_register on save/get."""
    for section in save_payload.get("section_payloads") or []:
        if section.get("section_register_id") != section_register_id:
            continue
        return [
            record["internal_record_id"]
            for record in (section.get("records") or [])
            if record.get("internal_record_id")
        ]
    return []


def extract_section_record_id(save_payload: dict, section_register_id: str) -> str | None:
    ids = extract_section_record_ids(save_payload, section_register_id)
    return ids[0] if ids else None
