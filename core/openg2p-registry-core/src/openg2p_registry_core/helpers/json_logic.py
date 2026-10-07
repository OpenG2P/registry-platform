"""A small JSON Logic evaluator (https://jsonlogic.com) for configured rules.

Rules are data, not code: an expression is a JSON object ``{"<operator>": [args]}``
and nothing outside the operators below can run (no eval, no attribute access,
no imports). Values are read from the data with ``{"var": "a.b.c"}`` (a dotted
path; list items by index) or ``{"var": ["a.b", <default>]}``.

Operators: ``var missing missing_some if ?: and or ! !! == != === !== < <= > >=
+ - * / % min max cat in merge``. Semantics follow the JSON Logic spec (and its
JavaScript coercions for numbers and strings): ``< / <=`` with three arguments
test "between"; 0, "", [], null and false are falsy.

Beyond the spec, the evaluator records every ``var`` without a default whose
value is missing (absent or null) in ``Evaluation.missing``: a rule uses this to
mean "not applicable" rather than comparing against null.
"""

import math
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

OPERATORS = frozenset({
    "var", "missing", "missing_some", "if", "?:", "and", "or", "!", "!!",
    "==", "!=", "===", "!==", "<", "<=", ">", ">=",
    "+", "-", "*", "/", "%", "min", "max", "cat", "in", "merge",
})

_MISSING = object()


class JsonLogicError(ValueError):
    """An expression that is not valid JSON Logic (unknown operator, malformed var…)."""


def validate(logic: Any, path: str = "$") -> list[str]:
    """Problems with an expression, without evaluating it ([] when valid)."""
    if isinstance(logic, list):
        return [problem for index, item in enumerate(logic) for problem in validate(item, f"{path}[{index}]")]
    if not isinstance(logic, dict):
        return []
    if len(logic) != 1:
        return [f"{path}: an operation is an object with exactly one operator, got {sorted(logic)}"]
    operator, args = next(iter(logic.items()))
    if operator not in OPERATORS:
        return [f"{path}: unknown operator {operator!r}"]
    if operator == "var":
        arguments = args if isinstance(args, list) else [args]
        if not arguments or len(arguments) > 2 or not isinstance(arguments[0], (str, int)) or isinstance(
            arguments[0], bool
        ):
            return [f"{path}: var takes a path (\"a.b\") or [path, default]"]
    return validate(args, f"{path}.{operator}")


def to_number(value: Any) -> float:
    if isinstance(value, bool):
        return 1.0 if value else 0.0
    if isinstance(value, (int, float, Decimal)):
        return float(value)
    if value is None:
        return 0.0
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return 0.0
        try:
            return float(text)
        except ValueError:
            return math.nan
    return math.nan


def truthy(value: Any) -> bool:
    if isinstance(value, (list, tuple, dict, str)):
        return len(value) > 0
    if isinstance(value, float) and math.isnan(value):
        return False
    return bool(value)


def _number_like(value: Any) -> bool:
    return isinstance(value, (int, float, Decimal)) and not isinstance(value, bool)


def _loose_equal(a: Any, b: Any) -> bool:
    if a is None or b is None:
        return a is None and b is None
    if isinstance(a, str) and isinstance(b, str):
        return a == b
    if _number_like(a) or _number_like(b) or isinstance(a, bool) or isinstance(b, bool):
        return to_number(a) == to_number(b)
    return a == b


def _compare(a: Any, b: Any) -> Optional[int]:
    """-1/0/1, or None when not comparable (NaN)."""
    if isinstance(a, str) and isinstance(b, str):
        return (a > b) - (a < b)
    x, y = to_number(a), to_number(b)
    if math.isnan(x) or math.isnan(y):
        return None
    return (x > y) - (x < y)


def _less(a, b, or_equal: bool) -> bool:
    order = _compare(a, b)
    return order is not None and (order < 0 or (or_equal and order == 0))


def _to_string(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def json_value(value: Any) -> Any:
    """A value as rules see it: numbers as float/int, dates as ISO strings, containers recursively."""
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: json_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_value(item) for item in value]
    return value


