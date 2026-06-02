"""
Record-level data policy helpers (Registry).

Policies are stored as GROUP/CONDITION filter trees. Register search filter_by
merge shape is reserved for a future format.
"""

import json

DATA_POLICY_FILTER_BY_KEY = "__data_policy_expression__"

__all__ = [
    "DATA_POLICY_FILTER_BY_KEY",
    "merge_policy_filter_bys",
    "merge_policy_filter_expressions",
    "merge_data_policy_into_filter_by",
    "split_data_policy_from_filter_by",
]


def _coerce_filter_by_dict(filter_by: dict | str | None) -> dict | None:
    if filter_by is None:
        return None
    if isinstance(filter_by, dict):
        return dict(filter_by)
    if isinstance(filter_by, str):
        try:
            parsed = json.loads(filter_by)
        except json.JSONDecodeError:
            return None
        return parsed if isinstance(parsed, dict) else None
    return None


def merge_policy_filter_bys(filter_bys: list[dict]) -> dict | None:
    """Future format: merge register search filter_by dicts (OR across policies)."""
    cleaned = [dict(fb) for fb in filter_bys if fb]
    if not cleaned:
        return None
    return {"filter_bys": cleaned}


def merge_policy_filter_expressions(
    allow_expressions: list[dict],
    disallow_expressions: list[dict] | None = None,
) -> dict | None:
    """Merge ALLOW policy trees with OR; DISALLOW ignored until implemented."""
    _ = disallow_expressions
    cleaned = [dict(expr) for expr in allow_expressions if expr]
    if not cleaned:
        return None
    if len(cleaned) == 1:
        return cleaned[0]
    return {
        "type": "GROUP",
        "operator": "OR",
        "children": cleaned,
    }


def merge_data_policy_into_filter_by(
    filter_by: dict | str | None,
    policy_merged: dict | None,
) -> dict | None:
    if not policy_merged:
        return filter_by if isinstance(filter_by, (dict, str)) else None
    merged = _coerce_filter_by_dict(filter_by) or {}
    merged[DATA_POLICY_FILTER_BY_KEY] = policy_merged
    return merged


def split_data_policy_from_filter_by(
    filter_by: dict | str | None,
) -> tuple[dict | None, dict | None]:
    filters = _coerce_filter_by_dict(filter_by)
    if not filters:
        return (filters, None)
    policy_merged = filters.pop(DATA_POLICY_FILTER_BY_KEY, None)
    user_filters = filters or None
    return user_filters, policy_merged if isinstance(policy_merged, dict) else None
