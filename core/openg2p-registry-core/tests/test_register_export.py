from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from io import BytesIO
from types import ModuleType, SimpleNamespace
from unittest.mock import MagicMock, patch
import sys

import pytest
from sqlalchemy import String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def _stub_iam_data_policy_helper():
    try:
        from iam_core.helpers.data_policy_helper import DataPolicyHelper  # noqa: F401
        return
    except ModuleNotFoundError:
        pass

    import iam_core

    helpers = sys.modules.get("iam_core.helpers") or ModuleType("iam_core.helpers")
    helpers.__path__ = []  # type: ignore[attr-defined]
    sys.modules["iam_core.helpers"] = helpers
    iam_core.helpers = helpers
    helper_mod = ModuleType("iam_core.helpers.data_policy_helper")

    class DataPolicyHelper:
        @staticmethod
        def resolve_register_record_policy(*_args, **_kwargs):
            return None

    helper_mod.DataPolicyHelper = DataPolicyHelper
    sys.modules["iam_core.helpers.data_policy_helper"] = helper_mod
    helpers.data_policy_helper = helper_mod


_stub_iam_data_policy_helper()

from openg2p_registry_core.helpers.document.minio_client import MinioClient
from openg2p_registry_core.helpers.register_export import (
    build_main_export_conditions,
    build_related_export_conditions,
    has_explicit_record_status_filter,
    resolve_register_export_hierarchy,
)
from openg2p_registry_core.models import (
    DocumentBucket,
    ExportFormatEnum,
    ExportSelectionModeEnum,
    ProcessStatusEnum,
)
from openg2p_registry_core.schemas import (
    ExportRegisterRecordsRequestPayload,
)
from openg2p_registry_core.services.g2p_register_export_service import (
    G2PRegisterExportService,
)
from openg2p_registry_core.errors import G2PRegistryException


def test_selected_records_export_payload_is_valid():
    payload = ExportRegisterRecordsRequestPayload(
        register_id="people",
        export_format=ExportFormatEnum.XLSX,
        selected_internal_record_ids=["one", "two"],
    )

    assert payload.selected_internal_record_ids == ["one", "two"]


def test_export_payload_without_selected_ids_is_valid():
    payload = ExportRegisterRecordsRequestPayload(
        register_id="people",
        export_format=ExportFormatEnum.ZIP_CSV,
    )

    assert payload.selected_internal_record_ids is None


@pytest.mark.parametrize(
    "filter_by,expected",
    [
        ({"record_status": "INACTIVE"}, True),
        ('{"record_status": "ACTIVE"}', True),
        ({"name": "Ada"}, False),
        ("not-json", False),
        (None, False),
    ],
)
def test_record_status_filter_detection(filter_by, expected):
    assert has_explicit_record_status_filter(filter_by) is expected


class _HierarchyBase(DeclarativeBase):
    pass


class _RelatedExportRecord(_HierarchyBase):
    __tablename__ = "test_related_export_record"

    internal_record_id: Mapped[str] = mapped_column(String, primary_key=True)
    record_status: Mapped[str] = mapped_column(String)


class _MainExportRecord(_HierarchyBase):
    __tablename__ = "test_main_export_record"

    internal_record_id: Mapped[str] = mapped_column(String, primary_key=True)
    search_text: Mapped[str] = mapped_column(String)
    record_status: Mapped[str] = mapped_column(String)


class _ScalarResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return self

    def all(self):
        return self._rows


class _HierarchySession:
    def __init__(self, registers):
        self.by_id = {register.register_id: register for register in registers}
        self.children = {}
        for register in registers:
            self.children.setdefault(register.master_register_id, []).append(
                register
            )

    def get(self, _model, register_id):
        return self.by_id.get(register_id)

    def execute(self, stmt):
        parent_id = _bound_value(stmt)
        children = list(self.children.get(parent_id, []))
        children.sort(key=lambda row: row.register_id)
        return _ScalarResult(children)


def _bound_value(stmt):
    criterion = getattr(stmt, "whereclause", None)
    if criterion is None:
        criterion = stmt._where_criteria[0]
    if hasattr(criterion, "clauses"):
        criterion = tuple(criterion.clauses)[0]
    right = criterion.right
    return getattr(right, "value", right)


def _register(register_id, mnemonic, master=None):
    return SimpleNamespace(
        register_id=register_id,
        register_mnemonic=mnemonic,
        master_register_id=master,
    )


def test_hierarchy_walks_ancestors_and_descendants():
    household = _register("household", "Household")
    person = _register("person", "Person", "household")
    disability = _register("disability", "Disability", "person")
    session = _HierarchySession([household, person, disability])

    hierarchy = resolve_register_export_hierarchy(session, "person")

    assert [row.register_id for row in hierarchy.ancestors] == ["household"]
    assert hierarchy.main.register_id == "person"
    assert [row.register_id for row in hierarchy.descendants] == ["disability"]
    assert [
        row.register_id for row in hierarchy.ordered_registers
    ] == ["household", "person", "disability"]


