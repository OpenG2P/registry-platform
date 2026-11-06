"""DCI ``expression`` queries.

Shape (farmer-registry ExpTemplate):

    query.value.expression.query = { "$and": [ { "field": { "$eq": "..." } } ] }

A field map without ``$and`` / ``$or`` is an implicit AND. ``{"field": "value"}``
is ``$eq``.
"""

from typing import Any

from openg2p_registry_core.search.query import ClauseNode

from .allowlist import AllowedSearchFields
from .common import MONGO_OPERATORS, combine, field_predicates, invalid


def decode_expression(query: Any, allowed: AllowedSearchFields) -> ClauseNode:
    body = _expression_query(query)
    return _parse_node(body, allowed)


def _expression_query(query: Any) -> dict:
    if not isinstance(query, dict):
        invalid("An expression query must be an object.")
    value = query.get("value", query)
    if isinstance(value, dict) and "expression" in value:
        expression = value.get("expression")
    else:
        expression = value
    if not isinstance(expression, dict):
        invalid("expression is required and must be an object.")
    body = expression.get("query", expression)
    if not isinstance(body, dict) or not body:
        invalid("expression.query is required and must be non-empty.")
    return body


def _parse_node(node: Any, allowed: AllowedSearchFields) -> ClauseNode:
    if not isinstance(node, dict) or not node:
        invalid("Expression node must be a non-empty object.")

    if "$and" in node or "$or" in node:
        if len(node) != 1:
            invalid("An expression node cannot mix $and/$or with other fields.")
        kind = "and" if "$and" in node else "or"
        items = node["$and"] if kind == "and" else node["$or"]
        if not isinstance(items, list) or not items:
            invalid(f"${kind} must be a non-empty list.")
        return combine(kind, [_parse_node(item, allowed) for item in items])

    children = []
    for field_name, operators in node.items():
        if field_name.startswith("$"):
            invalid(f"Unsupported expression operator '{field_name}'.")
        if "." in field_name:
            invalid(f"Field '{field_name}' is not a column on this register.")
        children.extend(field_predicates(field_name, operators, allowed, MONGO_OPERATORS))
    return combine("and", children)
