"""Load the committed functional seed_manifest.json for Tier-1+ scenarios."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

_MANIFEST_PATH = (
    Path(__file__).resolve().parents[1] / "fixtures" / "seed" / "seed_manifest.json"
)


@lru_cache(maxsize=1)
def seed_manifest() -> dict[str, Any]:
    return json.loads(_MANIFEST_PATH.read_text(encoding="utf-8"))


def subject(profile_key: str) -> dict[str, Any]:
    """Return subject block for ``individual`` or ``household``."""
    subjects = seed_manifest()["subjects"]
    if profile_key not in subjects:
        raise KeyError(f"unknown seed subject {profile_key!r}; have {sorted(subjects)}")
    return subjects[profile_key]


def supporting_rows(supporting_key: str) -> list[dict[str, Any]]:
    rows = seed_manifest()["supporting"].get(supporting_key)
    if rows is None:
        raise KeyError(f"unknown supporting key {supporting_key!r}")
    return list(rows)


def search_terms(profile_key: str) -> list[str]:
    return list(subject(profile_key)["search_terms"])
