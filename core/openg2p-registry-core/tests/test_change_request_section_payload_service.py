from __future__ import annotations

import ast
import importlib.util
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from pydantic import BaseModel, ConfigDict
from sqlalchemy import Column, String
from sqlalchemy.orm import declarative_base

_CORE_ROOT = Path(__file__).resolve().parents[1]
_CORE_SRC = _CORE_ROOT / "src" / "openg2p_registry_core"
_SERVICE_PATH = _CORE_SRC / "services" / "g2p_change_request_section_payload_service.py"
_REGISTER_CR_SERVICE_PATH = (
    _CORE_SRC / "services" / "g2p_register_change_request_service.py"
)
_WORKER_SERVICE_PATH = _CORE_SRC / "services" / "g2p_change_request_worker_service.py"
_CORE_SERVICE_PATH = _CORE_SRC / "services" / "g2p_change_request_core_service.py"


class DocumentAttachment(BaseModel):
    document_id: str
    label: str


class ChangePayload(BaseModel):
    internal_record_id: str | None = None
    edit_action: str = "ADD"
    documents: list[DocumentAttachment] | None = None

    model_config = ConfigDict(extra="allow")


class _Code:
    def __init__(self, value):
        self.value = value


class G2PRegistryErrorCodes:
    REQUEST_VALIDATION_ERROR = _Code(("REQUEST_VALIDATION_ERROR", "REQ-VAL-001"))


class G2PRegistryException(Exception):
    def __init__(self, code=None, message=None):
        self.code = code
        self.message = message
        super().__init__(message)


class RegisterPurposeEnum:
    REGISTER = _Code("REGISTER")
    PROGRAM_REGISTER = _Code("PROGRAM_REGISTER")
    TABLE = _Code("TABLE")
    CORE_TABLE = _Code("CORE_TABLE")


def _package(name: str) -> ModuleType:
    module = ModuleType(name)
    module.__path__ = []  # type: ignore[attr-defined]
    sys.modules[name] = module
    return module


