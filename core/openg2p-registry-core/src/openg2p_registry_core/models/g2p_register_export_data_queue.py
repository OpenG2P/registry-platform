import uuid
from datetime import datetime

from openg2p_fastapi_common.models import BaseORMModel
from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .enum import ExportFormatEnum, ExportSelectionModeEnum, ProcessStatusEnum


class G2PRegisterExportDataQueue(BaseORMModel):
    __tablename__ = "g2p_register_export_data_queue"

    export_id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    register_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    requested_by: Mapped[str] = mapped_column(String, nullable=False, index=True)
    queued_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, index=True
    )

    export_format: Mapped[ExportFormatEnum] = mapped_column(String, nullable=False)
    selection_mode: Mapped[ExportSelectionModeEnum] = mapped_column(
        String, nullable=False
    )
    selected_internal_record_ids: Mapped[list | None] = mapped_column(
        JSONB, nullable=True
    )
    search_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    filter_by: Mapped[dict | str | None] = mapped_column(JSONB, nullable=True)
    sort_by: Mapped[str | None] = mapped_column(String, nullable=True)

    policy_mnemonics: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    data_policies: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    batch_size: Mapped[int] = mapped_column(Integer, nullable=False, default=500)
    last_processed_offset: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    export_status: Mapped[ProcessStatusEnum] = mapped_column(
        String,
        nullable=False,
        default=ProcessStatusEnum.PENDING,
        index=True,
    )
    export_no_of_attempts: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    export_latest_timestamp: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )
    export_latest_error_code: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    file_object_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_presigned_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_url_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )
    total_records_exported: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
