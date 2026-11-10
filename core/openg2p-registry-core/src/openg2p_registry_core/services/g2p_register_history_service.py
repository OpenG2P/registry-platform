import enum
import importlib
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime

from openg2p_fastapi_common.service import BaseService
from sqlalchemy import Date as SQLDate, inspect, select

from ..errors import G2PRegistryErrorCodes, G2PRegistryException
from ..models import G2PRegisterChangeRequest, G2PRegisterChangeRequestPayload, G2PRegisterDefinition, RegisterPurposeEnum
from ..schemas.change_request import ChangeActionEnum, ChangePayload

_logger = logging.getLogger("g2p-register-history-service")

_DOMAIN_MODELS_MODULE = "openg2p_registry_extensions.register_domain.models"
_DOMAIN_SCHEMAS_MODULE = "openg2p_registry_extensions.register_domain.schemas"

# Columns describing the history entry itself rather than the record state.
HISTORY_META_COLUMNS = frozenset({
    "history_record_id",
    "internal_record_id",
    "subject_internal_record_id",
    "tab_id",
    "section_id",
    "change_request_id",
    "submission_id",
    "change_request_source",
    "is_primary_section",
    "created_by",
    "created_at",
    "approved_by",
    "approved_at",
})
# record_status is not nullable, so a delete row still carries the column default.
_BLANK_IGNORED_COLUMNS = HISTORY_META_COLUMNS | {"record_status"}


@dataclass
class SectionHistoryRead:
    records: list[dict]
    found: bool = False
    created_at: datetime | None = None
    created_by: str | None = None
    approved_at: datetime | None = None
    approved_by: str | None = None