class Evaluation:
    """One evaluation over one data object; ``missing`` lists vars read without a value."""

    def __init__(self, data: Any):
        self.data = data
        self.missing: list[str] = []

    def lookup(self, path: Any, default: Any = _MISSING) -> Any:
        if path in (None, ""):
            return self.data
        current = self.data
        for part in str(path).split("."):
            if isinstance(current, dict) and part in current:
                current = current[part]
            elif isinstance(current, (list, tuple)) and part.lstrip("-").isdigit() and -len(current) <= int(part) < len(current):
                current = current[int(part)]
            else:
                current = None
                break
        if current is None:
            if default is _MISSING:
                self.missing.append(str(path))
                return None
            return default
        return current

    def apply(self, logic: Any) -> Any:
        if isinstance(logic, list):
            return [self.apply(item) for item in logic]
        if not isinstance(logic, dict):
            return logic
        if len(logic) != 1:
            raise JsonLogicError(f"An operation is an object with exactly one operator, got {sorted(logic)}")
        operator, args = next(iter(logic.items()))
        if operator not in OPERATORS:
            raise JsonLogicError(f"Unknown operator {operator!r}")
        if not isinstance(args, list):
            args = [args]

        # Operators that evaluate their arguments lazily.
        if operator in ("if", "?:"):
            index = 0
            while index + 1 < len(args):
                if truthy(self.apply(args[index])):
                    return self.apply(args[index + 1])
                index += 2
            return self.apply(args[index]) if index < len(args) else None
        if operator in ("and", "or"):
            value = None
            for arg in args:
                value = self.apply(arg)
                if truthy(value) is (operator == "or"):
                    return value
            return value

        values = [self.apply(arg) for arg in args]
        first = values[0] if values else None
        second = values[1] if len(values) > 1 else None

        if operator == "var":
            return self.lookup(first) if len(values) < 2 else self.lookup(first, second)
        if operator == "missing":
            keys = first if len(values) == 1 and isinstance(first, list) else values
            return [key for key in keys if self.lookup(key, None) in (None, "")]
        if operator == "missing_some":
            need, keys = int(to_number(first)), second or []
            absent = [key for key in keys if self.lookup(key, None) in (None, "")]
            return [] if len(keys) - len(absent) >= need else absent
        if operator == "!":
            return not truthy(first)
        if operator == "!!":
            return truthy(first)
        if operator == "==":
            return _loose_equal(first, second)
        if operator == "!=":
            return not _loose_equal(first, second)
        if operator == "===":
            return type(first) is type(second) and first == second
        if operator == "!==":
            return not (type(first) is type(second) and first == second)
        if operator in ("<", "<="):
            or_equal = operator == "<="
            if len(values) >= 3:  # between
                return _less(first, second, or_equal) and _less(second, values[2], or_equal)
            return _less(first, second, or_equal)
        if operator == ">":
            return _less(second, first, False)
        if operator == ">=":
            return _less(second, first, True)
        if operator == "+":
            return sum(to_number(value) for value in values)
        if operator == "*":
            return math.prod(to_number(value) for value in values) if values else 0.0
        if operator == "-":
            return -to_number(first) if len(values) == 1 else to_number(first) - to_number(second)
        if operator == "/":
            divisor = to_number(second)
            return math.nan if divisor == 0 else to_number(first) / divisor
        if operator == "%":
            divisor = to_number(second)
            return math.nan if divisor == 0 else math.fmod(to_number(first), divisor)
        if operator in ("min", "max"):
            numbers = [to_number(value) for value in values]
            if not numbers or any(math.isnan(number) for number in numbers):
                return None
            return min(numbers) if operator == "min" else max(numbers)
        if operator == "cat":
            return "".join(_to_string(value) for value in values)
        if operator == "in":
            if isinstance(second, str):
                return _to_string(first) in second
            return isinstance(second, (list, tuple)) and first in second
        if operator == "merge":
            merged: list = []
            for value in values:
                merged.extend(value if isinstance(value, list) else [value])
            return merged
        raise JsonLogicError(f"Unknown operator {operator!r}")  # pragma: no cover - OPERATORS is exhaustive


def apply(logic: Any, data: Any = None) -> Any:
    """Evaluate an expression against data."""
    return Evaluation(data).apply(logic)
