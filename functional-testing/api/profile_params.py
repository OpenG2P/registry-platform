"""Shared pytest markers / parametrization for API scenarios."""

from __future__ import annotations

import pytest

from helpers.profiles import ALL_PROFILES, profile_id

# Apply to any Tier-0 workflow that should run for both Individual and Household.
with_register_profiles = pytest.mark.parametrize(
    "profile",
    list(ALL_PROFILES),
    ids=[profile_id(p) for p in ALL_PROFILES],
)
