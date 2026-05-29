from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List

from openg2p_registry_core.errors import G2PRegistryException

from ..schemas import DciSearchCriteria, DciSearchStatusReasonCode
from ....config import Settings

MONGO_TO_SA_OPERATORS = {
    "$eq": "eq",
    "$ne": "neq",
    "$neq": "neq",
    "$gt": "gt",
    "$gte": "gte",
    "$lt": "lt",
    "$lte": "lte",
    "$in": "in_",
    "$nin": "nin",
    "$contains": "contains",
    "$startsWith": "startsWith",
    "$endsWith": "endsWith",
}


@dataclass
class DciQueryResult:
    search_text: str = ""
    filter_conditions: list = field(default_factory=list)


class DciQueryHelper:
    SUPPORTED_QUERY_TYPES = {"expression", "idtype-value"}

    @classmethod
    def parse_query(cls, search_criteria: DciSearchCriteria, model_class=None) -> DciQueryResult:
        query_type = search_criteria.query_type
        if query_type not in cls.SUPPORTED_QUERY_TYPES:
            cls._raise_invalid_request(
                f"Unsupported query_type '{query_type}'. Supported query types are: expression, idtype-value."
            )

        query_value = search_criteria.query.value
        if query_type == "expression":
            return cls._parse_expression_query(query_value, model_class)
        return DciQueryResult(search_text=cls._get_idtype_value_search_text(query_value))

    @classmethod
    def _parse_expression_query(cls, query_value: Dict[str, Any], model_class) -> DciQueryResult:
        query = query_value.get("expression", {}).get("query", {})
        if not query:
            cls._raise_invalid_request("expression.query is required and must be non-empty.")

        # Legacy: single field "search_text" with "$eq" only
        if list(query.keys()) == ["search_text"] and isinstance(query["search_text"], dict) and list(query["search_text"].keys()) == ["$eq"]:
            value = query["search_text"]["$eq"]
            return DciQueryResult(
                search_text=cls._validate_search_text(value, "query.value.expression.query.search_text.$eq")
            )

        if model_class is None:
            cls._raise_invalid_request("Expression queries require a valid register model.")

        filter_conditions = cls._translate_expression(query, model_class)
        return DciQueryResult(search_text="", filter_conditions=filter_conditions)

    @classmethod
    def _translate_expression(cls, query: Dict[str, Any], model_class) -> list:
        config = Settings.get_config()
        allowed_fields = set(config.dci_expression_allowed_fields)
        conditions = []

        for field_name, operators in query.items():
            if field_name not in allowed_fields:
                cls._raise_invalid_request(
                    f"Field '{field_name}' is not allowed in expression queries. "
                    f"Allowed fields: {sorted(allowed_fields)}"
                )

            column = getattr(model_class, field_name, None)
            if column is None:
                cls._raise_invalid_request(
                    f"Field '{field_name}' does not exist on this register."
                )

            if not isinstance(operators, dict):
                # Shorthand: {"field": "value"} treated as {"field": {"$eq": "value"}}
                conditions.append(column == operators)
                continue

            for op, value in operators.items():
                if op not in MONGO_TO_SA_OPERATORS:
                    cls._raise_invalid_request(
                        f"Unsupported operator '{op}'. "
                        f"Supported operators: {sorted(MONGO_TO_SA_OPERATORS.keys())}"
                    )
                condition = cls._build_condition(column, op, value, field_name)
                conditions.append(condition)

        return conditions

    @classmethod
    def _build_condition(cls, column, op: str, value: Any, field_name: str):
        # Convert date strings for date columns
        col_type = str(column.type).upper()
        if "DATE" in col_type and isinstance(value, str):
            value = cls._parse_date(value, field_name)
        elif "DATE" in col_type and isinstance(value, list):
            value = [cls._parse_date(v, field_name) if isinstance(v, str) else v for v in value]

        match op:
            case "$eq":
                return column == value
            case "$ne" | "$neq":
                return column != value
            case "$gt":
                return column > value
            case "$gte":
                return column >= value
            case "$lt":
                return column < value
            case "$lte":
                return column <= value
            case "$in":
                if not isinstance(value, list):
                    cls._raise_invalid_request(f"Operator '$in' requires a list value for field '{field_name}'.")
                return column.in_(value)
            case "$nin":
                if not isinstance(value, list):
                    cls._raise_invalid_request(f"Operator '$nin' requires a list value for field '{field_name}'.")
                return ~column.in_(value)
            case "$contains":
                return column.ilike(f"%{value}%")
            case "$startsWith":
                return column.ilike(f"{value}%")
            case "$endsWith":
                return column.ilike(f"%{value}")
            case _:
                cls._raise_invalid_request(f"Unsupported operator '{op}'.")

    @classmethod
    def _parse_date(cls, value: str, field_name: str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
        except ValueError:
            cls._raise_invalid_request(
                f"Invalid date format for field '{field_name}': '{value}'. Use ISO format (YYYY-MM-DD)."
            )

    @classmethod
    def _get_idtype_value_search_text(cls, query_value: Dict[str, Any]) -> str:
        id_type = query_value.get("id_type")
        if not isinstance(id_type, str) or not id_type.strip():
            cls._raise_invalid_request("query.value.id_type is required for idtype-value queries.")

        return cls._validate_search_text(query_value.get("id_value"), "query.value.id_value")

    @classmethod
    def _validate_search_text(cls, value: Any, field_path: str) -> str:
        if not isinstance(value, str) or not value.strip():
            cls._raise_invalid_request(f"{field_path} must be a non-empty string.")
        return value.strip()

    @staticmethod
    def _raise_invalid_request(message: str):
        raise G2PRegistryException(
            code=DciSearchStatusReasonCode.SEARCH_CRITERIA_INVALID.value,
            message=message,
        )
