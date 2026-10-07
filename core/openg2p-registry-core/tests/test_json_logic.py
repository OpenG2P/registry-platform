"""The JSON Logic evaluator used by activity register rules."""

import math
from decimal import Decimal

import pytest
from openg2p_registry_core.helpers import json_logic
from openg2p_registry_core.helpers.json_logic import Evaluation, JsonLogicError, apply, validate


@pytest.mark.parametrize(
    "logic, data, expected",
    [
        ({"var": "a"}, {"a": 1}, 1),
        ({"var": "a.b.c"}, {"a": {"b": {"c": "x"}}}, "x"),
        ({"var": "a.1"}, {"a": [10, 20]}, 20),
        ({"var": ["a", 5]}, {}, 5),
        ({"var": ""}, {"a": 1}, {"a": 1}),
        ({"==": [1, "1"]}, None, True),
        ({"===": [1, "1"]}, None, False),
        ({"!=": [None, 0]}, None, True),
        ({"<": [1, 2, 3]}, None, True),
        ({"<=": [1, 1, 0]}, None, False),
        ({">": ["10", 9]}, None, True),
        ({">=": ["b", "a"]}, None, True),
        ({"+": [1, "2", 3.5]}, None, 6.5),
        ({"-": [5]}, None, -5),
        ({"*": [2, 1.5]}, None, 3.0),
        ({"/": [1, 4]}, None, 0.25),
        ({"%": [7, 3]}, None, 1),
        ({"min": [3, 1, 2]}, None, 1),
        ({"max": [3, 1, 2]}, None, 3),
        ({"cat": ["a", 1, 2.0, None]}, None, "a12null"),
        ({"in": ["b", ["a", "b"]]}, None, True),
        ({"in": ["ell", "hello"]}, None, True),
        ({"merge": [[1], 2, [3]]}, None, [1, 2, 3]),
        ({"!": [[]]}, None, True),
        ({"!!": ["0"]}, None, True),
        ({"and": [1, 0, 2]}, None, 0),
        ({"or": [0, "", "x"]}, None, "x"),
        ({"if": [False, "a", True, "b", "c"]}, None, "b"),
        ({"if": [False, "a", "c"]}, None, "c"),
        ({"missing": ["a", "b"]}, {"a": 1, "b": ""}, ["b"]),
        ({"missing_some": [1, ["a", "b"]]}, {"a": 1}, []),
        ({"<=": [{"var": "x"}, {"*": [{"var": "y"}, 1.5]}]}, {"x": Decimal(3), "y": 2}, True),
    ],
)
def test_operators(logic, data, expected):
    assert apply(logic, json_logic.json_value(data)) == expected


def test_non_numbers_compare_false_and_division_by_zero_is_nan():
    assert apply({"<": ["abc", 1]}) is False and apply({">": ["abc", 1]}) is False
    assert math.isnan(apply({"/": [1, 0]}))


def test_missing_vars_are_recorded_unless_defaulted_or_short_circuited():
    evaluation = Evaluation({"a": None, "b": 1})
    evaluation.apply({"+": [{"var": "a"}, {"var": "c.d"}, {"var": ["e", 0]}, {"var": "b"}]})
    assert evaluation.missing == ["a", "c.d"]

    evaluation = Evaluation({"a": 0})
    evaluation.apply({"and": [{"var": "a"}, {"var": "never_read"}]})
    assert evaluation.missing == []


def test_validate_reports_unknown_operators_and_malformed_vars():
    assert validate({"<=": [{"var": "a"}, 1]}) == []
    problems = validate({"and": [{"exec": ["x"]}, {"var": [1, 2, 3]}, {"a": 1, "b": 2}]})
    assert len(problems) == 3
    assert "unknown operator 'exec'" in problems[0]
    with pytest.raises(JsonLogicError):
        apply({"__import__": ["os"]})