def test_hierarchy_detects_parent_cycles():
    first = _register("first", "First", "second")
    second = _register("second", "Second", "first")
    session = _HierarchySession([first, second])

    with pytest.raises(ValueError, match="Cycle detected"):
        resolve_register_export_hierarchy(session, "first")


def test_related_export_conditions_default_to_active_records():
    conditions = build_related_export_conditions(
        _register("person", "Person"),
        _RelatedExportRecord,
        None,
    )

    assert len(conditions) == 1
    compiled = str(conditions[0].compile(compile_kwargs={"literal_binds": True}))
    assert "ACTIVE" in compiled


def test_blank_search_text_omits_ilike():
    session = MagicMock()
    session.execute.return_value.scalar_one_or_none.return_value = None
    with patch(
        "openg2p_registry_core.services.filter_builder.FilterBuilder"
    ) as filter_builder:
        filter_builder.return_value.build_conditions.return_value = []
        conditions = build_main_export_conditions(
            session,
            _register("person", "Person"),
            _MainExportRecord,
            search_text=None,
            filter_by=None,
            data_policies=None,
        )

    compiled = [
        str(condition.compile(compile_kwargs={"literal_binds": True})).lower()
        for condition in conditions
    ]
    assert conditions
    assert not any("like" in sql for sql in compiled)


def test_whitespace_search_text_omits_ilike():
    session = MagicMock()
    session.execute.return_value.scalar_one_or_none.return_value = None
    with patch(
        "openg2p_registry_core.services.filter_builder.FilterBuilder"
    ) as filter_builder:
        filter_builder.return_value.build_conditions.return_value = []
        conditions = build_main_export_conditions(
            session,
            _register("person", "Person"),
            _MainExportRecord,
            search_text="   ",
            filter_by=None,
            data_policies=None,
        )

    compiled = [
        str(condition.compile(compile_kwargs={"literal_binds": True})).lower()
        for condition in conditions
    ]
    assert not any("like" in sql for sql in compiled)


def test_search_text_adds_ilike():
    session = MagicMock()
    session.execute.return_value.scalar_one_or_none.return_value = None
    with patch(
        "openg2p_registry_core.services.filter_builder.FilterBuilder"
    ) as filter_builder:
        filter_builder.return_value.build_conditions.return_value = []
        conditions = build_main_export_conditions(
            session,
            _register("person", "Person"),
            _MainExportRecord,
            search_text="Ada",
            filter_by=None,
            data_policies=None,
        )

    compiled = " ".join(
        str(condition.compile(compile_kwargs={"literal_binds": True})).lower()
        for condition in conditions
    )
    assert "like" in compiled
    assert "%ada%" in compiled


def test_named_minio_upload_keeps_caller_object_name():
    client = MinioClient.__new__(MinioClient)
    client.client = MagicMock()
    client.readonly_client = MagicMock()
    client.client.bucket_exists.return_value = True

    stored_name = client.upload(
        BytesIO(b"xlsx"),
        4,
        DocumentBucket.EXPORT_FILES,
        content_type="application/zip",
        object_name="register-exports/export-1.zip",
    )

    assert stored_name == "register-exports/export-1.zip"
    put_kwargs = client.client.put_object.call_args.kwargs
    assert put_kwargs["object_name"] == "register-exports/export-1.zip"
    assert put_kwargs["bucket_name"] == DocumentBucket.EXPORT_FILES
    assert put_kwargs["content_type"] == "application/zip"


class _FakeExportSession:
    def __init__(self, *, register_exists=True, items=None, count=None):
        self.register_exists = register_exists
        self.items = items or []
        self.count = count if count is not None else len(self.items)
        self.added = []

    async def scalar(self, _stmt):
        if self.items or self.count:
            return self.count
        return "people" if self.register_exists else None

    async def execute(self, _stmt):
        return _ScalarResult(self.items)

    def add(self, item):
        if not getattr(item, "export_id", None):
            item.export_id = "export-1"
        self.added.append(item)

    async def commit(self):
        return None

    async def refresh(self, _item):
        return None


def _patch_export_session(session):
    @asynccontextmanager
    async def session_cm():
        yield session

    return (
        patch(
            "openg2p_registry_core.services.g2p_register_export_service.dbengine"
        ),
        patch(
            "openg2p_registry_core.services.g2p_register_export_service.async_sessionmaker",
            return_value=lambda: session_cm(),
        ),
    )


@pytest.mark.asyncio
async def test_enqueue_export_snapshots_selected_ids_and_policies():
    session = _FakeExportSession()
    db_patch, maker_patch = _patch_export_session(session)
    with db_patch, maker_patch:
        result = await G2PRegisterExportService().enqueue_export(
            ExportRegisterRecordsRequestPayload(
                register_id="people",
                export_format=ExportFormatEnum.XLSX,
                selected_internal_record_ids=["two", "one", "two"],
            ),
            requested_by="user-1",
            policy_mnemonics=["DP_REGION"],
            data_policies=[{"mnemonic": "DP_REGION"}],
            batch_size=500,
        )

    queue_item = session.added[0]
    assert result.export_id == "export-1"
    assert result.status == ProcessStatusEnum.PENDING
    assert queue_item.selection_mode == ExportSelectionModeEnum.SELECTED.value
    assert queue_item.selected_internal_record_ids == ["two", "one"]
    assert queue_item.search_text is None
    assert queue_item.filter_by is None
    assert queue_item.sort_by is None
    assert queue_item.policy_mnemonics == ["DP_REGION"]
    assert queue_item.data_policies == [{"mnemonic": "DP_REGION"}]


