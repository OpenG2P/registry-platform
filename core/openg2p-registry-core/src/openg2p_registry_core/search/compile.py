"""Turn a RegisterSearch clause into SQLAlchemy expressions.

Column types come from the register model. Values that cannot be coerced
to that type are rejected before they reach the database.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import Date, DateTime, Float, Integer, Numeric, String, Text, not_
from sqlalchemy.sql.sqltypes import Boolean
from sqlalchemy.sql.sqltypes import JSON as SAJSON

from openg2p_registry_core.errors import G2PRegistryErrorCodes, G2PRegistryException

from .query import ColumnPredicate, CompareOp, RegisterSearch, SearchClause, SortKey, iter_predicates, mentions_column

_IN_OPS = {CompareOp.IN, CompareOp.NIN}
_TEXT_OPS = {CompareOp.CONTAINS, CompareOp.STARTS_WITH, CompareOp.ENDS_WITH}


def reject(message: str) -> None:
    raise G2PRegistryException(
        code=G2PRegistryErrorCodes.INVALID_REQUEST.value[1],
        message=message,
    )


def compile_search(model, search: RegisterSearch, allowed_columns: set[str]):
    """Return ``(where_conditions, order_by_columns)`` for the searched register."""
    _require_allowed_tree(search, allowed_columns)
    conditions = [_predicate_sql(model, search.clause)]
    if not mentions_column(search.clause, "record_status"):
        status = getattr(model, "record_status", None)
        if status is not None:
            conditions.append(status == "ACTIVE")
    return conditions, _order_by(model, search.sort, allowed_columns)


def _require_allowed_tree(search: RegisterSearch, allowed_columns: set[str]) -> None:
    for predicate in iter_predicates(search.clause):
        if predicate.column not in allowed_columns:
            reject(f"Field '{predicate.column}' is not searchable.")
    for key in search.sort:
        if key.column not in allowed_columns:
            reject(f"Field '{key.column}' is not searchable.")


def _predicate_sql(model, node):
    if isinstance(node, ColumnPredicate):
        return _column_sql(model, node)
    if not isinstance(node, SearchClause) or not node.children:
        reject("Search clause is empty.")
    parts = [_predicate_sql(model, child) for child in node.children]
    if node.kind == "and":
        return parts[0] if len(parts) == 1 else _and(parts)
    if node.kind == "or":
        return parts[0] if len(parts) == 1 else _or(parts)
    if node.kind == "not":
        if len(parts) != 1:
            reject("A 'not' condition takes exactly one expression.")
        return not_(parts[0])
    reject(f"Unsupported condition '{node.kind}'.")


def _and(parts):
    expr = parts[0]
    for part in parts[1:]:
        expr = expr & part
    return expr


def _or(parts):
    expr = parts[0]
    for part in parts[1:]:
        expr = expr | part
    return expr


def _column_sql(model, predicate: ColumnPredicate):
    column = getattr(model, predicate.column, None)
    if column is None or not hasattr(column, "type"):
        reject(f"Field '{predicate.column}' does not exist on this register.")

    if predicate.column == "search_text":
        return _search_text_sql(column, predicate)

    value = _coerce(column, predicate.op, predicate.value, predicate.column)
    match predicate.op:
        case CompareOp.EQ:
            return column == value
        case CompareOp.NEQ:
            return column != value
        case CompareOp.GT:
            return column > value
        case CompareOp.GTE:
            return column >= value
        case CompareOp.LT:
            return column < value
        case CompareOp.LTE:
            return column <= value
        case CompareOp.IN:
            return column.in_(value)
        case CompareOp.NIN:
            return ~column.in_(value)
        case CompareOp.CONTAINS:
            return column.ilike(_like_pattern(value, "contains"), escape="\\")
        case CompareOp.STARTS_WITH:
            return column.ilike(_like_pattern(value, "starts"), escape="\\")
        case CompareOp.ENDS_WITH:
            return column.ilike(_like_pattern(value, "ends"), escape="\\")
        case _:
            reject(f"Unsupported operator '{predicate.op.value}' on field '{predicate.column}'.")


def _search_text_sql(column, predicate: ColumnPredicate):
    """``search_text`` is a trigram bag. Equality is a substring match."""
    if predicate.op in _IN_OPS:
        reject("Operators 'in' and 'nin' are not supported on search_text.")
    if not isinstance(predicate.value, str) or not predicate.value.strip():
        reject("search_text must be a non-empty string.")
    text = predicate.value.strip()
    if predicate.op in {CompareOp.EQ, CompareOp.CONTAINS}:
        mode = "contains"
    elif predicate.op == CompareOp.STARTS_WITH:
        mode = "starts"
    elif predicate.op == CompareOp.ENDS_WITH:
        mode = "ends"
    else:
        reject(f"Operator '{predicate.op.value}' is not supported on search_text.")
    return column.ilike(_like_pattern(text, mode), escape="\\")


def _like_pattern(value: str, mode: str) -> str:
    escaped = value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    if mode == "starts":
        return f"{escaped}%"
    if mode == "ends":
        return f"%{escaped}"
    return f"%{escaped}%"


def _coerce(column, op: CompareOp, value: Any, field_name: str):
    if op in _IN_OPS:
        if not isinstance(value, list) or not value:
            reject(f"Operator '{op.value}' requires a non-empty list for field '{field_name}'.")
        return [_coerce_scalar(column, item, field_name) for item in value]
    if op in _TEXT_OPS and not isinstance(value, str):
        reject(f"Operator '{op.value}' requires a string for field '{field_name}'.")
    return _coerce_scalar(column, value, field_name)


def _coerce_scalar(column, value: Any, field_name: str):
    col_type = column.type
    if isinstance(value, (dict, list)):
        if isinstance(col_type, SAJSON) and not isinstance(value, list):
            return value
        reject(f"Value for field '{field_name}' has the wrong type.")

    if isinstance(col_type, DateTime):
        return _as_datetime(value, field_name)
    if isinstance(col_type, Date):
        return _as_date(value, field_name)
    if isinstance(col_type, Boolean):
        return _as_bool(value, field_name)
    if isinstance(col_type, Integer):
        return _as_int(value, field_name)
    if isinstance(col_type, (Float, Numeric)):
        return _as_number(value, field_name)
    if isinstance(col_type, (String, Text)):
        if not isinstance(value, str):
            reject(f"Value for field '{field_name}' must be a string.")
        return value
    if isinstance(value, (dict, list)):
        reject(f"Value for field '{field_name}' has the wrong type.")
    return value


def _as_date(value: Any, field_name: str) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str) and value.strip():
        try:
            return datetime.fromisoformat(value.strip().replace("Z", "+00:00")).date()
        except ValueError:
            pass
    reject(f"Invalid date for field '{field_name}'. Use ISO format (YYYY-MM-DD).")


def _as_datetime(value: Any, field_name: str) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day)
    if isinstance(value, str) and value.strip():
        try:
            return datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
        except ValueError:
            pass
    reject(f"Invalid timestamp for field '{field_name}'. Use ISO format.")


def _as_int(value: Any, field_name: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        if isinstance(value, str) and value.strip().lstrip("-").isdigit():
            return int(value.strip())
        reject(f"Value for field '{field_name}' must be an integer.")
    return value


def _as_number(value: Any, field_name: str) -> float:
    if isinstance(value, bool):
        reject(f"Value for field '{field_name}' must be a number.")
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip())
        except ValueError:
            pass
    reject(f"Value for field '{field_name}' must be a number.")


def _as_bool(value: Any, field_name: str) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str) and value.strip().lower() in {"true", "false"}:
        return value.strip().lower() == "true"
    reject(f"Value for field '{field_name}' must be a boolean.")


def _order_by(model, sort: list[SortKey], allowed_columns: set[str]):
    columns = []
    for key in sort:
        if key.column not in allowed_columns:
            reject(f"Field '{key.column}' is not searchable.")
        column = getattr(model, key.column, None)
        if column is None or not hasattr(column, "type"):
            reject(f"Field '{key.column}' does not exist on this register.")
        columns.append(column.desc() if key.direction == "desc" else column.asc())
    tiebreak = getattr(model, "internal_record_id", None)
    if tiebreak is not None and all(key.column != "internal_record_id" for key in sort):
        columns.append(tiebreak.asc())
    if not columns:
        approved = getattr(model, "last_approved_at", None)
        if approved is not None:
            columns.append(approved.desc())
            if tiebreak is not None:
                columns.append(tiebreak.asc())
    return columns
