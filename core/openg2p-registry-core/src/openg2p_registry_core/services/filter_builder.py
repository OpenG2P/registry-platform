"""
Filter Builder Service for GraphQL-style filtering with security validations.

This module provides secure filtering capabilities based on GraphQL conventions,
with built-in protection against:
- Unauthorized field access (whitelist from filter_schema)
- DoS via complex queries (limits on filter count and operators)
- Type confusion (validation based on filter_type)
- SQL injection (via SQLAlchemy parameterized queries)
"""

import json
import logging
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, String, and_, cast, not_, or_
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql.elements import ColumnElement
from sqlalchemy.types import JSON as SAJSON

from ..schemas.g2p_data_policy import PolicyFilterCondition, PolicyFilterGroup
from ..schemas.register_payload import FilterOperator as RegisterFilterOperator

_logger = logging.getLogger(__name__)

# Security constants
MAX_FILTER_FIELDS = 10
MAX_OPERATORS_PER_FIELD = 3
MAX_IN_LIST_SIZE = 100


class FilterBuilder:
    """
    Builds SQLAlchemy filter conditions from GraphQL-style filter input.
    Includes security validations based on filter_schema.
    """

    def __init__(self, filter_schema: list[dict] | None = None):
        """
        Initialize with allowed filter schema.
        
        Args:
            filter_schema: List of FilterSchemaField dicts defining allowed filters
        """
        self.filter_schema = filter_schema or []
        self.allowed_fields = {f["field_name"]: f for f in self.filter_schema}

    def build_conditions(self, filter_by: dict | str | None, model_class) -> list:
        """
        Build SQLAlchemy filter conditions with security validations.

        Args:
            filter_by: Dict of field_name -> operators/value, or JSON string
            model_class: SQLAlchemy model class

        Returns:
            List of SQLAlchemy filter conditions

        Raises:
            ValueError: If filter validation fails
        """
        if not filter_by:
            return []

        # Handle JSON string input (parse to dict)
        if isinstance(filter_by, str):
            try:
                filter_by = json.loads(filter_by)
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid filter_by JSON string: {e}")

            # After parsing, if it's still not a dict, return empty
            if not isinstance(filter_by, dict):
                _logger.warning(f"filter_by parsed to non-dict type: {type(filter_by)}")
                return []

        # Security: Limit number of filter fields
        if len(filter_by) > MAX_FILTER_FIELDS:
            raise ValueError(f"Too many filter fields. Maximum: {MAX_FILTER_FIELDS}")

        conditions = []

        for field_name, operators in filter_by.items():
            # Security: Check if field is allowed (whitelist)
            if field_name not in self.allowed_fields:
                _logger.warning(f"Attempted filter on unauthorized field: {field_name}")
                continue

            field_config = self.allowed_fields[field_name]

            try:
                column = getattr(model_class, field_name)
            except AttributeError:
                _logger.warning(f"Filter column {field_name} not found on model")
                continue

            # Handle simple value (backward compatibility)
            if not isinstance(operators, dict):
                allowed_ops = field_config.get("allowed_operators", [])
                if "eq" not in allowed_ops:
                    _logger.warning(f"Operator 'eq' not allowed for field {field_name}")
                    continue
                self._validate_value(field_config, "eq", operators)
                conditions.append(column == operators)
                continue

            # Handle operator dict
            field_conditions = self._build_field_conditions(
                column, field_name, operators, field_config
            )
            conditions.extend(field_conditions)

        return conditions

    def build_merged_data_policy_condition(
        self,
        expression: dict | None,
        model_class,
    ) -> ColumnElement | None:
        """
        Build SQL from merged policy expression.

        Primary: GROUP/CONDITION tree. Future: {"filter_bys": [...]} register filter_by shape.
        """
        if not expression or not isinstance(expression, dict):
            return None

        if expression.get("type") in ("GROUP", "CONDITION"):
            return self.build_policy_expression_condition(expression, model_class)

        filter_bys = expression.get("filter_bys")
        if filter_bys is not None:
            if not isinstance(filter_bys, list):
                raise ValueError("policy filter_bys must be a list")
            policy_parts: list[ColumnElement] = []
            for policy_filter_by in filter_bys:
                if not isinstance(policy_filter_by, dict):
                    continue
                field_conditions = self.build_policy_conditions(policy_filter_by, model_class)
                if field_conditions:
                    policy_parts.append(and_(*field_conditions))
            if not policy_parts:
                return None
            return or_(*policy_parts) if len(policy_parts) > 1 else policy_parts[0]

        return self.build_policy_expression_condition(expression, model_class)

    def build_policy_expression_condition(
        self,
        expression: dict | None,
        model_class,
    ) -> ColumnElement | None:
        """
        Build a single SQLAlchemy condition from a GROUP/CONDITION policy tree.
        filter_schema whitelist is not applied.
        """
        if not expression:
            return None

        if isinstance(expression, dict):
            node_type = expression.get("type")
            if node_type == "CONDITION":
                expression = PolicyFilterCondition.model_validate(expression)
            elif node_type == "GROUP":
                expression = PolicyFilterGroup.model_validate(expression)
            else:
                raise ValueError(f"Unknown policy filter node type: {node_type}")

        if isinstance(expression, PolicyFilterCondition):
            return self._build_policy_condition_node(expression, model_class)
        if isinstance(expression, PolicyFilterGroup):
            return self._build_policy_group_node(expression, model_class)
        raise ValueError(f"Unsupported policy filter expression type: {type(expression)}")

    def _build_policy_group_node(
        self, group: PolicyFilterGroup, model_class
    ) -> ColumnElement | None:
        child_conditions: list[ColumnElement] = []
        for child in group.children:
            child_condition = self.build_policy_expression_condition(child, model_class)
            if child_condition is not None:
                child_conditions.append(child_condition)

        if not child_conditions:
            return None

        operator = (
            group.operator.value if hasattr(group.operator, "value") else str(group.operator)
        )
        if operator == "AND":
            return and_(*child_conditions)
        if operator == "OR":
            return or_(*child_conditions)
        if operator == "NOT":
            if len(child_conditions) != 1:
                raise ValueError("NOT group must have exactly one child condition")
            return not_(child_conditions[0])
        raise ValueError(f"Unsupported group operator: {operator}")

    def _policy_operator_value(self, operator) -> str:
        return operator.value if hasattr(operator, "value") else str(operator)

    def _coerce_policy_value(self, column, value: Any) -> Any:
        """Coerce policy literal values to match the ORM column type."""
        if value is None:
            return value
        col_type = getattr(column, "type", None)
        if isinstance(col_type, Boolean):
            if isinstance(value, bool):
                return value
            if isinstance(value, str):
                normalized = value.strip().upper()
                if normalized in ("TRUE", "1", "YES"):
                    return True
                if normalized in ("FALSE", "0", "NO"):
                    return False
        return value

    def _build_policy_condition_node(
        self, condition: PolicyFilterCondition, model_class
    ) -> ColumnElement | None:
        field_id = condition.field_id
        try:
            column = getattr(model_class, field_id)
        except AttributeError:
            _logger.warning("Policy filter field %s not found on register model", field_id)
            return None

        filter_operator = self._policy_operator_value(condition.operator)

        if filter_operator in (RegisterFilterOperator.IN.value, "in"):
            value = condition.values if condition.values is not None else []
            if not isinstance(value, list):
                raise ValueError(
                    f"Operator '{RegisterFilterOperator.IN.value}' requires a list value for field {field_id}"
                )
        elif filter_operator in (RegisterFilterOperator.NIN.value, "nin"):
            value = condition.values if condition.values is not None else []
            if not isinstance(value, list):
                raise ValueError(
                    f"Operator '{RegisterFilterOperator.NIN.value}' requires a list value for field {field_id}"
                )
        else:
            value = self._coerce_policy_value(column, condition.value)

        return self._build_single_condition(column, filter_operator, value)

    def build_policy_conditions(self, filter_by: dict | str | None, model_class) -> list:
        """Build policy filter conditions from register filter_by dict (future format)."""
        if not filter_by:
            return []

        if isinstance(filter_by, str):
            try:
                filter_by = json.loads(filter_by)
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid policy filter_by JSON string: {e}")
            if not isinstance(filter_by, dict):
                return []

        if len(filter_by) > MAX_FILTER_FIELDS:
            raise ValueError(f"Too many policy filter fields. Maximum: {MAX_FILTER_FIELDS}")

        conditions = []
        for field_name, operators in filter_by.items():
            try:
                column = getattr(model_class, field_name)
            except AttributeError:
                _logger.warning("Policy filter field %s not found on register model", field_name)
                continue

            if not isinstance(operators, dict):
                conditions.append(column == operators)
                continue

            if len(operators) > MAX_OPERATORS_PER_FIELD:
                raise ValueError(
                    f"Too many operators for policy field {field_name}. "
                    f"Maximum: {MAX_OPERATORS_PER_FIELD}"
                )

            for operator, value in operators.items():
                if operator in ("in", "nin") and isinstance(value, list) and len(value) > MAX_IN_LIST_SIZE:
                    raise ValueError(
                        f"IN list too large for policy field {field_name}. Maximum: {MAX_IN_LIST_SIZE}"
                    )
                condition = self._build_single_condition(column, operator, value)
                if condition is not None:
                    conditions.append(condition)

        return conditions

    def _build_field_conditions(
        self,
        column,
        field_name: str,
        operators: dict,
        field_config: dict
    ) -> list:
        """Build conditions for a single field."""
        conditions = []
        allowed_operators = set(field_config.get("allowed_operators", []))
        filter_type = field_config.get("filter_type", "text")

        # Security: Limit operators per field
        if len(operators) > MAX_OPERATORS_PER_FIELD:
            raise ValueError(
                f"Too many operators for field {field_name}. Maximum: {MAX_OPERATORS_PER_FIELD}"
            )

        for operator, value in operators.items():
            # Security: Check if operator is allowed for this field
            if operator not in allowed_operators:
                _logger.warning(
                    f"Operator '{operator}' not allowed for field {field_name}"
                )
                continue

            # Security: Validate value type
            self._validate_value(field_config, operator, value)

            # Convert date strings to date objects for date_range filters
            if filter_type == "date_range":
                if isinstance(value, str):
                    value = self._convert_to_date(value)
                elif isinstance(value, list):
                    value = [self._convert_to_date(v) if isinstance(v, str) else v for v in value]

            condition = self._build_single_condition(column, operator, value)
            if condition is not None:
                conditions.append(condition)

        return conditions

    def _validate_value(self, field_config: dict, operator: str, value: Any):
        """
        Validate filter value type matches expected filter_type.
        Raises ValueError on invalid input.
        """
        filter_type = field_config.get("filter_type")
        field_name = field_config.get("field_name")

        # Validate list size for IN operators
        if operator in ("in", "nin"):
            if not isinstance(value, list):
                raise ValueError(f"Operator '{operator}' requires a list value")
            if len(value) > MAX_IN_LIST_SIZE:
                raise ValueError(
                    f"IN list too large for {field_name}. Maximum: {MAX_IN_LIST_SIZE}"
                )

        # Type validation based on filter_type
        if filter_type == "number_range":
            if operator in ("gt", "gte", "lt", "lte", "eq", "neq"):
                if value is not None and not isinstance(value, (int, float)):
                    raise ValueError(
                        f"Invalid type for numeric filter on {field_name}"
                    )
            elif operator == "between":
                if not isinstance(value, (list, tuple)) or len(value) != 2:
                    raise ValueError(
                        f"Operator 'between' requires a list of 2 values for {field_name}"
                    )
                for v in value:
                    if v is not None and not isinstance(v, (int, float)):
                        raise ValueError(
                            f"Invalid type for numeric filter on {field_name}"
                        )

        elif filter_type == "date_range":
            if operator in ("gt", "gte", "lt", "lte", "eq", "neq"):
                self._validate_date(value, field_name)
            elif operator == "between":
                if not isinstance(value, (list, tuple)) or len(value) != 2:
                    raise ValueError(
                        f"Operator 'between' requires a list of 2 values for {field_name}"
                    )
                self._validate_date(value[0], field_name)
                self._validate_date(value[1], field_name)

        elif filter_type == "dropdown":
            options = field_config.get("options", [])
            if options:  # Static options defined
                allowed_values = [opt["value"] for opt in options]
                if operator == "eq" and value not in allowed_values:
                    raise ValueError(
                        f"Invalid option '{value}' for {field_name}"
                    )
                if operator == "in":
                    invalid = [v for v in value if v not in allowed_values]
                    if invalid:
                        raise ValueError(
                            f"Invalid options {invalid} for {field_name}"
                        )

        elif filter_type == "boolean":
            if not isinstance(value, bool):
                raise ValueError(f"Boolean value required for {field_name}")

    def _validate_date(self, value: Any, field_name: str):
        """Validate date string format (ISO 8601)."""
        if value is None:
            return
        if isinstance(value, str):
            try:
                # Handle ISO format with or without timezone
                datetime.fromisoformat(value.replace('Z', '+00:00'))
            except ValueError:
                raise ValueError(
                    f"Invalid date format for {field_name}. Use ISO format (YYYY-MM-DD)"
                )
        elif not isinstance(value, datetime):
            raise ValueError(
                f"Invalid date type for {field_name}. Expected string or datetime"
            )

    def _convert_to_date(self, value: str):
        """Convert a date string to a date object for database comparison."""
        try:
            # Parse ISO format date string to date object
            return datetime.fromisoformat(value.replace('Z', '+00:00')).date()
        except ValueError:
            # Return as-is if conversion fails (validation should have caught this)
            return value

    def _column_for_text_match(self, column):
        """Cast JSON/JSONB columns to text so ILIKE is valid in PostgreSQL."""
        if isinstance(column.type, (JSONB, SAJSON)):
            return cast(column, String)
        return column

    def _build_single_condition(self, column, operator: str, value: Any):
        """Build a single SQLAlchemy filter condition based on operator."""
        match operator:
            # Equality
            case "eq":
                return column == value
            case "neq":
                return column != value

            # List operations
            case "in":
                return column.in_(value)
            case "nin":
                return ~column.in_(value)

            # String operations (case-insensitive; JSONB must be cast to text)
            case "contains":
                return self._column_for_text_match(column).ilike(f"%{value}%")
            case "ncontains":
                return ~self._column_for_text_match(column).ilike(f"%{value}%")
            case "startsWith":
                return self._column_for_text_match(column).ilike(f"{value}%")
            case "endsWith":
                return self._column_for_text_match(column).ilike(f"%{value}")

            # Comparison operations (for numbers/dates)
            case "gt":
                return column > value
            case "gte":
                return column >= value
            case "lt":
                return column < value
            case "lte":
                return column <= value

            # Range operation (for numbers/dates)
            case "between":
                if isinstance(value, (list, tuple)) and len(value) == 2:
                    return column.between(value[0], value[1])
                return None

            # Null checks
            case "isNull":
                return column.is_(None) if value else column.isnot(None)

            case _:
                _logger.warning(f"Unknown operator {operator}")
                return None

