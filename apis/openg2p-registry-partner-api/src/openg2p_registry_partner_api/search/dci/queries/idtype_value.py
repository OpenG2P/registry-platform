"""DCI ``idtype-value`` queries.

Canonical shape: ``{"type": "UIN", "value": "12314567890"}``.
Legacy shape still accepted: ``{"type": "idtype-value", "value": {"id_type", "id_value"}}``.
"""

from typing import Any

from openg2p_registry_core.search.query import ColumnPredicate

from .allowlist import AllowedSearchFields
from .common import invalid, resolve_identifier


def decode_idtype_value(query: Any, allowed: AllowedSearchFields, id_type_columns: dict[str, str]) -> ColumnPredicate:
    id_type, id_value = _parts(query)
    return resolve_identifier(id_type, id_value, allowed, id_type_columns)


def _parts(query: Any) -> tuple[Any, Any]:
    if not isinstance(query, dict):
        invalid("An idtype-value query must be an object.")
    value = query.get("value")
    if isinstance(value, dict) and ("id_type" in value or "id_value" in value):
        return value.get("id_type"), value.get("id_value")
    return query.get("type"), value
