import base64
import csv
import json
import logging
import os
import re
import tempfile
import zipfile
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from enum import Enum
from uuid import UUID

from openpyxl import Workbook
from sqlalchemy import inspect as sqlalchemy_inspect
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from openg2p_registry_core.helpers import get_document_handler
from openg2p_registry_core.helpers.register_export import (
    apply_register_export_sort,
    build_main_export_conditions,
    build_register_policy_condition,
    build_related_export_conditions,
    get_register_implementation_class,
    resolve_register_export_hierarchy,
)
from openg2p_registry_core.models import (
    DocumentBucket,
    ExportFormatEnum,
    ExportSelectionModeEnum,
    G2PRegisterExportDataQueue,
    ProcessStatusEnum,
)

from ..app import celery_app
from ..config import Settings
from ..engine import Engine

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)
_engine = Engine.get_engine()

_INVALID_SHEET_CHARS = re.compile(r"[\[\]:*?/\\]")
_INVALID_CELL_CHARS = re.compile(
    r"[\x00-\x08\x0B\x0C\x0E-\x1F]"
)
_SPREADSHEET_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


class RegisterExportWriter:
    def __init__(self, hierarchy, models_by_register_id, export_format):
        self.hierarchy = hierarchy
        self.models_by_register_id = models_by_register_id
        self.export_format = ExportFormatEnum(export_format)
        self._temp_dir = tempfile.TemporaryDirectory(
            prefix="openg2p-register-export-"
        )
        self._row_counts = {
            register.register_id: 0
            for register in hierarchy.ordered_registers
        }
        self._columns_by_register_id = {
            register.register_id: [
                column.key
                for column in sqlalchemy_inspect(
                    models_by_register_id[register.register_id]
                ).columns
            ]
            for register in hierarchy.ordered_registers
        }
        self._sheets = {}
        self._csv_files = {}
        self._csv_writers = {}

        if self.export_format == ExportFormatEnum.XLSX:
            self._workbook = Workbook(write_only=True)
            used_sheet_names: set[str] = set()
            for register in hierarchy.ordered_registers:
                sheet_name = self._unique_sheet_name(
                    register.register_mnemonic, used_sheet_names
                )
                worksheet = self._workbook.create_sheet(sheet_name)
                worksheet.append(
                    self._columns_by_register_id[register.register_id]
                )
                self._sheets[register.register_id] = worksheet
        else:
            self._workbook = None
            for register in hierarchy.ordered_registers:
                filename = self._safe_filename(
                    f"{register.register_mnemonic}-{register.register_id}"
                )
                path = os.path.join(self._temp_dir.name, f"{filename}.csv")
                csv_file = open(path, "w", encoding="utf-8", newline="")
                writer = csv.writer(csv_file)
                writer.writerow(
                    self._columns_by_register_id[register.register_id]
                )
                self._csv_files[register.register_id] = (path, csv_file)
                self._csv_writers[register.register_id] = writer

    def write_rows(self, register_id: str, rows: list) -> int:
        columns = self._columns_by_register_id[register_id]
        if (
            self.export_format == ExportFormatEnum.XLSX
            and self._row_counts[register_id] + len(rows) > 1_048_575
        ):
            raise ValueError(
                "XLSX row limit exceeded; request ZIP_CSV format instead"
            )

        for row in rows:
            values = [
                self._spreadsheet_value(getattr(row, column, None))
                for column in columns
            ]
            if self.export_format == ExportFormatEnum.XLSX:
                self._sheets[register_id].append(values)
            else:
                self._csv_writers[register_id].writerow(values)
        self._row_counts[register_id] += len(rows)
        return len(rows)

    def finalize(self) -> tuple[str, str, str]:
        if self.export_format == ExportFormatEnum.XLSX:
            output_path = os.path.join(
                self._temp_dir.name, "register-export.xlsx"
            )
            self._workbook.save(output_path)
            return (
                output_path,
                "xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )

        for _, csv_file in self._csv_files.values():
            csv_file.flush()
            csv_file.close()
        output_path = os.path.join(
            self._temp_dir.name, "register-export.zip"
        )
        with zipfile.ZipFile(
            output_path, "w", compression=zipfile.ZIP_DEFLATED
        ) as archive:
            for path, _ in self._csv_files.values():
                archive.write(path, arcname=os.path.basename(path))
        return output_path, "zip", "application/zip"

    def close(self):
        for _, csv_file in self._csv_files.values():
            if not csv_file.closed:
                csv_file.close()
        self._temp_dir.cleanup()

    @staticmethod
    def _safe_filename(value: str) -> str:
        safe_value = re.sub(r"[^A-Za-z0-9._-]+", "_", value).strip("._")
        return safe_value or "register"

    @staticmethod
    def _unique_sheet_name(value: str, used_names: set[str]) -> str:
        base_name = _INVALID_SHEET_CHARS.sub("_", value).strip("'") or "Register"
        base_name = base_name[:31]
        candidate = base_name
        suffix = 1
        while candidate.lower() in used_names:
            suffix_text = f"_{suffix}"
            candidate = f"{base_name[: 31 - len(suffix_text)]}{suffix_text}"
            suffix += 1
        used_names.add(candidate.lower())
        return candidate

    @staticmethod
    def _spreadsheet_value(value):
        if value is None:
            return ""
        if isinstance(value, Enum):
            value = value.value
        elif isinstance(value, (datetime, date, time)):
            value = value.isoformat()
        elif isinstance(value, (dict, list, tuple, set)):
            value = json.dumps(value, default=str, ensure_ascii=False)
        elif isinstance(value, bytes):
            value = base64.b64encode(value).decode("ascii")
        elif isinstance(value, (Decimal, UUID)):
            value = str(value)

        if isinstance(value, str):
            value = _INVALID_CELL_CHARS.sub("", value)
            if value.startswith(_SPREADSHEET_FORMULA_PREFIXES):
                value = f"'{value}"
        return value


def _load_main_batch(
    session,
    queue_item,
    hierarchy,
    implementation_class,
    offset: int,
    batch_size: int,
):
    if queue_item.selection_mode == ExportSelectionModeEnum.SELECTED.value:
        selected_ids = queue_item.selected_internal_record_ids or []
        batch_ids = selected_ids[offset : offset + batch_size]
        if not batch_ids:
            return [], False
        conditions = [
            implementation_class.internal_record_id.in_(batch_ids)
        ]
        policy_condition = build_register_policy_condition(
            hierarchy.main.register_id,
            implementation_class,
            queue_item.data_policies,
        )
        if policy_condition is not None:
            conditions.append(policy_condition)
        records = (
            session.execute(
                select(implementation_class).where(*conditions)
            )
            .scalars()
            .all()
        )
        records_by_id = {
            record.internal_record_id: record for record in records
        }
        ordered_records = [
            records_by_id[record_id]
            for record_id in batch_ids
            if record_id in records_by_id
        ]
        return ordered_records, offset + batch_size < len(selected_ids)

    conditions = build_main_export_conditions(
        session,
        hierarchy.main,
        implementation_class,
        search_text=queue_item.search_text,
        filter_by=queue_item.filter_by,
        data_policies=queue_item.data_policies,
    )
    query = apply_register_export_sort(
        select(implementation_class).where(*conditions),
        implementation_class,
        queue_item.sort_by,
    )
    records = (
        session.execute(query.offset(offset).limit(batch_size))
        .scalars()
        .all()
    )
    return records, len(records) == batch_size


def _load_related_rows(
    session,
    hierarchy,
    models_by_register_id: dict,
    main_rows: list,
    data_policies: list[dict] | None,
) -> dict[str, list]:
    rows_by_register_id = {
        register.register_id: []
        for register in hierarchy.ordered_registers
    }
    rows_by_register_id[hierarchy.main.register_id] = main_rows

    current_child_rows = main_rows
    for parent_definition in reversed(hierarchy.ancestors):
        parent_model = models_by_register_id[parent_definition.register_id]
        parent_ids = {
            row.link_internal_record_id
            for row in current_child_rows
            if getattr(row, "link_internal_record_id", None)
        }
        if not parent_ids:
            parent_rows = []
        else:
            conditions = [
                parent_model.internal_record_id.in_(parent_ids),
                *build_related_export_conditions(
                    parent_definition,
                    parent_model,
                    data_policies,
                ),
            ]
            parent_rows = (
                session.execute(
                    select(parent_model)
                    .where(*conditions)
                    .order_by(parent_model.internal_record_id)
                )
                .scalars()
                .all()
            )
        rows_by_register_id[parent_definition.register_id] = parent_rows
        current_child_rows = parent_rows

    pending_parents = [(hierarchy.main, main_rows)]
    while pending_parents:
        parent_definition, parent_rows = pending_parents.pop(0)
        parent_ids = {
            row.internal_record_id for row in parent_rows
        }
        for child_definition in hierarchy.children_by_parent.get(
            parent_definition.register_id, []
        ):
            child_model = models_by_register_id[child_definition.register_id]
            if not parent_ids:
                child_rows = []
            else:
                conditions = [
                    child_model.link_internal_record_id.in_(parent_ids),
                    *build_related_export_conditions(
                        child_definition,
                        child_model,
                        data_policies,
                    ),
                ]
                child_rows = (
                    session.execute(
                        select(child_model)
                        .where(*conditions)
                        .order_by(child_model.internal_record_id)
                    )
                    .scalars()
                    .all()
                )
            rows_by_register_id[child_definition.register_id] = child_rows
            pending_parents.append((child_definition, child_rows))

    return rows_by_register_id


def _upload_export_output(
    output_path: str,
    export_id: str,
    extension: str,
    content_type: str,
) -> tuple[str, str, datetime]:
    prefix = _config.export_files_prefix.strip("/")
    object_name = (
        f"{prefix}/{export_id}.{extension}"
        if prefix
        else f"{export_id}.{extension}"
    )
    expiry_seconds = max(1, _config.export_presigned_url_expiry_hours) * 3600
    document_handler = get_document_handler()
    with open(output_path, "rb") as export_file:
        stored_object_name = document_handler.upload(
            export_file,
            os.path.getsize(output_path),
            DocumentBucket.EXPORT_FILES,
            content_type=content_type,
            object_name=object_name,
        )
    presigned_url = document_handler.get_url(
        stored_object_name,
        DocumentBucket.EXPORT_FILES,
        expires=timedelta(seconds=expiry_seconds),
    )
    return (
        stored_object_name,
        presigned_url,
        datetime.now() + timedelta(seconds=expiry_seconds),
    )


def _remove_seen_rows(rows_by_register_id, seen_ids):
    unique_rows_by_register_id = {}
    for register_id, rows in rows_by_register_id.items():
        unique_rows = []
        for row in rows:
            internal_record_id = row.internal_record_id
            if internal_record_id in seen_ids[register_id]:
                continue
            seen_ids[register_id].add(internal_record_id)
            unique_rows.append(row)
        unique_rows_by_register_id[register_id] = unique_rows
    return unique_rows_by_register_id


def _process_export(session, queue_item):
    hierarchy = resolve_register_export_hierarchy(
        session, queue_item.register_id
    )
    models_by_register_id = {
        register.register_id: get_register_implementation_class(register)
        for register in hierarchy.ordered_registers
    }
    writer = RegisterExportWriter(
        hierarchy, models_by_register_id, queue_item.export_format
    )
    seen_ids = {
        register.register_id: set()
        for register in hierarchy.ordered_registers
    }
    total_records_exported = 0
    offset = 0
    batch_size = max(
        1, queue_item.batch_size or _config.export_batch_size
    )

    try:
        while True:
            main_rows, has_more = _load_main_batch(
                session,
                queue_item,
                hierarchy,
                models_by_register_id[hierarchy.main.register_id],
                offset,
                batch_size,
            )
            related_rows = _load_related_rows(
                session,
                hierarchy,
                models_by_register_id,
                main_rows,
                queue_item.data_policies,
            )
            unique_rows = _remove_seen_rows(related_rows, seen_ids)
            for register in hierarchy.ordered_registers:
                written = writer.write_rows(
                    register.register_id,
                    unique_rows[register.register_id],
                )
                if register.register_id == hierarchy.main.register_id:
                    total_records_exported += written

            offset += batch_size
            queue_item.last_processed_offset = offset
            session.add(queue_item)
            session.commit()
            if not has_more:
                break

        output_path, extension, content_type = writer.finalize()
        stored_object_name, presigned_url, url_expires_at = (
            _upload_export_output(
                output_path,
                queue_item.export_id,
                extension,
                content_type,
            )
        )
        return (
            stored_object_name,
            presigned_url,
            url_expires_at,
            total_records_exported,
        )
    finally:
        writer.close()


@celery_app.task(name="register_export_worker")
def register_export_worker(export_id: str):
    session_maker = sessionmaker(bind=_engine, expire_on_commit=False)
    with session_maker() as session:
        queue_item = session.get(G2PRegisterExportDataQueue, export_id)
        if queue_item is None:
            _logger.error("Register export queue item %s not found", export_id)
            return
        if queue_item.export_status == ProcessStatusEnum.COMPLETED.value:
            return
        if (
            queue_item.export_no_of_attempts
            >= _config.export_worker_max_attempts
        ):
            queue_item.export_status = ProcessStatusEnum.FAILED.value
            queue_item.export_latest_timestamp = datetime.now()
            session.commit()
            return

        queue_item.export_no_of_attempts += 1
        queue_item.export_status = ProcessStatusEnum.PROCESSING.value
        queue_item.export_latest_timestamp = datetime.now()
        queue_item.export_latest_error_code = None
        queue_item.last_processed_offset = 0
        session.commit()

        try:
            (
                object_name,
                presigned_url,
                url_expires_at,
                total_records_exported,
            ) = _process_export(session, queue_item)
            queue_item.file_object_name = object_name
            queue_item.file_presigned_url = presigned_url
            queue_item.file_url_expires_at = url_expires_at
            queue_item.total_records_exported = total_records_exported
            queue_item.export_status = ProcessStatusEnum.COMPLETED.value
            queue_item.export_latest_timestamp = datetime.now()
            session.commit()
        except Exception as exc:
            session.rollback()
            queue_item = session.get(G2PRegisterExportDataQueue, export_id)
            queue_item.export_latest_error_code = str(exc)[:4000]
            queue_item.export_latest_timestamp = datetime.now()
            queue_item.last_processed_offset = 0
            queue_item.export_status = (
                ProcessStatusEnum.FAILED.value
                if queue_item.export_no_of_attempts
                >= _config.export_worker_max_attempts
                else ProcessStatusEnum.PENDING.value
            )
            session.commit()
            _logger.exception(
                "Register export %s failed on attempt %s",
                export_id,
                queue_item.export_no_of_attempts,
            )