@pytest.mark.asyncio
async def test_enqueue_export_snapshots_pagination_criteria():
    session = _FakeExportSession()
    db_patch, maker_patch = _patch_export_session(session)
    with db_patch, maker_patch:
        await G2PRegisterExportService().enqueue_export(
            ExportRegisterRecordsRequestPayload(
                register_id="people",
                export_format=ExportFormatEnum.ZIP_CSV,
            ),
            requested_by="user-1",
            policy_mnemonics=[],
            data_policies=[],
            batch_size=500,
            search_text="Ada",
            filter_by={"record_status": "ACTIVE"},
            sort_by="-last_approved_at",
        )

    queue_item = session.added[0]
    assert queue_item.selection_mode == ExportSelectionModeEnum.SEARCH_FILTER.value
    assert queue_item.selected_internal_record_ids is None
    assert queue_item.search_text == "Ada"
    assert queue_item.filter_by == {"record_status": "ACTIVE"}
    assert queue_item.sort_by == "-last_approved_at"


@pytest.mark.asyncio
async def test_enqueue_export_ignores_pagination_when_ids_are_selected():
    session = _FakeExportSession()
    db_patch, maker_patch = _patch_export_session(session)
    with db_patch, maker_patch:
        await G2PRegisterExportService().enqueue_export(
            ExportRegisterRecordsRequestPayload(
                register_id="people",
                export_format=ExportFormatEnum.XLSX,
                selected_internal_record_ids=["one"],
            ),
            requested_by="user-1",
            policy_mnemonics=[],
            data_policies=[],
            batch_size=500,
            search_text="Ada",
            filter_by={"name": "Ada"},
            sort_by="-last_approved_at",
        )

    queue_item = session.added[0]
    assert queue_item.selection_mode == ExportSelectionModeEnum.SELECTED.value
    assert queue_item.search_text is None
    assert queue_item.filter_by is None
    assert queue_item.sort_by is None


@pytest.mark.asyncio
async def test_enqueue_export_rejects_unknown_register():
    session = _FakeExportSession(register_exists=False)
    db_patch, maker_patch = _patch_export_session(session)
    with db_patch, maker_patch:
        with pytest.raises(G2PRegistryException):
            await G2PRegisterExportService().enqueue_export(
                ExportRegisterRecordsRequestPayload(
                    register_id="missing",
                    export_format=ExportFormatEnum.ZIP_CSV,
                ),
                requested_by="user-1",
                policy_mnemonics=[],
                data_policies=[],
                batch_size=500,
            )


@pytest.mark.asyncio
async def test_list_exports_hides_expired_and_incomplete_urls():
    now = datetime.now()
    visible = SimpleNamespace(
        export_id="done",
        register_id="people",
        export_status=ProcessStatusEnum.COMPLETED.value,
        queued_at=now,
        export_latest_timestamp=now,
        total_records_exported=2,
        export_format=ExportFormatEnum.XLSX.value,
        file_presigned_url="https://files.test/done.xlsx",
        file_url_expires_at=now + timedelta(hours=1),
        export_latest_error_code=None,
    )
    expired = SimpleNamespace(
        export_id="expired",
        register_id="people",
        export_status=ProcessStatusEnum.COMPLETED.value,
        queued_at=now,
        export_latest_timestamp=now,
        total_records_exported=1,
        export_format=ExportFormatEnum.XLSX.value,
        file_presigned_url="https://files.test/expired.xlsx",
        file_url_expires_at=now - timedelta(hours=1),
        export_latest_error_code=None,
    )
    pending = SimpleNamespace(
        export_id="pending",
        register_id="people",
        export_status=ProcessStatusEnum.PENDING.value,
        queued_at=now,
        export_latest_timestamp=None,
        total_records_exported=None,
        export_format=ExportFormatEnum.ZIP_CSV.value,
        file_presigned_url="https://files.test/pending.zip",
        file_url_expires_at=now + timedelta(hours=1),
        export_latest_error_code=None,
    )
    session = _FakeExportSession(items=[visible, expired, pending])
    db_patch, maker_patch = _patch_export_session(session)
    with db_patch, maker_patch:
        rows, total_items = await G2PRegisterExportService().get_exports_for_user(
            requested_by="user-1",
            current_page=1,
            page_size=20,
            visibility_days=2,
        )

    assert total_items == 3
    urls = {row.export_id: row.file_presigned_url for row in rows}
    assert urls["done"] == "https://files.test/done.xlsx"
    assert urls["expired"] is None
    assert urls["pending"] is None

