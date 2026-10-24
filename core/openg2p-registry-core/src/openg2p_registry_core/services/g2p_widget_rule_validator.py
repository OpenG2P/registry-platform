import logging
import re
from typing import Any, Optional

from openg2p_fastapi_common.service import BaseService

from ..config import Settings
from ..errors import G2PRegistryErrorCodes, G2PRegistryException

_config = Settings.get_config(strict=False)
_logger = logging.getLogger("g2p-widget-rule-validator")

# The patterns ui-widgets applies for validationType (utils/validationPatterns.ts).
_VALIDATION_TYPES = {
    "email": (
        r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?"
        r"(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$",
        "Invalid email address",
    ),
    "phone": (
        r"^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$",
        "Invalid phone number",
    ),
    "url": (
        r"^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$",
        "Invalid URL",
    ),
}


class G2PWidgetRuleValidator(BaseService):
    """Apply a section's widget-data-validation rules on the server.

    The staff portal checks these rules as the user types, but bulk import, the
    partner API and ingestion never load the form. This applies the same rules,
    read from the same section_ui_schema, so a register declares them once.
    Semantics follow ui-widgets (utils/validation.ts, utils/conditions.ts): a
    pattern is searched, not fully matched; length applies to strings and range
    to numbers; a widget hidden by its show/hide rules is not checked; and a
    `require` action adds to widget-required.
    """

    def __init__(self):
        super().__init__()

    @property
    def enabled(self) -> bool:
        return bool(getattr(_config, "validate_widget_rules", False))

    @staticmethod
    def _field(path: Any) -> Optional[str]:
        # widget-data-path is a store path ("farmer.first_name"); records are flat.
        if isinstance(path, str) and path.strip():
            return path.rsplit(".", 1)[-1].strip()
        return None

    @classmethod
    def rules_from_ui_schema(cls, schema: Any) -> dict[str, dict]:
        """Map persisted fields to their widget's rules: validation, required, options."""
        rules: dict[str, dict] = {}

        def walk(node: Any) -> None:
            if isinstance(node, list):
                for item in node:
                    walk(item)
                return
            if not isinstance(node, dict):
                return

            validation = node.get("widget-data-validation")
            required = node.get("widget-required") is True
            options = node.get("widget-data-options")
            field = node.get("column-key") if isinstance(node.get("column-key"), str) else None
            field = field or cls._field(node.get("widget-data-path"))
            if field and (isinstance(validation, dict) or required or isinstance(options, dict)):
                rules[field] = {
                    "validation": validation if isinstance(validation, dict) else {},
                    "required": required,
                    "options": options if isinstance(options, dict) else {},
                }

            for value in node.values():
                walk(value)

        walk(schema)
        return rules

    @staticmethod
    def _option_rules(options: dict) -> list[dict]:
        actions = options.get("actions")
        if isinstance(actions, list) and actions:
            return [r for r in actions if isinstance(r, dict) and r.get("action")]
        if options.get("action") and options.get("condition"):
            return [{"action": options["action"], "condition": options["condition"]}]
        return []

    @staticmethod
    def _boolean_like(value: Any) -> bool:
        if value is True or value == 1:
            return True
        if value is False or value == 0:
            return False
        if isinstance(value, str):
            return value.strip().lower() in ("true", "yes", "1")
        return bool(value)

    @classmethod
    def _matches(cls, condition: dict, record: dict) -> bool:
        actual = record.get(cls._field(condition.get("field")) or "")
        operator, expected = condition.get("operator"), condition.get("value")
        if operator == "equals":
            if isinstance(expected, bool):
                return isinstance(actual, bool) and actual is expected
            if isinstance(actual, bool):
                return actual is cls._boolean_like(expected)
            return actual == expected
        if operator == "notEquals":
            return actual != expected
        if operator == "notEmpty":
            return actual not in (None, "")
        if operator == "empty":
            return actual in (None, "")
        if operator in ("greaterThan", "lessThan"):
            try:
                a, b = float(actual), float(expected)
            except (TypeError, ValueError):
                return False
            return a > b if operator == "greaterThan" else a < b
        if operator in ("contains", "notContains"):
            if isinstance(actual, str) and isinstance(expected, str) or isinstance(actual, list):
                found = expected in actual
            else:
                found = False
            return found if operator == "contains" else not found
        return False

    @classmethod
    def _state(cls, rule: dict, record: dict) -> tuple[bool, bool]:
        """(visible, required) after the widget's show/hide/require rules.

        widget-data-validation.required, when set, wins over widget-required,
        as in the portal; a matching `require` action then adds to it.
        """
        base = rule["validation"].get("required")
        base = rule["required"] if base is None else base is True
        visible, required = True, base
        for option in cls._option_rules(rule["options"]):
            condition = option.get("condition")
            if not isinstance(condition, dict):
                continue
            match = cls._matches(condition, record)
            action = option["action"]
            if action == "show":
                visible = match
            elif action == "hide":
                visible = not match
            elif action == "require":
                required = base or match
        return visible, required

    @staticmethod
    def _empty(value: Any) -> bool:
        if value is None or value == "":
            return True
        if isinstance(value, dict) and "value" in value:
            return value["value"] in (None, "")
        return False

    @classmethod
    def _problems(cls, field: str, value: Any, rule: dict, required: bool) -> list[str]:
        validation = rule["validation"]
        if cls._empty(value):
            return [f"{field} is required"] if required else []

        problems = []
        if isinstance(value, str):
            pattern, message = validation.get("pattern"), validation.get("patternMessage")
            if not pattern and validation.get("validationType") in _VALIDATION_TYPES:
                pattern, default = _VALIDATION_TYPES[validation["validationType"]]
                message = message or default
            if pattern:
                try:
                    if not re.search(pattern, value):
                        problems.append(f"{field}: {message or 'Invalid format'}")
                except re.error:
                    _logger.warning("ignoring unparseable pattern on %s: %r", field, pattern)
            if validation.get("minLength") and len(value) < validation["minLength"]:
                problems.append(f"{field}: minimum length is {validation['minLength']}")
            if validation.get("maxLength") and len(value) > validation["maxLength"]:
                problems.append(f"{field}: maximum length is {validation['maxLength']}")
        elif isinstance(value, (int, float)) and not isinstance(value, bool):
            if validation.get("min") is not None and value < validation["min"]:
                problems.append(f"{field}: minimum value is {validation['min']}")
            if validation.get("max") is not None and value > validation["max"]:
                problems.append(f"{field}: maximum value is {validation['max']}")
        return problems

    def validate_records(
        self,
        records: list[dict],
        *,
        rules: dict[str, dict],
        check_required: bool,
    ) -> None:
        """Raise on the first record set that breaks a rule.

        check_required mirrors the portal: a section saved while the form is
        still being filled in checks formats only, and required fields are
        enforced when the data is submitted for approval.
        """
        if not self.enabled or not records or not rules:
            return

        problems: list[str] = []
        for index, record in enumerate(records):
            if not isinstance(record, dict):
                continue
            # A record that already exists may be sent as a partial update, so a
            # field it leaves out is unchanged, not blank. A new record (no
            # internal_record_id yet) must carry every required field.
            is_new = not record.get("internal_record_id")
            for field, rule in rules.items():
                visible, required = self._state(rule, record)
                if not visible:
                    continue
                required = required and check_required and (is_new or field in record)
                for problem in self._problems(field, record.get(field), rule, required):
                    problems.append(f"record {index}: {problem}")

        if problems:
            _logger.info("rejected %d widget rule violation(s)", len(problems))
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.REQUEST_VALIDATION_ERROR.value[1],
                message="; ".join(problems),
            )
