"""Map OIDC userinfo claims onto register fields using provider_config."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

USERINFO_CHANGE_REQUEST_CONFIG_KEY = "userinfo_change_request"

# Minimal aliases only. Domain-specific values (OTHERS, UNKNOWN, …) belong in
# provider_config via claim rule ``map`` or top-level ``gender_map``.
_DEFAULT_GENDER_CLAIM_MAP = {
    "male": "MALE",
    "m": "MALE",
    "female": "FEMALE",
    "f": "FEMALE",
}


@dataclass(frozen=True)
class UserinfoSectionMapping:
    field_names: frozenset[str]
    section_keys: tuple[str, ...]


@dataclass(frozen=True)
class UserinfoChangeRequestMapping:
    tab_keys: tuple[str, ...]
    claim_rules: dict[str, dict[str, Any]]
    sections: tuple[UserinfoSectionMapping, ...]
    gender_map: dict[str, str]


def parse_userinfo_change_request_mapping(
    provider_config: dict[str, Any] | None,
) -> UserinfoChangeRequestMapping | None:
    """
    Read CR mapping from provider_config.

    Extension/seed owns section keys, tab keys, claim→field rules, and optional
    gender_map. Platform only interprets this shape; missing config means skip
    CR creation.
    """
    if not isinstance(provider_config, dict):
        return None
    raw = provider_config.get(USERINFO_CHANGE_REQUEST_CONFIG_KEY)
    if not isinstance(raw, dict):
        return None

    tab_keys = _as_str_tuple(raw.get("tab_keys"))
    claim_rules = raw.get("claims")
    sections_raw = raw.get("sections")
    if not tab_keys or not isinstance(claim_rules, dict) or not isinstance(sections_raw, list):
        return None

    sections: list[UserinfoSectionMapping] = []
    for item in sections_raw:
        if not isinstance(item, dict):
            continue
        section_keys = _as_str_tuple(item.get("section_keys"))
        field_names = _as_str_frozenset(item.get("fields"))
        if section_keys and field_names:
            sections.append(
                UserinfoSectionMapping(field_names=field_names, section_keys=section_keys)
            )

    if not sections:
        return None

    return UserinfoChangeRequestMapping(
        tab_keys=tab_keys,
        claim_rules=claim_rules,
        sections=tuple(sections),
        gender_map=_parse_gender_map(raw.get("gender_map")),
    )


def normalize_gender(
    value: Any,
    gender_map: dict[str, str] | None = None,
) -> str | None:
    if value is None:
        return None
    if isinstance(value, list):
        value = next((v for v in value if v not in (None, "")), "")
    if not isinstance(value, str):
        value = str(value)
    first_token = value.split(",", 1)[0].strip()
    if not first_token:
        return None
    lookup = {**_DEFAULT_GENDER_CLAIM_MAP, **(gender_map or {})}
    mapped = lookup.get(first_token.lower())
    if mapped:
        return mapped
    return first_token.upper()


def normalize_birth_date(value: Any) -> str | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    text = str(value).strip()
    if not text:
        return None
    for candidate in (text[:10], text):
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y"):
            try:
                return datetime.strptime(candidate, fmt).date().isoformat()
            except ValueError:
                continue
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        return None


def normalize_address(value: Any) -> str | None:
    if value is None or value == "":
        return None
    if isinstance(value, str):
        text = value.strip()
        return text or None
    if isinstance(value, dict):
        formatted = value.get("formatted")
        if isinstance(formatted, str) and formatted.strip():
            return formatted.strip()
        parts = [
            value.get("street_address") or value.get("streetAddress"),
            value.get("locality"),
            value.get("region"),
            value.get("postal_code") or value.get("postalCode"),
            value.get("country"),
        ]
        joined = ", ".join(str(p).strip() for p in parts if p)
        return joined or None
    return str(value).strip() or None


def split_full_name_into_fields(
    full_name: str,
    split_into: list[str],
) -> dict[str, str]:
    """Map whitespace-split name parts onto ordered ``split_into`` field names.

    Extension chooses the field names. Platform only applies positional rules:
    one field gets the whole name; two fields get first + remainder; three or
    more get first, joined middle, last (extra middle field names are unused).
    """
    field_names = [name for name in split_into if isinstance(name, str) and name]
    parts = [p for p in re.split(r"\s+", full_name.strip()) if p]
    if not field_names or not parts:
        return {}
    if len(field_names) == 1:
        return {field_names[0]: " ".join(parts)}
    if len(parts) == 1:
        return {field_names[0]: parts[0]}
    if len(field_names) == 2:
        return {
            field_names[0]: parts[0],
            field_names[1]: " ".join(parts[1:]),
        }
    result = {
        field_names[0]: parts[0],
        field_names[-1]: parts[-1],
    }
    if len(parts) > 2:
        result[field_names[1]] = " ".join(parts[1:-1])
    return result


# Backward-compatible name used by older call sites / docs.
def split_full_name(full_name: str) -> dict[str, str]:
    return split_full_name_into_fields(
        full_name, ["first_name", "middle_name", "last_name"]
    )


def map_userinfo_to_register_fields(
    claims: dict[str, Any],
    mapping: UserinfoChangeRequestMapping,
) -> dict[str, Any]:
    """Apply provider claim rules to userinfo. Never writes id/subject claims as fields."""
    if not isinstance(claims, dict):
        return {}

    fields: dict[str, Any] = {}

    for claim_name, rule in mapping.claim_rules.items():
        if not isinstance(rule, dict):
            continue
        field_name = rule.get("field")
        if not isinstance(field_name, str) or not field_name:
            continue
        if field_name in {"foundational_id", "individual_id", "sub"}:
            continue

        raw_value = claims.get(claim_name)
        if raw_value in (None, ""):
            continue

        normalize = rule.get("normalize")
        if normalize == "gender":
            claim_map = rule.get("map") if isinstance(rule.get("map"), dict) else None
            merged_map = {**mapping.gender_map, **_string_map(claim_map)}
            value = normalize_gender(raw_value, merged_map)
        elif normalize == "birth_date":
            value = normalize_birth_date(raw_value)
        elif normalize == "address":
            value = normalize_address(raw_value)
        elif isinstance(raw_value, str):
            value = raw_value.strip() or None
        else:
            value = raw_value

        if value in (None, ""):
            continue

        fields[field_name] = value

        split_into = rule.get("split_into")
        if isinstance(split_into, list) and isinstance(value, str):
            for part_field, part_value in split_full_name_into_fields(
                value, split_into
            ).items():
                fields.setdefault(part_field, part_value)

    fields.pop("foundational_id", None)
    fields.pop("individual_id", None)
    fields.pop("sub", None)
    return {key: value for key, value in fields.items() if value not in (None, "")}


def split_fields_by_section(
    fields: dict[str, Any],
    mapping: UserinfoChangeRequestMapping,
) -> list[tuple[UserinfoSectionMapping, dict[str, Any]]]:
    grouped: list[tuple[UserinfoSectionMapping, dict[str, Any]]] = []
    for section in mapping.sections:
        section_fields = {
            name: value for name, value in fields.items() if name in section.field_names
        }
        if section_fields:
            grouped.append((section, section_fields))
    return grouped


def _as_str_tuple(value: Any) -> tuple[str, ...]:
    if not isinstance(value, list):
        return ()
    return tuple(item for item in value if isinstance(item, str) and item)


def _as_str_frozenset(value: Any) -> frozenset[str]:
    if not isinstance(value, list):
        return frozenset()
    return frozenset(item for item in value if isinstance(item, str) and item)


def _string_map(value: Any) -> dict[str, str]:
    if not isinstance(value, dict):
        return {}
    return {
        str(key).strip().lower(): str(mapped).strip()
        for key, mapped in value.items()
        if key is not None and mapped is not None and str(mapped).strip()
    }


def _parse_gender_map(value: Any) -> dict[str, str]:
    return _string_map(value)
