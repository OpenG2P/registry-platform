"""Household register intake section payloads."""

from __future__ import annotations

import copy
from typing import Any

from helpers.config import (
    HH_ASSETS_SECTION_ID,
    HH_COMPOSITION_HEADSHIP_SECTION_ID,
    HH_DWELLING_SECTION_ID,
    HH_HOUSING_TABLE_SECTION_ID,
    HH_LOCATION_SECTION_ID,
    REGISTER_HOUSEHOLD,
    REGISTER_HOUSEHOLD_ASSET,
    REGISTER_HOUSEHOLD_HOUSING,
)

HOUSEHOLD_SECTION_DEFS: dict[str, dict[str, Any]] = {
    HH_COMPOSITION_HEADSHIP_SECTION_ID: {
        "section_register_id": REGISTER_HOUSEHOLD,
        "is_list": False,
        "payload": {
            "household_head_name": "Placeholder",
            "headship_type": "MALE_HEADED",
            "size_total": 4,
            "size_adults": 2,
            "size_children_u5": 1,
        },
    },
    HH_LOCATION_SECTION_ID: {
        "section_register_id": REGISTER_HOUSEHOLD,
        "is_list": False,
        "payload": {
            "address_line_1": "Kebele 05, House 12",
            "postal_code": "1000",
            "country_code": "ET",
        },
    },
    HH_DWELLING_SECTION_ID: {
        "section_register_id": REGISTER_HOUSEHOLD,
        "is_list": False,
        "payload": {
            "dwelling_type": "PERMANENT",
            "tenure_status": "OWNED",
            "roof_material": "CORRUGATED_IRON",
            "wall_material": "BRICK",
            "floor_material": "CEMENT",
        },
    },
    # Child TABLE register → g2p_register_household_assets (is_list section)
    HH_ASSETS_SECTION_ID: {
        "section_register_id": REGISTER_HOUSEHOLD_ASSET,
        "is_list": True,
        "supporting_key": "household_assets",
        "payload": [
            {
                "asset_type": "LAND",
                "asset_category": "plot",
                "quantity": 1,
                "size_band": "SMALL",
                "edit_action": "ADD",
            },
            {
                "asset_type": "LIVESTOCK",
                "asset_category": "cattle",
                "quantity": 3,
                "edit_action": "ADD",
            },
        ],
    },
    # Child TABLE register → g2p_register_household_housing_and_services
    HH_HOUSING_TABLE_SECTION_ID: {
        "section_register_id": REGISTER_HOUSEHOLD_HOUSING,
        "is_list": True,
        "supporting_key": "household_housing",
        "payload": [
            {
                "dwelling_type": "SEMI_PERMANENT",
                "roof_material": "THATCH",
                "wall_material": "MUD",
                "floor_material": "EARTH",
                "tenure_status": "OWNED",
                "water_source_type": "WELL",
                "water_distance_minutes": 15,
                "sanitation_type": "PIT_LATRINE",
                "lighting_source": "SOLAR",
                "cooking_fuel_type": "FIREWOOD",
                "edit_action": "ADD",
            }
        ],
    },
}


def build_household_section_payload(section_id: str, head_name: str) -> dict | list:
    defn = HOUSEHOLD_SECTION_DEFS.get(section_id)
    if not defn:
        return {}
    payload = copy.deepcopy(defn["payload"])
    if section_id == HH_COMPOSITION_HEADSHIP_SECTION_ID and isinstance(payload, dict):
        payload["household_head_name"] = head_name
    if section_id == HH_LOCATION_SECTION_ID and isinstance(payload, dict):
        # Unique address avoids fuzzy-match collision with seed household h001.
        payload["address_line_1"] = f"{head_name} Lane"
    return payload


def household_expected_main_fields(head_name: str) -> dict[str, Any]:
    return {
        "household_head_name": head_name,
        "headship_type": "MALE_HEADED",
        "size_total": 4,
        "size_adults": 2,
        "size_children_u5": 1,
        "address_line_1": f"{head_name} Lane",
        "postal_code": "1000",
        "country_code": "ET",
        "dwelling_type": "PERMANENT",
        "tenure_status": "OWNED",
        "roof_material": "CORRUGATED_IRON",
        "wall_material": "BRICK",
        "floor_material": "CEMENT",
    }


def household_expected_supporting() -> dict[str, list[dict[str, Any]]]:
    # Only sections present on the seeded household intake form.
    # (Housing TABLE section exists in register meta, but is not on the intake form.)
    assets = copy.deepcopy(HOUSEHOLD_SECTION_DEFS[HH_ASSETS_SECTION_ID]["payload"])
    for row in assets:
        row.pop("edit_action", None)
    return {"household_assets": assets}
