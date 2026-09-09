from __future__ import annotations

import importlib.util
import sys
from enum import StrEnum
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from pydantic import BaseModel

_CORE_SRC = Path(__file__).resolve().parents[1] / "src" / "openg2p_registry_core"
_SERVICE_PATH = (
    _CORE_SRC / "services" / "g2p_section_document_reconcile_service.py"
)
_UTILS_PATH = _CORE_SRC / "services" / "change_request_payload_utils.py"


def _package(name: str) -> ModuleType:
    module = ModuleType(name)
    module.__path__ = []  # type: ignore[attr-defined]
    sys.modules[name] = module
    return module


class DocumentHistoryEventTypeEnum(StrEnum):
    ADD = "ADD"
    REMOVE = "REMOVE"


class _Model:
    internal_record_id = object()
    section_id = object()

    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)


class G2PRegisterSectionDocument(_Model):
    pass


class G2PRegisterDocumentHistory(_Model):
    pass


class DocumentAttachment(BaseModel):
    document_id: str
    label: str


@pytest.fixture(scope="module")
def reconcile_service_module():
    package_name = "_document_reconcile_test_core"
    created_modules = [
        package_name,
        f"{package_name}.services",
        f"{package_name}.models",
        f"{package_name}.schemas",
        f"{package_name}.schemas.file_payload",
        "openg2p_fastapi_common",
        "openg2p_fastapi_common.service",
    ]
    previous_modules = {name: sys.modules.get(name) for name in created_modules}

    _package(package_name)
    _package(f"{package_name}.services")
    models = _package(f"{package_name}.models")
    models.DocumentHistoryEventTypeEnum = DocumentHistoryEventTypeEnum
    models.G2PRegisterChangeRequest = object
    models.G2PRegisterDocumentHistory = G2PRegisterDocumentHistory
    models.G2PRegisterSectionDocument = G2PRegisterSectionDocument

    _package(f"{package_name}.schemas")
    file_payload = _package(f"{package_name}.schemas.file_payload")
    file_payload.DocumentAttachment = DocumentAttachment

    fastapi_common = _package("openg2p_fastapi_common")
    fastapi_service = _package("openg2p_fastapi_common.service")
    fastapi_service.BaseService = object
    fastapi_common.service = fastapi_service

    module_name = (
        f"{package_name}.services.g2p_section_document_reconcile_service"
    )
    spec = importlib.util.spec_from_file_location(module_name, _SERVICE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    module.select = lambda _model: SimpleNamespace(
        where=lambda *_args: object()
    )

    yield module

    sys.modules.pop(module_name, None)
    for name, previous in previous_modules.items():
        if previous is None:
            sys.modules.pop(name, None)
        else:
            sys.modules[name] = previous


def _session(existing_rows):
    result = MagicMock()
    result.scalars.return_value.all.return_value = existing_rows
    session = SimpleNamespace(
        execute=AsyncMock(return_value=result),
        add=MagicMock(),
        delete=AsyncMock(),
    )
    return session


def _change_request():
    return SimpleNamespace(
        change_request_id="cr-1",
        change_request_source="STAFF_PORTAL",
        created_by="creator",
        created_at="created",
        approved_by="approver",
        approved_at="approved",
    )


@pytest.mark.asyncio
async def test_exact_set_removes_missing_and_adds_new(reconcile_service_module):
    existing_one = G2PRegisterSectionDocument(
        document_id="doc-1", label="attachment_one"
    )
    existing_two = G2PRegisterSectionDocument(
        document_id="doc-2", label="attachment_two"
    )
    session = _session([existing_one, existing_two])
    service = reconcile_service_module.G2PSectionDocumentReconcileService()

    await service.reconcile(
        change_request=_change_request(),
        section_id="section-1",
        internal_record_id="record-1",
        desired_documents=[
            DocumentAttachment(
                document_id="doc-2", label="attachment_two"
            ),
            DocumentAttachment(
                document_id="doc-3", label="attachment_three"
            ),
        ],
        session=session,
    )

    session.delete.assert_awaited_once_with(existing_one)
    assert session.execute.await_count == 2
    added = [call.args[0] for call in session.add.call_args_list]
    live_adds = [
        row for row in added if isinstance(row, G2PRegisterSectionDocument)
    ]
    events = [
        row for row in added if isinstance(row, G2PRegisterDocumentHistory)
    ]
    assert [(row.document_id, row.label) for row in live_adds] == [
        ("doc-3", "attachment_three")
    ]
    assert [(row.document_id, row.event_type) for row in events] == [
        ("doc-1", "REMOVE"),
        ("doc-3", "ADD"),
    ]


@pytest.mark.asyncio
async def test_label_change_is_remove_then_add(reconcile_service_module):
    existing = G2PRegisterSectionDocument(
        document_id="doc-1", label="old_label"
    )
    session = _session([existing])
    service = reconcile_service_module.G2PSectionDocumentReconcileService()

    await service.reconcile(
        change_request=_change_request(),
        section_id="section-1",
        internal_record_id="record-1",
        desired_documents=[
            DocumentAttachment(document_id="doc-1", label="new_label")
        ],
        session=session,
    )

    assert existing.label == "new_label"
    events = [call.args[0] for call in session.add.call_args_list]
    assert [(row.label, row.event_type) for row in events] == [
        ("old_label", "REMOVE"),
        ("new_label", "ADD"),
    ]
    session.delete.assert_not_awaited()


def test_payload_serialization_preserves_document_intent():
    spec = importlib.util.spec_from_file_location(
        "_change_request_payload_utils",
        _UTILS_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)

    class Payload(BaseModel):
        edit_action: str = "UPDATE"
        documents: list[DocumentAttachment] | None = None

    omitted = module.change_payload_to_storage_dict(Payload())
    explicit_null = module.change_payload_to_storage_dict(
        Payload(documents=None)
    )
    explicit_empty = module.change_payload_to_storage_dict(
        Payload(documents=[])
    )

    assert "documents" not in omitted
    assert explicit_null["documents"] is None
    assert explicit_empty["documents"] == []
    assert "documents" not in module.domain_fields_from_change_payload(
        explicit_empty
    )