class G2PRegisterHistoryService(BaseService):
    async def insert_into_register_history(self, change_request: G2PRegisterChangeRequest, session) -> None:
        """Copy the live record into history after the change has been applied.

        A delete leaves no live row, so that history row keeps bookkeeping columns only.
        The row still exists so the version stays in the date list.
        """
        models = await self._resolve_history_models(change_request, session)
        if models is None:
            return
        register_class, _register_schema_class, history_class = models

        change_payloads = await self._get_change_payloads(change_request, session)
        live_rows = await self._load_live_rows(register_class, change_request, change_payloads, session)

        for change_payload in change_payloads:
            action = change_payload.get("edit_action")
            if action == ChangeActionEnum.NO_CHANGE.value:
                continue
            record_id = self._payload_record_id(change_request, change_payload)
            if not record_id:
                _logger.warning(
                    "No record id to copy into history for change request %s",
                    change_request.change_request_id,
                )
                continue
            if action == ChangeActionEnum.DELETE.value:
                state = {}
            else:
                live_row = live_rows.get(record_id)
                if live_row is None:
                    _logger.warning(
                        "No live record %s to copy into history for change request %s",
                        record_id,
                        change_request.change_request_id,
                    )
                    continue
                state = self._state_from_live_row(live_row, history_class)
            self._create_history_record(
                change_payload=change_payload,
                change_request=change_request,
                history_class=history_class,
                session=session,
                state=state,
                record_id=record_id,
            )

    async def _resolve_history_models(self, change_request: G2PRegisterChangeRequest, session):
        return await self._models_for_section_register(
            change_request.section_register_id, session, required=True
        )

    async def _models_for_section_register(self, section_register_id: str, session, *, required: bool = False):
        register_definition: G2PRegisterDefinition = (
            await session.execute(
                select(G2PRegisterDefinition).where(
                    G2PRegisterDefinition.register_id == section_register_id
                )
            )
        ).scalar()
        if not register_definition:
            if not required:
                return None
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.REGISTER_NOT_FOUND.value[1],
                message=G2PRegistryErrorCodes.REGISTER_NOT_FOUND.value[0],
            )
        if register_definition.register_purpose == RegisterPurposeEnum.PROGRAM_REGISTER.value:
            return None
        return self._domain_classes(register_definition.register_mnemonic)

    def _domain_classes(self, register_mnemonic: str):
        model_module = importlib.import_module(_DOMAIN_MODELS_MODULE)
        schema_module = importlib.import_module(_DOMAIN_SCHEMAS_MODULE)
        return (
            getattr(model_module, f"G2PRegister{register_mnemonic}"),
            getattr(schema_module, f"G2PRegisterSchema{register_mnemonic}"),
            getattr(model_module, f"G2PRegisterHistory{register_mnemonic}"),
        )

    async def _get_change_payloads(self, change_request: G2PRegisterChangeRequest, session) -> list[dict]:
        payload = (
            await session.execute(
                select(G2PRegisterChangeRequestPayload).where(
                    G2PRegisterChangeRequestPayload.change_request_id == change_request.change_request_id
                )
            )
        ).scalar()
        return list(payload.change_payload or []) if payload else []

    def _payload_record_id(self, change_request: G2PRegisterChangeRequest, change_payload: dict) -> str | None:
        # Master register sections always target the subject record itself.
        if change_request.section_register_id == change_request.register_id:
            return change_request.internal_record_id
        return change_payload.get("internal_record_id")

    async def _load_live_rows(
        self,
        register_class,
        change_request: G2PRegisterChangeRequest,
        change_payloads: list[dict],
        session,
    ) -> dict[str, dict]:
        record_ids = {
            record_id
            for record_id in (self._payload_record_id(change_request, cp) for cp in change_payloads)
            if record_id
        }
        if not record_ids:
            return {}
        rows = (
            await session.execute(
                select(register_class).where(register_class.internal_record_id.in_(record_ids))
            )
        ).scalars().all()
        return {row.internal_record_id: self._row_to_dict(row) for row in rows}

    @staticmethod
    def _row_to_dict(row) -> dict:
        return {column.name: getattr(row, column.name, None) for column in inspect(row.__class__).columns}

    def _state_from_live_row(self, live_row: dict, history_class) -> dict:
        """Domain columns from the live record, after the change has been applied."""
        history_columns = inspect(history_class).columns
        state = {}
        for key, value in live_row.items():
            if key not in history_columns or key in HISTORY_META_COLUMNS:
                continue
            if value is None and not history_columns[key].nullable:
                continue
            state[key] = value
        return state

    def _has_domain_values(self, row) -> bool:
        """False for a delete row, which has bookkeeping columns and record_status only."""
        for column in inspect(row.__class__).columns:
            if column.name in _BLANK_IGNORED_COLUMNS:
                continue
            if getattr(row, column.name, None) is not None:
                return True
        return False

    def _latest_row_with_domain_values(self, rows):
        for row in rows:
            if self._has_domain_values(row):
                return row
        return None

    def _serialize_history_row(self, row) -> dict:
        record = {"internal_record_id": getattr(row, "internal_record_id", None)}
        for column in inspect(row.__class__).columns:
            if column.name in HISTORY_META_COLUMNS:
                continue
            value = getattr(row, column.name, None)
            if isinstance(value, enum.Enum):
                value = value.value
            elif hasattr(value, "isoformat"):
                value = value.isoformat()
            record[column.name] = value
        return record

    def _records_from_rows(self, rows) -> list[dict]:
        return [self._serialize_history_row(row) for row in rows if self._has_domain_values(row)]

    async def get_section_records_from_history(
        self,
        session,
        *,
        section_register_id: str,
        section_id: str | None = None,
        change_request_id: str | None = None,
        submission_id: str | None = None,
        before_approved_at=None,
        record_ids: list[str] | None = None,
    ) -> SectionHistoryRead:
        """History records for one section.

        ``before_approved_at`` returns the latest row with data before that time.
        ``change_request_id`` or ``submission_id`` returns that version, without blank delete rows.
        """
        models = await self._models_for_section_register(section_register_id, session)
        if models is None:
            return SectionHistoryRead()
        _register_class, _schema_class, history_class = models

        if before_approved_at is not None:
            records = []
            for record_id in record_ids or []:
                rows = (
                    await session.execute(
                        select(history_class).where(
                            history_class.internal_record_id == record_id,
                            history_class.section_id == section_id,
                            history_class.approved_at < before_approved_at,
                        ).order_by(history_class.approved_at.desc())
                    )
                ).scalars().all()
                row = self._latest_row_with_domain_values(rows)
                if row is None:
                    continue
                record = self._serialize_history_row(row)
                approved_at = getattr(row, "approved_at", None)
                if hasattr(approved_at, "isoformat"):
                    approved_at = approved_at.isoformat()
                record["last_approved_by"] = getattr(row, "approved_by", None)
                record["last_approved_at"] = approved_at
                records.append(record)
            return SectionHistoryRead(records=records, found=bool(records))

        filters = [history_class.section_id == section_id]
        if change_request_id:
            filters.append(history_class.change_request_id == change_request_id)
        elif submission_id:
            filters.append(history_class.submission_id == submission_id)
        else:
            return SectionHistoryRead()

        rows = (
            await session.execute(
                select(history_class).where(*filters).order_by(history_class.approved_at)
            )
        ).scalars().all()
        anchor = rows[0] if rows else None
        return SectionHistoryRead(
            records=self._records_from_rows(rows),
            found=bool(rows),
            created_at=getattr(anchor, "created_at", None) if anchor else None,
            created_by=getattr(anchor, "created_by", None) if anchor else None,
            approved_at=getattr(anchor, "approved_at", None) if anchor else None,
            approved_by=getattr(anchor, "approved_by", None) if anchor else None,
        )

    def _create_history_record(
        self,
        change_payload: ChangePayload,
        change_request: G2PRegisterChangeRequest,
        history_class,
        session,
        state: dict | None = None,
        record_id: str | None = None,
    ) -> None:
        history_dict = dict(state or {})
        history_dict["history_record_id"] = str(uuid.uuid4())
        history_dict["internal_record_id"] = (
            record_id
            or change_payload.get("internal_record_id")
            or self._payload_record_id(change_request, change_payload)
        )
        # Master subject for version-history discovery.
        if "subject_internal_record_id" in history_class.__table__.columns:
            history_dict["subject_internal_record_id"] = change_request.internal_record_id
        history_dict["tab_id"] = change_request.tab_id
        history_dict["section_id"] = change_request.section_id
        if "change_request_source" in history_class.__table__.columns:
            history_dict["change_request_source"] = change_request.change_request_source
        if "is_primary_section" in history_class.__table__.columns:
            history_dict["is_primary_section"] = getattr(change_request, "is_primary_section", False)
        history_dict["change_request_id"] = change_request.change_request_id
        history_dict["created_at"] = change_request.created_at
        history_dict["created_by"] = change_request.created_by
        history_dict["approved_at"] = change_request.approved_at
        history_dict["approved_by"] = change_request.approved_by

        history_dict = self._convert_date_strings_to_objects(history_dict, history_class)
        session.add(history_class(**history_dict))

    def _convert_date_strings_to_objects(self, data_dict: dict, model_class) -> dict:
        mapper = inspect(model_class)
        converted_dict = data_dict.copy()

        for key, value in converted_dict.items():
            if value is None or key not in mapper.columns:
                continue
            column = mapper.columns[key]
            if isinstance(column.type, SQLDate):
                if isinstance(value, str):
                    if not value.strip():
                        converted_dict[key] = None
                        continue
                    try:
                        converted_dict[key] = datetime.strptime(value, "%Y-%m-%d").date()
                    except (ValueError, TypeError):
                        _logger.debug("Leaving non-date string value unchanged for history field %s", key)
                elif isinstance(value, datetime):
                    converted_dict[key] = value.date()

        return converted_dict
