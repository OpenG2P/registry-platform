"""Shared pieces for the four DCI query decoders."""

from typing import Any

from openg2p_registry_core.errors import G2PRegistryException
from openg2p_registry_core.search.query import ColumnPredicate, CompareOp, SearchClause

from ..schemas import DciSearchStatusReasonCode
from .allowlist import AllowedSearchFields

MONGO_OPERATORS = {
    "$eq": CompareOp.EQ,
    "$ne": CompareOp.NEQ,
    "$neq": CompareOp.NEQ,
    "$gt": CompareOp.GT,
    "$gte": CompareOp.GTE,
    "$lt": CompareOp.LT,
    "$lte": CompareOp.LTE,
    "$in": CompareOp.IN,
    "$nin": CompareOp.NIN,
    "$contains": CompareOp.CONTAINS,
    "$startsWith": CompareOp.STARTS_WITH,
    "$endsWith": CompareOp.ENDS_WITH,
}

PREDICATE_OPERATORS = {
    "eq": CompareOp.EQ,
    "gt": CompareOp.GT,
    "lt": CompareOp.LT,
    "ge": CompareOp.GTE,
    "le": CompareOp.LTE,
    "in": CompareOp.IN,
}

GRAPHQL_OPERATORS = {
    "eq": CompareOp.EQ,
    "ne": CompareOp.NEQ,
    "neq": CompareOp.NEQ,
    "gt": CompareOp.GT,
    "gte": CompareOp.GTE,
    "ge": CompareOp.GTE,
    "lt": CompareOp.LT,
    "lte": CompareOp.LTE,
    "le": CompareOp.LTE,
    "in": CompareOp.IN,
    "nin": CompareOp.NIN,
    "contains": CompareOp.CONTAINS,
    "startsWith": CompareOp.STARTS_WITH,
    "endsWith": CompareOp.ENDS_WITH,
}


def invalid(message: str) -> None:
    raise G2PRegistryException(
        code=DciSearchStatusReasonCode.SEARCH_CRITERIA_INVALID.value,
        message=message,
    )


def combine(kind: str, children: list) -> ColumnPredicate | SearchClause:
    if not children:
        invalid("Search clause is empty.")
    if len(children) == 1 and kind == "and":
        return children[0]
    return SearchClause(kind, children)  # type: ignore[arg-type]


def field_predicates(field: str, operators: Any, allowed: AllowedSearchFields, operator_map: dict) -> list[ColumnPredicate]:
    allowed.require(field)
    if not isinstance(operators, dict):
        return [ColumnPredicate(field, CompareOp.EQ, operators)]
    if not operators:
        invalid(f"Field '{field}' needs an operator.")
    predicates = []
    for operator, value in operators.items():
        mapped = operator_map.get(operator)
        if mapped is None:
            invalid(
                f"Unsupported operator '{operator}'. "
                f"Supported operators: {sorted(operator_map)}."
            )
        predicates.append(ColumnPredicate(field, mapped, value))
    return predicates


def resolve_identifier(id_type: Any, id_value: Any, allowed: AllowedSearchFields, id_type_columns: dict[str, str]) -> ColumnPredicate:
    if not isinstance(id_type, str) or not id_type.strip():
        invalid("Identifier type is required.")
    column = _column_for_id_type(id_type, id_type_columns)
    if column is None:
        invalid(
            f"Identifier type '{id_type}' is not searchable. "
            f"Known types: {sorted({key.upper() for key in id_type_columns})}."
        )
    allowed.require(column)
    if isinstance(id_value, (dict, list)) or id_value is None:
        invalid("Identifier value is required.")
    if isinstance(id_value, str):
        if not id_value.strip():
            invalid("Identifier value is required.")
        id_value = id_value.strip()
    return ColumnPredicate(column, CompareOp.EQ, id_value)


def _column_for_id_type(id_type: str, id_type_columns: dict[str, str]) -> str | None:
    wanted = id_type.strip().upper()
    for key, column in id_type_columns.items():
        if key.upper() == wanted:
            return column
    return None
