"""Unit tests for config-driven userinfo → register field mapper."""

from __future__ import annotations

import importlib.util
from datetime import date, datetime
from pathlib import Path

_MAPPER_PATH = (
    Path(__file__).resolve().parents[1]
    / "src"
    / "openg2p_registry_core"
    / "services"
    / "registrant_auth_userinfo_mapper.py"
)


def _load_mapper():
    import sys

    mod_name = "registrant_auth_userinfo_mapper"
    spec = importlib.util.spec_from_file_location(mod_name, _MAPPER_PATH)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules[mod_name] = mod
    spec.loader.exec_module(mod)
    return mod


mapper = _load_mapper()

SAMPLE_PROVIDER_CONFIG = {
    "userinfo_change_request": {
        "tab_keys": ["person_info_tab", "person_info"],
        "claims": {
            "given_name": {"field": "first_name"},
            "family_name": {"field": "last_name"},
            "name": {
                "field": "full_name",
                "split_into": ["first_name", "middle_name", "last_name"],
            },
            "gender": {"field": "gender", "normalize": "gender"},
            "birthdate": {"field": "birth_date", "normalize": "birth_date"},
            "phone_number": {"field": "primary_phone"},
            "address": {"field": "address_descriptor", "normalize": "address"},
        },
        "sections": [
            {
                "section_keys": ["demo_section", "demo_details"],
                "fields": [
                    "full_name",
                    "first_name",
                    "middle_name",
                    "last_name",
                    "gender",
                    "birth_date",
                ],
            },
            {
                "section_keys": ["contact_section", "contact_details"],
                "fields": ["primary_phone", "address_descriptor"],
            },
        ],
    }
}


def test_parse_mapping_missing_config_returns_none():
    assert mapper.parse_userinfo_change_request_mapping(None) is None
    assert mapper.parse_userinfo_change_request_mapping({}) is None
    assert mapper.parse_userinfo_change_request_mapping({"scope": "openid"}) is None


def test_map_full_name_split_three_parts():
    mapping = mapper.parse_userinfo_change_request_mapping(SAMPLE_PROVIDER_CONFIG)
    fields = mapper.map_userinfo_to_register_fields(
        {"name": "Abebe Bekele Tessema", "gender": "Male", "birthdate": "1990-05-15"},
        mapping,
    )
    assert fields["full_name"] == "Abebe Bekele Tessema"
    assert fields["first_name"] == "Abebe"
    assert fields["middle_name"] == "Bekele"
    assert fields["last_name"] == "Tessema"
    assert fields["gender"] == "MALE"
    assert fields["birth_date"] == "1990-05-15"


def test_given_family_override_name_parts():
    mapping = mapper.parse_userinfo_change_request_mapping(SAMPLE_PROVIDER_CONFIG)
    fields = mapper.map_userinfo_to_register_fields(
        {
            "name": "Abebe Bekele Tessema",
            "given_name": "Sara",
            "family_name": "Haile",
        },
        mapping,
    )
    assert fields["full_name"] == "Abebe Bekele Tessema"
    assert fields["first_name"] == "Sara"
    assert fields["last_name"] == "Haile"
    assert fields["middle_name"] == "Bekele"


def test_phone_and_address():
    mapping = mapper.parse_userinfo_change_request_mapping(SAMPLE_PROVIDER_CONFIG)
    fields = mapper.map_userinfo_to_register_fields(
        {
            "phone_number": "+251911223344",
            "address": {"formatted": "  Line 1, City  "},
        },
        mapping,
    )
    assert fields == {
        "primary_phone": "+251911223344",
        "address_descriptor": "Line 1, City",
    }


def test_never_maps_id_claims_even_if_configured():
    bad_config = {
        "userinfo_change_request": {
            "tab_keys": ["t"],
            "claims": {
                "individual_id": {"field": "foundational_id"},
                "name": {"field": "full_name"},
            },
            "sections": [{"section_keys": ["s"], "fields": ["full_name"]}],
        }
    }
    mapping = mapper.parse_userinfo_change_request_mapping(bad_config)
    fields = mapper.map_userinfo_to_register_fields(
        {"individual_id": "FAN-1", "name": "Only Name", "sub": "x"},
        mapping,
    )
    assert fields == {"full_name": "Only Name"}


def test_split_fields_by_section_uses_config_keys():
    mapping = mapper.parse_userinfo_change_request_mapping(SAMPLE_PROVIDER_CONFIG)
    fields = {
        "full_name": "A B",
        "first_name": "A",
        "last_name": "B",
        "gender": "MALE",
        "primary_phone": "+251911000000",
        "address_descriptor": "Somewhere",
    }
    split = mapper.split_fields_by_section(fields, mapping)
    assert len(split) == 2
    assert split[0][0].section_keys == ("demo_section", "demo_details")
    assert split[0][1]["full_name"] == "A B"
    assert split[1][0].section_keys == ("contact_section", "contact_details")
    assert split[1][1]["primary_phone"] == "+251911000000"


def test_normalize_helpers():
    assert mapper.normalize_gender("f") == "FEMALE"
    assert mapper.normalize_birth_date("15/03/1988") == "1988-03-15"
    assert mapper.normalize_birth_date(date(2001, 2, 3)) == "2001-02-03"
    assert mapper.normalize_birth_date(datetime(2001, 2, 3, 12, 0)) == "2001-02-03"