@pytest.fixture(scope="module")
def service_module():
    package_name = "_section_payload_test_core"
    created_modules = [
        package_name,
        f"{package_name}.services",
        f"{package_name}.services.g2p_document_service",
        f"{package_name}.errors",
        f"{package_name}.models",
        f"{package_name}.schemas",
        f"{package_name}.schemas.change_request",
        "openg2p_fastapi_common",
        "openg2p_fastapi_common.service",
    ]
    previous_modules = {name: sys.modules.get(name) for name in created_modules}

    _package(package_name)
    _package(f"{package_name}.services")
    document_service_module = _package(
        f"{package_name}.services.g2p_document_service"
    )

    class G2PDocumentService:
        validator = AsyncMock()

        @classmethod
        def get_component(cls):
            return SimpleNamespace(validate_documents_exist=cls.validator)

    document_service_module.G2PDocumentService = G2PDocumentService

    errors = _package(f"{package_name}.errors")
    errors.G2PRegistryErrorCodes = G2PRegistryErrorCodes
    errors.G2PRegistryException = G2PRegistryException

    models = _package(f"{package_name}.models")
    models.G2PRegisterDefinition = object
    models.G2PRegisterSection = object
    models.RegisterPurposeEnum = RegisterPurposeEnum

    _package(f"{package_name}.schemas")
    change_request = _package(f"{package_name}.schemas.change_request")
    change_request.ChangeActionEnum = SimpleNamespace(
        ADD=SimpleNamespace(value="ADD"),
    )
    change_request.ChangePayload = ChangePayload

    fastapi_common = _package("openg2p_fastapi_common")
    fastapi_service = _package("openg2p_fastapi_common.service")

    class BaseService:
        @classmethod
        def get_component(cls):
            return cls()

    fastapi_service.BaseService = BaseService
    fastapi_common.service = fastapi_service

    module_name = f"{package_name}.services.g2p_change_request_section_payload_service"
    spec = importlib.util.spec_from_file_location(module_name, _SERVICE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules[module_name] = module
    spec.loader.exec_module(module)

    yield module

    sys.modules.pop(module_name, None)
    for name, previous in previous_modules.items():
        if previous is None:
            sys.modules.pop(name, None)
        else:
            sys.modules[name] = previous


@pytest.fixture
def service(service_module):
    return service_module.G2PChangeRequestSectionPayloadService()


def _section(schema: object, section_id: str = "section-1"):
    return SimpleNamespace(
        section_id=section_id,
        section_register_id="register-1",
        section_ui_schema=schema,
        documents_required=False,
    )


def _definition(purpose: str = "REGISTER"):
    return SimpleNamespace(
        register_id="register-1",
        register_mnemonic="Test",
        register_purpose=purpose,
    )


def _schema(*widgets, editable: bool | None = None):
    schema = {
        "panels": [
            {
                "panel-id": "outer",
                "panels": [
                    {
                        "panel-id": "inner",
                        "widgets": list(widgets),
                    }
                ],
            }
        ]
    }
    if editable is not None:
        schema["section-editable"] = editable
    return schema


def test_resolves_normal_nested_object_table_and_dialog_fields(service):
    schema = _schema(
        {
            "widget": "text",
            "widget-data-path": "register-1.first_name",
        },
        {
            "widget": "text",
            "widget-data-path": "phone_numbers.0.number",
        },
        {
            "widget": "geo-hierarchy",
            "widget-data-path": {
                "value": "register-1.geo_lowest_level_value_id",
                "hierarchy": "register-1.geo_code_hierarchy_json",
            },
        },
        {
            "widget": "text",
            "widget-data-path": "foreign-register.functional_record_id",
        },
        {
            "widget": "text",
            "widget-readonly": True,
            "widget-data-path": "register-1.created_by",
        },
        {
            "widget": "select",
            "widget-data-path": "register-1.source_of_income",
            "widget-data-options": {
                "visible": {"field": "register-1.employed", "equals": True},
            },
        },
        {
            "widget": "header-section",
            "widget-data-path": {
                "image": "register-1.record_image_document_id",
                "imageUrl": "register-1.record_image_url",
            },
        },
        {
            "widget": "table",
            "widget-data-path": "register-1.records",
            "widget-data-columns": [
                {"column-key": "commodity"},
                {"column-key": "audit_note", "widget-readonly": True},
            ],
        },
        {
            "widget": "dialog-table",
            "widget-data-path": "register-1.records",
            "widget-data-columns": [{"column-key": "relationship_type"}],
        },
    )
    orm_fields = {
        "first_name",
        "phone_numbers",
        "geo_lowest_level_value_id",
        "geo_code_hierarchy_json",
        "functional_record_id",
        "created_by",
        "source_of_income",
        "record_image_document_id",
        "commodity",
        "audit_note",
        "relationship_type",
        "records",
    }

    assert service.resolve_allowed_fields(schema, "register-1", orm_fields) == {
        "first_name",
        "phone_numbers",
        "geo_lowest_level_value_id",
        "geo_code_hierarchy_json",
        "source_of_income",
        "record_image_document_id",
        "commodity",
        "relationship_type",
    }


@pytest.mark.asyncio
async def test_rejects_unknown_fields_with_aggregated_deterministic_details(service):
    service._resolve_orm_fields = AsyncMock(
        return_value={"first_name", "zebra", "alpha"}
    )
    payloads = [
        ChangePayload(edit_action="UPDATE", first_name="Ada", zebra=1),
        ChangePayload(edit_action="UPDATE", alpha=1),
    ]

    with pytest.raises(G2PRegistryException) as error:
        await service.validate(
            payloads,
            _section(
                _schema({"widget": "text", "widget-data-path": "register-1.first_name"})
            ),
            _definition(),
            AsyncMock(),
        )

    assert error.value.code == "REQ-VAL-001"
    assert error.value.message == (
        "Change payload contains fields not allowed by section 'section-1': "
        "row 0: zebra; row 1: alpha"
    )


@pytest.mark.asyncio
async def test_strips_non_orm_fields_from_valid_rows(service):
    service._resolve_orm_fields = AsyncMock(return_value={"first_name"})

    sanitized = await service.validate(
        [
            ChangePayload(
                edit_action="UPDATE",
                first_name="Ada",
                actual_score=40.0,
                ideal_score=100.0,
                completion_score_required=True,
            )
        ],
        _section(
            _schema(
                {
                    "widget": "text",
                    "widget-data-path": "register-1.first_name",
                }
            )
        ),
        _definition(),
        AsyncMock(),
    )
    assert sanitized[0].model_dump(exclude_unset=True) == {
        "edit_action": "UPDATE",
        "first_name": "Ada",
    }


@pytest.mark.asyncio
async def test_rejects_update_that_is_empty_after_non_orm_strip(service):
    service._resolve_orm_fields = AsyncMock(return_value={"first_name"})

    with pytest.raises(G2PRegistryException, match="no editable fields"):
        await service.validate(
            [
                ChangePayload(
                    edit_action="UPDATE",
                    actual_score=40.0,
                    ideal_score=100.0,
                )
            ],
            _section(
                _schema(
                    {
                        "widget": "text",
                        "widget-data-path": "register-1.first_name",
                    }
                )
            ),
            _definition(),
            AsyncMock(),
        )


@pytest.mark.asyncio
@pytest.mark.parametrize("purpose", ["TABLE", "CORE_TABLE"])
async def test_table_add_automatically_allows_parent_link(service, purpose):
    service._resolve_orm_fields = AsyncMock(
        return_value={"commodity", "link_internal_record_id"}
    )

    await service.validate(
        [
            ChangePayload(
                edit_action="ADD",
                commodity="WHEAT",
                link_internal_record_id="parent-1",
            )
        ],
        _section(
            _schema(
                {
                    "widget": "table",
                    "widget-data-path": "register-1.records",
                    "widget-data-columns": [{"column-key": "commodity"}],
                }
            )
        ),
        _definition(purpose),
        AsyncMock(),
    )


@pytest.mark.asyncio
async def test_update_allows_parent_link_without_schema_binding(service):
    service._resolve_orm_fields = AsyncMock(
        return_value={"name", "link_internal_record_id"}
    )
    section = _section(
        _schema({"widget": "text", "widget-data-path": "register-1.name"})
    )
    payload = ChangePayload(
        edit_action="UPDATE",
        internal_record_id="record-1",
        name="A",
        link_internal_record_id="parent-2",
    )

    await service.validate([payload], section, _definition("TABLE"), AsyncMock())


@pytest.mark.asyncio
async def test_lookup_update_allows_schema_bound_parent_link(service):
    service._resolve_orm_fields = AsyncMock(return_value={"link_internal_record_id"})

    await service.validate(
        [
            ChangePayload(
                edit_action="UPDATE",
                internal_record_id="record-1",
                link_internal_record_id="parent-2",
            )
        ],
        _section(
            _schema(
                {
                    "widget": "register-lookup",
                    "widget-data-path": "register-1.link_internal_record_id",
                }
            )
        ),
        _definition(),
        AsyncMock(),
    )


@pytest.mark.asyncio
async def test_delete_is_meaningful_and_no_change_row_is_removed(service):
    service._resolve_orm_fields = AsyncMock(return_value={"name"})
    section = _section(
        _schema({"widget": "text", "widget-data-path": "register-1.name"})
    )

    sanitized = await service.validate(
        [
            ChangePayload(edit_action="DELETE", internal_record_id="record-1"),
            ChangePayload(edit_action="NO_CHANGE", internal_record_id="record-2"),
        ],
        section,
        _definition("TABLE"),
        AsyncMock(),
    )
    assert [payload.edit_action for payload in sanitized] == ["DELETE"]


@pytest.mark.asyncio
async def test_rejects_payload_containing_only_no_change_rows(service):
    service._resolve_orm_fields = AsyncMock(return_value={"commodity"})

    with pytest.raises(G2PRegistryException, match="no meaningful changes"):
        await service.validate(
            [
                ChangePayload(
                    edit_action="NO_CHANGE",
                    internal_record_id="record-1",
                )
            ],
            _section(
                _schema(
                    {
                        "widget": "table",
                        "widget-data-columns": [{"column-key": "commodity"}],
                    }
                )
            ),
            _definition("TABLE"),
            AsyncMock(),
        )


@pytest.mark.asyncio
async def test_document_only_section_allows_populated_row_documents(
    service,
):
    service._resolve_orm_fields = AsyncMock(return_value={"internal_record_id"})
    section = _section(
        _schema(
            {
                "widget": "docs",
                "widget-type": "input",
                "widget-data-path": "register-1.documents",
                "documents": [
                    {
                        "document-key": "attachment_one",
                        "document-required": False,
                    }
                ],
            }
        )
    )

    await service.validate(
        [
            ChangePayload(
                edit_action="UPDATE",
                internal_record_id="record-1",
                documents=[
                    DocumentAttachment(
                        document_id="document-1",
                        label="attachment_one",
                    )
                ],
            )
        ],
        section,
        _definition(),
        AsyncMock(),
    )


@pytest.mark.asyncio
async def test_document_only_section_allows_explicit_empty_row_documents(service):
    service._resolve_orm_fields = AsyncMock(return_value={"internal_record_id"})
    section = _section(
        _schema(
            {
                "widget": "docs",
                "widget-data-path": "register-1.documents",
                "documents": [],
            }
        )
    )

    await service.validate(
        [
            ChangePayload(
                edit_action="UPDATE",
                internal_record_id="record-1",
                documents=[],
            )
        ],
        section,
        _definition(),
        AsyncMock(),
    )


@pytest.mark.asyncio
async def test_document_only_section_requires_explicit_row_documents(service):
    service._resolve_orm_fields = AsyncMock(return_value={"internal_record_id"})
    section = _section(
        _schema(
            {
                "widget": "docs",
                "widget-data-path": "register-1.documents",
            }
        )
    )

    with pytest.raises(
        G2PRegistryException,
        match="requires an explicit row-level documents list",
    ):
        await service.validate(
            [ChangePayload(edit_action="UPDATE", internal_record_id="record-1")],
            section,
            _definition(),
            AsyncMock(),
        )


@pytest.mark.asyncio
async def test_section_document_labels_are_not_checked_against_schema(service):
    service._resolve_orm_fields = AsyncMock(return_value={"internal_record_id"})
    section = _section(
        _schema(
            {
                "widget": "docs",
                "widget-data-path": "register-1.documents",
                "documents": [{"document-key": "attachment_one"}],
            }
        )
    )

    sanitized = await service.validate(
        [
            ChangePayload(
                edit_action="UPDATE",
                internal_record_id="record-1",
                documents=[
                    DocumentAttachment(
                        document_id="document-1",
                        label="Birth Certificate",
                    )
                ],
            )
        ],
        section,
        _definition(),
        AsyncMock(),
    )

    assert sanitized[0].documents[0].label == "Birth Certificate"


@pytest.mark.asyncio
async def test_document_only_section_allows_explicit_empty_when_slots_are_required(
    service,
):
    service._resolve_orm_fields = AsyncMock(return_value={"internal_record_id"})
    section = _section(
        _schema(
            {
                "widget": "docs",
                "widget-data-path": "register-1.documents",
                "documents": [
                    {
                        "document-key": "attachment_one",
                        "document-required": True,
                    }
                ],
            }
        )
    )

    sanitized = await service.validate(
        [
            ChangePayload(
                edit_action="UPDATE",
                internal_record_id="record-1",
                documents=[],
            )
        ],
        section,
        _definition(),
        AsyncMock(),
    )

    assert sanitized[0].documents == []


@pytest.mark.asyncio
async def test_section_document_ids_and_labels_must_be_unique(service):
    service._resolve_orm_fields = AsyncMock(return_value={"internal_record_id"})
    section = _section(
        _schema(
            {
                "widget": "docs",
                "widget-data-path": "register-1.documents",
                "documents": [
                    {"document-key": "attachment_one"},
                    {"document-key": "attachment_two"},
                ],
            }
        )
    )

    with pytest.raises(G2PRegistryException, match="duplicate document IDs"):
        await service.validate(
            [
                ChangePayload(
                    edit_action="UPDATE",
                    internal_record_id="record-1",
                    documents=[
                        DocumentAttachment(
                            document_id="document-1",
                            label="attachment_one",
                        ),
                        DocumentAttachment(
                            document_id="document-1",
                            label="attachment_two",
                        ),
                    ],
                )
            ],
            section,
            _definition(),
            AsyncMock(),
        )


@pytest.mark.asyncio
async def test_document_only_section_strips_non_orm_fields(service):
    service._resolve_orm_fields = AsyncMock(return_value={"internal_record_id"})
    section = _section(
        _schema(
            {
                "widget": "docs",
                "widget-data-path": "register-1.documents",
            }
        )
    )

    sanitized = await service.validate(
        [
            ChangePayload(
                edit_action="UPDATE",
                internal_record_id="record-1",
                documents=[],
                unexpected_field="value",
            )
        ],
        section,
        _definition(),
        AsyncMock(),
    )
    assert sanitized[0].model_dump(exclude_unset=True) == {
        "internal_record_id": "record-1",
        "edit_action": "UPDATE",
        "documents": [],
    }


@pytest.mark.asyncio
async def test_readonly_document_widget_does_not_enable_document_only_section(service):
    service._resolve_orm_fields = AsyncMock(return_value={"internal_record_id"})
    section = _section(
        _schema(
            {
                "widget": "docs",
                "widget-readonly": True,
                "widget-data-path": "register-1.documents",
            }
        )
    )

    with pytest.raises(
        G2PRegistryException,
        match="section_ui_schema has no editable persisted fields",
    ):
        await service.validate(
            [ChangePayload(edit_action="UPDATE", internal_record_id="record-1")],
            section,
            _definition(),
            AsyncMock(),
        )


@pytest.mark.asyncio
async def test_document_widget_does_not_hide_stale_editable_data_binding(service):
    service._resolve_orm_fields = AsyncMock(return_value={"internal_record_id"})
    section = _section(
        _schema(
            {
                "widget": "docs",
                "widget-data-path": "register-1.documents",
            },
            {
                "widget": "text",
                "widget-data-path": "register-1.removed_orm_field",
            },
        )
    )

    with pytest.raises(
        G2PRegistryException,
        match="section_ui_schema has no editable persisted fields",
    ):
        await service.validate(
            [ChangePayload(edit_action="UPDATE", internal_record_id="record-1")],
            section,
            _definition(),
            AsyncMock(),
        )


def _file_widget(
    widget_id: str,
    *,
    required: bool = False,
    register_id: str = "register-1",
) -> dict:
    return {
        "widget": "file",
        "widget-id": widget_id,
        "widget-type": "input",
        "widget-required": required,
        "widget-data-path": f"{register_id}.{widget_id}",
        "widget-data-options": {"accept": ".pdf", "maxSize": 5242880},
    }


@pytest.mark.asyncio
async def test_file_widget_document_only_section_accepts_nested_documents(
    service,
):
    service._resolve_orm_fields = AsyncMock(
        return_value={"internal_record_id", "national_id"}
    )
    schema = {
        "panels": [
            {
                "panel-id": "panel-1",
                "widgets": [
                    _file_widget("national_id", required=True),
                    _file_widget("birth_certificate", required=True),
                ],
            },
            {
                "panel-id": "panel-2",
                "widgets": [
                    _file_widget("proof_of_address"),
                    _file_widget("passport"),
                ],
            },
        ],
        "section-supporting-documents": [
            {
                "document-label": "cert1",
                "document-required": True,
                "document-data-path": (
                    "a0000000-0000-4000-8000-000000000001.birth_certificate"
                ),
            }
        ],
    }
    section = _section(schema)
    assert service.resolve_allowed_fields(
        schema, "register-1", {"internal_record_id", "national_id"}
    ) == set()

    with pytest.raises(G2PRegistryException, match="row 0: national_id"):
        await service.validate(
            [
                ChangePayload(
                    edit_action="UPDATE",
                    internal_record_id="record-1",
                    documents=[
                        DocumentAttachment(
                            document_id="document-1",
                            label="national_id",
                        ),
                        DocumentAttachment(
                            document_id="document-2",
                            label="birth_certificate",
                        ),
                    ],
                    national_id="not-a-domain-field",
                )
            ],
            section,
            _definition(),
            AsyncMock(),
        )

    sanitized = await service.validate(
        [
            ChangePayload(
                edit_action="UPDATE",
                internal_record_id="record-1",
                documents=[
                    DocumentAttachment(
                        document_id="document-1",
                        label="National ID",
                    ),
                    DocumentAttachment(
                        document_id="document-2",
                        label="Birth Certificate",
                    ),
                ],
            )
        ],
        section,
        _definition(),
        AsyncMock(),
    )

    assert sanitized[0].model_dump(exclude_unset=True) == {
        "internal_record_id": "record-1",
        "edit_action": "UPDATE",
        "documents": [
            {"document_id": "document-1", "label": "National ID"},
            {"document_id": "document-2", "label": "Birth Certificate"},
        ],
    }


@pytest.mark.asyncio
async def test_file_widget_allows_empty_documents_even_when_widgets_are_required(
    service,
):
    service._resolve_orm_fields = AsyncMock(return_value={"internal_record_id"})
    section = _section(
        _schema(
            _file_widget("national_id", required=True),
            _file_widget("proof_of_address"),
        )
    )

    sanitized = await service.validate(
        [
            ChangePayload(
                edit_action="UPDATE",
                internal_record_id="record-1",
                documents=[],
            )
        ],
        section,
        _definition(),
        AsyncMock(),
    )

    assert sanitized[0].documents == []


@pytest.mark.asyncio
async def test_file_widget_accepts_display_labels(service):
    service._resolve_orm_fields = AsyncMock(return_value={"internal_record_id"})
    section = _section(
        {
            **_schema(_file_widget("national_id")),
            "section-supporting-documents": [
                {"document-label": "cert1", "document-required": True}
            ],
        }
    )

    sanitized = await service.validate(
        [
            ChangePayload(
                edit_action="UPDATE",
                internal_record_id="record-1",
                documents=[
                    DocumentAttachment(
                        document_id="document-1",
                        label="National ID",
                    )
                ],
            )
        ],
        section,
        _definition(),
        AsyncMock(),
    )

    assert sanitized[0].documents[0].label == "National ID"


@pytest.mark.asyncio
async def test_file_widget_mixed_section_keeps_orm_fields_and_documents(service):
    service._resolve_orm_fields = AsyncMock(
        return_value={"internal_record_id", "first_name"}
    )
    section = _section(
        _schema(
            {"widget": "text", "widget-data-path": "register-1.first_name"},
            _file_widget("national_id"),
        )
    )

    sanitized = await service.validate(
        [
            ChangePayload(
                edit_action="UPDATE",
                internal_record_id="record-1",
                first_name="Ada",
                documents=[
                    DocumentAttachment(
                        document_id="document-1",
                        label="national_id",
                    )
                ],
            )
        ],
        section,
        _definition(),
        AsyncMock(),
    )

    dumped = sanitized[0].model_dump(exclude_unset=True)
    assert dumped["first_name"] == "Ada"
    assert dumped["documents"] == [
        {"document_id": "document-1", "label": "national_id"}
    ]


def test_allowlists_remain_specific_to_sections_sharing_a_register(service):
    orm_fields = {"first_name", "latitude"}
    personal_schema = _schema(
        {"widget": "text", "widget-data-path": "register-1.first_name"}
    )
    location_schema = _schema(
        {"widget": "number", "widget-data-path": "register-1.latitude"}
    )

    assert service.resolve_allowed_fields(
        personal_schema, "register-1", orm_fields
    ) == {"first_name"}
    assert service.resolve_allowed_fields(
        location_schema, "register-1", orm_fields
    ) == {"latitude"}


@pytest.mark.asyncio
async def test_literal_dotted_non_orm_key_is_stripped_then_rejected_as_empty(service):
    service._resolve_orm_fields = AsyncMock(return_value={"phone_numbers"})

    with pytest.raises(G2PRegistryException, match="no editable fields"):
        await service.validate(
            [
                ChangePayload.model_validate(
                    {
                        "edit_action": "UPDATE",
                        "phone_numbers.0.number": "123",
                    }
                )
            ],
            _section(
                _schema(
                    {
                        "widget": "text",
                        "widget-data-path": "register-1.phone_numbers.0.number",
                    }
                )
            ),
            _definition(),
            AsyncMock(),
        )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("bound_field", "live_field"),
    [
        ("primary_phone", "phone_numbers"),
        ("record_image_storage_id", "record_image_document_id"),
        ("num_of_male_members_in_the_family", "number_of_male_members"),
    ],
)
async def test_known_seed_or_template_drift_fails_closed(
    service,
    bound_field,
    live_field,
):
    service._resolve_orm_fields = AsyncMock(return_value={live_field})

    with pytest.raises(
        G2PRegistryException,
        match="section_ui_schema has no editable persisted fields",
    ):
        await service.validate(
            [ChangePayload(edit_action="UPDATE", **{bound_field: "value"})],
            _section(
                _schema(
                    {
                        "widget": "text",
                        "widget-data-path": f"register-1.{bound_field}",
                    }
                )
            ),
            _definition(),
            AsyncMock(),
        )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("schema", "message"),
    [
        (None, "section_ui_schema must be an object"),
        ({}, "section_ui_schema has no panels"),
        ({"panels": []}, "section_ui_schema has no panels"),
        (_schema(editable=False), "section is not editable"),
        (
            _schema({"widget": "scores-display", "widget-readonly": True}),
            "section_ui_schema has no editable persisted fields",
        ),
    ],
)
async def test_invalid_or_noneditable_schema_fails_closed(service, schema, message):
    service._resolve_orm_fields = AsyncMock(return_value={"first_name"})

    with pytest.raises(G2PRegistryException, match=message):
        await service.validate(
            [ChangePayload(edit_action="NO_CHANGE")],
            _section(schema),
            _definition(),
            AsyncMock(),
        )


