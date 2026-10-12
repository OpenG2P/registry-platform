"""DCI ``predicate`` queries.

Each item is ``{seq_num, expression1, condition?, expression2?}``.
``expression1`` is ``{attribute_name, operator, attribute_value}``.
Items are ordered by ``seq_num`` and combined with AND.
"""

from typing import Any

from openg2p_registry_core.search.query import ClauseNode, ColumnPredicate

from .allowlist import AllowedSearchFields
from .common import PREDICATE_OPERATORS, combine, invalid


def decode_predicate(query: Any, allowed: AllowedSearchFields) -> ClauseNode:
    items = _items(query)
    ordered = sorted(items, key=lambda item: item.get("seq_num") or 0)
    return combine("and", [_one_item(item, allowed) for item in ordered])


def _items(query: Any) -> list:
    if isinstance(query, list):
        items = query
    elif isinstance(query, dict) and isinstance(query.get("value"), list):
        items = query["value"]
    else:
        invalid("A predicate query must be a list of conditions.")
    if not items:
        invalid("A predicate query must contain at least one condition.")
    return items


def _one_item(item: Any, allowed: AllowedSearchFields) -> ClauseNode:
    if not isinstance(item, dict) or "expression1" not in item:
        invalid("Each predicate needs expression1.")
    left = _expression(item["expression1"], allowed)
    condition = item.get("condition")
    if condition in (None, ""):
        return left
    if condition == "not":
        if item.get("expression2") is not None:
            invalid("A 'not' predicate does not take expression2.")
        return combine("not", [left])
    if condition in {"and", "or"}:
        if "expression2" not in item or item["expression2"] is None:
            invalid(f"A '{condition}' predicate needs expression2.")
        right = _expression(item["expression2"], allowed)
        return combine(condition, [left, right])
    invalid(f"Unsupported predicate condition '{condition}'.")


def _expression(expression: Any, allowed: AllowedSearchFields) -> ColumnPredicate:
    if not isinstance(expression, dict):
        invalid("A predicate expression must be an object.")
    name = expression.get("attribute_name")
    operator = expression.get("operator")
    if "attribute_value" not in expression:
        invalid("attribute_value is required.")
    if not isinstance(name, str) or not name.strip():
        invalid("attribute_name is required.")
    if "." in name:
        invalid(f"Field '{name}' is not a column on this register.")
    mapped = PREDICATE_OPERATORS.get(operator)
    if mapped is None:
        invalid(
            f"Unsupported operator '{operator}'. "
            f"Supported operators: {sorted(PREDICATE_OPERATORS)}."
        )
    allowed.require(name)
    return ColumnPredicate(name, mapped, expression["attribute_value"])
