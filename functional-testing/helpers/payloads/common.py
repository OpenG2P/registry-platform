"""Shared payload helpers across registers."""

from __future__ import annotations

from typing import Any

from helpers.payloads.household import HOUSEHOLD_SECTION_DEFS
from helpers.payloads.individual import INDIVIDUAL_SECTION_DEFS
from helpers.profiles import RegisterProfile
from helpers.util import response_payload


def section_defs_for(profile: RegisterProfile) -> dict[str, dict[str, Any]]:
    if profile.key == "household":
        return HOUSEHOLD_SECTION_DEFS
    return INDIVIDUAL_SECTION_DEFS


def merge_accumulated(section_register_id: str, own: dict, accumulated: dict) -> dict:
    merged = {**accumulated.get(section_register_id, {}), **own}
    accumulated[section_register_id] = merged
    return merged


def extract_tab_sections(render_body: dict, tab_id: str) -> list[dict]:
    payload = response_payload(render_body)
    tabs = payload.get("tabs") or [] if isinstance(payload, dict) else []
    tab = next((t for t in tabs if t.get("tab_id") == tab_id), None)
    if not tab:
        return []
    return sorted(tab.get("sections") or [], key=lambda s: s.get("section_order", 0))