@pytest.mark.asyncio
async def test_absent_section_editable_is_allowed(service):
    service._resolve_orm_fields = AsyncMock(return_value={"first_name"})

    await service.validate(
        [ChangePayload(edit_action="UPDATE", first_name="Ada")],
        _section(
            _schema(
                {"widget": "text", "widget-data-path": "register-1.first_name"},
            )
        ),
        _definition(),
        AsyncMock(),
    )


@pytest.mark.asyncio
async def test_model_resolution_uses_live_definition_and_mapped_columns(
    service,
    service_module,
    monkeypatch,
):
    base = declarative_base()

    class G2PRegisterTest(base):
        __tablename__ = "section_payload_test"
        internal_record_id = Column(String, primary_key=True)
        first_name = Column(String)

    live_definition = _definition()
    session = AsyncMock()
    session.get = AsyncMock(return_value=live_definition)
    monkeypatch.setattr(
        service_module.importlib,
        "import_module",
        lambda _name: SimpleNamespace(G2PRegisterTest=G2PRegisterTest),
    )

    fields = await service._resolve_orm_fields(
        _section(_schema()),
        live_definition,
        session,
    )

    assert fields == {"internal_record_id", "first_name"}
    session.get.assert_awaited_once()


@pytest.mark.asyncio
async def test_missing_model_class_becomes_configuration_error(
    service,
    service_module,
    monkeypatch,
):
    session = AsyncMock()
    session.get = AsyncMock(return_value=_definition())
    monkeypatch.setattr(
        service_module.importlib,
        "import_module",
        lambda _name: SimpleNamespace(),
    )

    with pytest.raises(G2PRegistryException, match="could not resolve the ORM model"):
        await service._resolve_orm_fields(
            _section(_schema()),
            _definition(),
            session,
        )


