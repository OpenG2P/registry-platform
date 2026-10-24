from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace

import pytest

_SERVICE_PATH = (
    Path(__file__).resolve().parents[1]
    / "src/openg2p_registry_core/services/g2p_widget_rule_validator.py"
)


class _Code:
    value = ("REQUEST_VALIDATION_ERROR", "REQ-VAL-001")


class G2PRegistryException(Exception):
    def __init__(self, code=None, message=None):
        self.code = code
        self.message = message
        super().__init__(message)


@pytest.fixture(scope="module")
def settings():
    return SimpleNamespace(validate_widget_rules=True)


@pytest.fixture(scope="module")
def validator_module(settings):
    package = "_widget_rule_validator_test_core"
    module_names = [
        package,
        f"{package}.services",
        f"{package}.config",
        f"{package}.errors",
        "openg2p_fastapi_common",
        "openg2p_fastapi_common.service",
    ]
    previous = {name: sys.modules.get(name) for name in module_names}

    for name in (package, f"{package}.services"):
        module = ModuleType(name)
        module.__path__ = []  # type: ignore[attr-defined]
        sys.modules[name] = module

    common = ModuleType("openg2p_fastapi_common")
    common.__path__ = []  # type: ignore[attr-defined]
    sys.modules["openg2p_fastapi_common"] = common
    common_service = ModuleType("openg2p_fastapi_common.service")
    common_service.BaseService = object
    sys.modules["openg2p_fastapi_common.service"] = common_service

    config = ModuleType(f"{package}.config")
    config.Settings = SimpleNamespace(get_config=lambda strict=False: settings)
    sys.modules[f"{package}.config"] = config

    errors = ModuleType(f"{package}.errors")
    errors.G2PRegistryErrorCodes = SimpleNamespace(REQUEST_VALIDATION_ERROR=_Code())
    errors.G2PRegistryException = G2PRegistryException
    sys.modules[f"{package}.errors"] = errors

    service_name = f"{package}.services.g2p_widget_rule_validator"
    spec = importlib.util.spec_from_file_location(service_name, _SERVICE_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules[service_name] = module
    assert spec.loader
    spec.loader.exec_module(module)

    yield module

    for name, old_module in previous.items():
        if old_module is None:
            sys.modules.pop(name, None)
        else:
            sys.modules[name] = old_module
    sys.modules.pop(service_name, None)


SCHEMA = {
    "panels": [
        {
            "widgets": [
                {
                    "widget-data-path": "farmer.first_name",
                    "widget-required": True,
                    "widget-data-validation": {
                        "pattern": "^[A-Za-zሀ-፿][A-Za-zሀ-፿\\s'-]*$",
                        "patternMessage": "Letters only",
                        "maxLength": 10,
                    },
                },
                {
                    "widget-data-path": "farmer.estimated_age",
                    "widget-data-validation": {"min": 0, "max": 120},
                },
                {
                    "widget-data-path": "farmer.disability_type",
                    "widget-data-options": {
                        "actions": [
                            {
                                "action": "show",
                                "condition": {"field": "farmer.disabled", "operator": "equals", "value": True},
                            },
                            {
                                "action": "require",
                                "condition": {"field": "farmer.disabled", "operator": "equals", "value": True},
                            },
                        ]
                    },
                },
                {
                    "widget-data-path": "farmer.nickname",
                    "widget-required": True,
                    "widget-data-validation": {"required": False},
                },
                {
                    "widget": "table",
                    "widget-data-columns": [
                        {"column-key": "phone", "widget-data-validation": {"validationType": "phone"}},
                    ],
                },
            ]
        }
    ]
}


def _check(module, records, check_required=True):
    validator = module.G2PWidgetRuleValidator()
    rules = module.G2PWidgetRuleValidator.rules_from_ui_schema(SCHEMA)
    validator.validate_records(records, rules=rules, check_required=check_required)


def _rejects(module, records, check_required=True) -> str:
    with pytest.raises(G2PRegistryException) as raised:
        _check(module, records, check_required)
    return raised.value.message


def test_rules_come_from_widget_paths_and_table_columns(validator_module):
    rules = validator_module.G2PWidgetRuleValidator.rules_from_ui_schema(SCHEMA)
    assert set(rules) == {"first_name", "estimated_age", "disability_type", "nickname", "phone"}


def test_valid_record_passes(validator_module):
    _check(validator_module, [{"first_name": "Abebe", "estimated_age": 40, "disabled": False}])


def test_ethiopic_name_passes_and_digits_fail(validator_module):
    _check(validator_module, [{"first_name": "አበበ"}])
    assert "Letters only" in _rejects(validator_module, [{"first_name": "Abebe2"}])


def test_length_and_range(validator_module):
    assert "maximum length is 10" in _rejects(validator_module, [{"first_name": "Abebebebebebe"}])
    assert "maximum value is 120" in _rejects(validator_module, [{"first_name": "Abebe", "estimated_age": 130}])


def test_validation_type_on_a_table_column(validator_module):
    _check(validator_module, [{"first_name": "Abebe", "phone": "+251 911 234567"}])
    assert "Invalid phone number" in _rejects(validator_module, [{"first_name": "Abebe", "phone": "call me"}])


def test_required_on_submit_but_not_on_draft_save(validator_module):
    assert "first_name is required" in _rejects(validator_module, [{"estimated_age": 30}])
    _check(validator_module, [{"estimated_age": 30}], check_required=False)
    # Formats are still checked on a draft save.
    assert "Letters only" in _rejects(validator_module, [{"first_name": "x1"}], check_required=False)


def test_partial_update_of_an_existing_record_is_not_a_blank(validator_module):
    _check(validator_module, [{"internal_record_id": "r1", "estimated_age": 30}])
    assert "first_name is required" in _rejects(
        validator_module, [{"internal_record_id": "r1", "first_name": ""}]
    )


def test_hidden_widget_is_skipped_and_require_action_applies(validator_module):
    _check(validator_module, [{"first_name": "Abebe", "disabled": False, "disability_type": None}])
    assert "disability_type is required" in _rejects(
        validator_module, [{"first_name": "Abebe", "disabled": True}]
    )


def test_validation_required_false_overrides_widget_required(validator_module):
    _check(validator_module, [{"first_name": "Abebe", "nickname": ""}])


def test_disabled_by_default(validator_module, settings):
    settings.validate_widget_rules = False
    try:
        _check(validator_module, [{"first_name": "Abebe2"}])
    finally:
        settings.validate_widget_rules = True
