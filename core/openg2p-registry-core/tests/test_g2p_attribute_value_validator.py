from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import AsyncMock

import pytest

_SERVICE_PATH = (
    Path(__file__).resolve().parents[1]
    / "src/openg2p_registry_core/services/g2p_attribute_value_validator.py"
)


class _Code:
    value = ("REQUEST_VALIDATION_ERROR", "REQ-VAL-001")


class G2PRegistryException(Exception):
    def __init__(self, code=None, message=None):
        self.code = code
        self.message = message
        super().__init__(message)


@pytest.fixture(scope="module")
def validator_module():
    package = "_attribute_validator_test_core"
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
    settings = SimpleNamespace(
        validate_attribute_values=True,
        cache_expires_in_seconds=5,
    )
    config.Settings = SimpleNamespace(get_config=lambda strict=False: settings)
    sys.modules[f"{package}.config"] = config

    errors = ModuleType(f"{package}.errors")
    errors.G2PRegistryErrorCodes = SimpleNamespace(REQUEST_VALIDATION_ERROR=_Code())
    errors.G2PRegistryException = G2PRegistryException
    sys.modules[f"{package}.errors"] = errors

    service_name = f"{package}.services.g2p_attribute_value_validator"
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


def test_field_map_comes_from_attribute_widget_schema(validator_module):
    schema = {
        "panels": [
            {
                "widgets": [
                    {
                        "widget": "table",
                        "widget-data-columns": [
                            {
                                "column-key": "commodity",
                                "widget-data-source": {
                                    "params": {"attribute_id": "CROP_COMMODITY"}
                                },
                            }
                        ],
                    },
                    {
                        "widget-data-path": "person.primary_livelihood",
                        "widget-data-source": {
                            "params": {"attribute_id": "LIVELIHOOD"}
                        },
                    },
                ]
            }
        ]
    }

    assert validator_module.G2PAttributeValueValidator.field_map_from_ui_schema(
        schema
    ) == {
        "commodity": "CROP_COMMODITY",
        "primary_livelihood": "LIVELIHOOD",
    }


def test_delete_rows_are_not_validated(validator_module):
    records = [
        {"edit_action": "DELETE", "commodity": "OLD"},
        {"edit_action": "ADD", "commodity": "WHEAT"},
    ]
    assert validator_module.G2PAttributeValueValidator.records_for_validation(
        records
    ) == [{"edit_action": "ADD", "commodity": "WHEAT"}]


@pytest.mark.asyncio
async def test_disabled_validator_does_not_load_codes(validator_module):
    validator = validator_module.G2PAttributeValueValidator()
    validator_module._config.validate_attribute_values = False
    validator._load = AsyncMock()

    await validator.validate_records([{"gender": "UNKNOWN"}])

    validator._load.assert_not_awaited()
    validator_module._config.validate_attribute_values = True


@pytest.mark.asyncio
async def test_valid_scalar_and_list_codes_pass(validator_module):
    validator = validator_module.G2PAttributeValueValidator()
    validator._load = AsyncMock(
        return_value={
            "CROP_COMMODITY": {"WHEAT", "MAIZE"},
            "LIVELIHOOD": {"FARMING", "TRADING"},
        }
    )

    await validator.validate_records(
        [
            {
                "commodity": "WHEAT",
                "livelihoods": ["FARMING", "TRADING"],
                "unmapped": "ignored",
            }
        ],
        field_map={
            "commodity": "CROP_COMMODITY",
            "livelihoods": "LIVELIHOOD",
        },
    )


@pytest.mark.asyncio
async def test_invalid_mapped_code_is_rejected(validator_module):
    validator = validator_module.G2PAttributeValueValidator()
    validator._load = AsyncMock(return_value={"CROP_COMMODITY": {"WHEAT"}})

    with pytest.raises(G2PRegistryException, match="CROP_COMMODITY"):
        await validator.validate_records(
            [{"commodity": "RICE"}],
            field_map={"commodity": "CROP_COMMODITY"},
        )


@pytest.mark.asyncio
async def test_enabled_validator_rejects_empty_master_data(validator_module):
    validator = validator_module.G2PAttributeValueValidator()
    validator._load = AsyncMock(return_value={})

    with pytest.raises(G2PRegistryException, match="no attribute values"):
        await validator.validate_records(
            [{"commodity": "WHEAT"}],
            field_map={"commodity": "CROP_COMMODITY"},
        )