@pytest.mark.asyncio
async def test_missing_live_register_definition_becomes_configuration_error(service):
    session = AsyncMock()
    session.get = AsyncMock(return_value=None)

    with pytest.raises(
        G2PRegistryException, match="section register 'register-1' was not found"
    ):
        await service._resolve_orm_fields(
            _section(_schema()),
            _definition(),
            session,
        )


def _method_calls(path: Path, class_name: str, method_name: str) -> set[str]:
    module = ast.parse(path.read_text())
    for node in module.body:
        if isinstance(node, ast.ClassDef) and node.name == class_name:
            for item in node.body:
                if (
                    isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef))
                    and item.name == method_name
                ):
                    return {
                        call.func.attr
                        for call in ast.walk(item)
                        if isinstance(call, ast.Call)
                        and isinstance(call.func, ast.Attribute)
                    }
    raise AssertionError(f"{class_name}.{method_name} was not found in {path}")


def _call_keywords(
    path: Path,
    class_name: str,
    method_name: str,
    called_method_name: str,
) -> set[str]:
    module = ast.parse(path.read_text())
    for node in module.body:
        if isinstance(node, ast.ClassDef) and node.name == class_name:
            for item in node.body:
                if (
                    isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef))
                    and item.name == method_name
                ):
                    for call in ast.walk(item):
                        if (
                            isinstance(call, ast.Call)
                            and isinstance(call.func, ast.Attribute)
                            and call.func.attr == called_method_name
                        ):
                            return {
                                keyword.arg
                                for keyword in call.keywords
                                if keyword.arg is not None
                            }
    raise AssertionError(
        f"Call to {called_method_name} was not found in "
        f"{class_name}.{method_name} in {path}"
    )


