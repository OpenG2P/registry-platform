"""Small list/payload helpers for staff Tier-2 suites."""

from __future__ import annotations

from typing import Any


def as_list(payload: Any) -> list[Any]:
    if payload is None:
        return []
    if isinstance(payload, list):
        return payload
    return [payload]


def first_id(rows: list[Any], *keys: str) -> str | None:
    for row in rows:
        if not isinstance(row, dict):
            continue
        for key in keys:
            value = row.get(key)
            if value:
                return str(value)
    return None
