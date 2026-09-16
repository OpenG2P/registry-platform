"""Individual register intake section payloads."""

from __future__ import annotations

import copy
from datetime import date
from typing import Any

from helpers.config import (
    DEMOGRAPHIC_SECTION_ID,
    HOUSEHOLD_LOOKUP_SECTION_ID,
    INDIVIDUAL_LAND_SECTION_ID,
    INDIVIDUAL_LIVELIHOOD_SECTION_ID,
    INDIVIDUAL_LIVELIHOOD_TABLE_SECTION_ID,
    REGISTER_INDIVIDUAL,
    REGISTER_INDIVIDUAL_LAND,
    REGISTER_INDIVIDUAL_LIVELIHOOD,
)

BIRTH_DATE = "1990-01-01"


def _age() -> int:
    born = date.fromisoformat(BIRTH_DATE)
    today = date.today()
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))


INDIVIDUAL_SECTION_DEFS: dict[str, dict[str, Any]] = {
    HOUSEHOLD_LOOKUP_SECTION_ID: {
        "section_register_id": REGISTER_INDIVIDUAL,
        "is_list": False,
        "payload": {"link_internal_record_id": ""},
    },
    DEMOGRAPHIC_SECTION_ID: {
        "section_register_id": REGISTER_INDIVIDUAL,
        "is_list": False,
        "payload": {
            "first_name": "Placeholder",
            "middle_name": "",
            "last_name": "Placeholder",
            "birth_date": BIRTH_DATE,
            "estimated_age": _age(),
            "gender": "FEMALE",
            "marital_status": "MARRIED",
        },
    },
    "in_contact_details": {
        "section_register_id": REGISTER_INDIVIDUAL,
        "is_list": False,
        # Nested shape matches widget path phone_numbers.0.number
        "payload": {
            "phone_numbers": [{"number": "+251911000000"}],
            "email": "",
        },
    },
    "in_location_details": {
        "section_register_id": REGISTER_INDIVIDUAL,
        "is_list": False,
        "payload": {
            "address_line_1": "Kebele 05, House 12",
            "postal_code": "1000",
            "country_code": "ET",
        },
    },
    "in_relationship_to_head": {
        "section_register_id": REGISTER_INDIVIDUAL,
        "is_list": False,
        "payload": {
            "relationship_to_head": "HEAD",
        },
    },
    INDIVIDUAL_LIVELIHOOD_SECTION_ID: {
        "section_register_id": REGISTER_INDIVIDUAL,
        "is_list": False,
        "payload": {
            "primary_livelihood": "AGRICULTURE",
            "secondary_livelihood": "LIVESTOCK",
            "employment_status": "SELF_EMPLOYED",
            "coping_strategies_index": 2,
        },
    },
    # Child TABLE register → g2p_register_individual_land
    INDIVIDUAL_LAND_SECTION_ID: {
        "section_register_id": REGISTER_INDIVIDUAL_LAND,
        "is_list": False,
        "supporting_key": "individual_land",
        "payload": {
            "land_access": True,
            "land_size": 1.5,
            "productive_assets": ["PLOUGH"],
            "edit_action": "ADD",
        },
    },
    # Child TABLE register → g2p_register_individual_livelihoods
    INDIVIDUAL_LIVELIHOOD_TABLE_SECTION_ID: {
        "section_register_id": REGISTER_INDIVIDUAL_LIVELIHOOD,
        "is_list": False,
        "supporting_key": "individual_livelihood",
        "payload": {
            "primary_livelihood": "FISHING",
            "secondary_livelihood": "WAGE_LABOR",
            "employment_status": "SELF_EMPLOYED",
            "coping_strategies_index": 3,
            "mobile_phone_type": "SMARTPHONE",
            "edit_action": "ADD",
        },
    },
}


def build_individual_section_payload(
    section_id: str, household_id: str, name: tuple[str, str, str]
) -> dict | list:
    defn = INDIVIDUAL_SECTION_DEFS.get(section_id)
    if not defn:
        return {}
    payload = copy.deepcopy(defn["payload"])
    if section_id == HOUSEHOLD_LOOKUP_SECTION_ID:
        payload["link_internal_record_id"] = household_id
    if section_id == DEMOGRAPHIC_SECTION_ID:
        payload["first_name"], payload["middle_name"], payload["last_name"] = name
    return payload


def individual_expected_main_fields(name: tuple[str, str, str]) -> dict[str, Any]:
    """Flat subject fields we require on API ↔ DB after approve."""
    first, middle, last = name
    return {
        "first_name": first,
        "middle_name": middle,
        "last_name": last,
        "birth_date": BIRTH_DATE,
        "gender": "FEMALE",
        "marital_status": "MARRIED",
        "address_line_1": "Kebele 05, House 12",
        "postal_code": "1000",
        "country_code": "ET",
        "relationship_to_head": "HEAD",
        "primary_livelihood": "AGRICULTURE",
        "secondary_livelihood": "LIVESTOCK",
        "employment_status": "SELF_EMPLOYED",
        "coping_strategies_index": 2,
    }


def individual_expected_supporting() -> dict[str, list[dict[str, Any]]]:
    # Only sections present on the seeded individual intake form.
    # (Livelihood TABLE register exists, but no intake section wires it yet.)
    land = copy.deepcopy(INDIVIDUAL_SECTION_DEFS[INDIVIDUAL_LAND_SECTION_ID]["payload"])
    land.pop("edit_action", None)
    return {"individual_land": [land]}