def test_all_create_paths_inherit_shared_section_validation():
    register_validate_calls = _method_calls(
        _REGISTER_CR_SERVICE_PATH,
        "G2PRegisterChangeRequestService",
        "validate_change_request_creation",
    )
    register_create_calls = _method_calls(
        _REGISTER_CR_SERVICE_PATH,
        "G2PRegisterChangeRequestService",
        "create_change_request",
    )
    worker_create_calls = _method_calls(
        _WORKER_SERVICE_PATH,
        "G2PChangeRequestWorkerService",
        "create_change_request",
    )
    core_create_calls = _method_calls(
        _CORE_SERVICE_PATH,
        "G2PChangeRequestCoreService",
        "create_change_request_for_core_data",
    )

    assert "validate" in register_validate_calls
    assert "validate_change_request_creation" in register_create_calls
    assert "validate_change_request_creation" in worker_create_calls
    assert "create_change_request" in core_create_calls
    assert "has_documents" not in _call_keywords(
        _REGISTER_CR_SERVICE_PATH,
        "G2PRegisterChangeRequestService",
        "validate_change_request_creation",
        "validate",
    )


def test_change_request_reads_include_register_mnemonic_and_tab_label():
    for method_name in (
        "_fetch_change_request",
        "_fetch_change_requests",
        "_fetch_change_requests_flattened",
    ):
        calls = _method_calls(
            _REGISTER_CR_SERVICE_PATH,
            "G2PRegisterChangeRequestService",
            method_name,
        )
        assert "_resolve_register_mnemonic_and_tab_label" in calls, method_name
