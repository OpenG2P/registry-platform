from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from ..models.enum import ExportFormatEnum, ProcessStatusEnum


class ExportRegisterRecordsRequestPayload(BaseModel):
    register_id: str = Field(min_length=1)
    export_format: ExportFormatEnum
    selected_internal_record_ids: list[str] | None = None


class ExportRegisterRecordsData(BaseModel):
    export_id: str
    status: ProcessStatusEnum


class RegisterExportQueueData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    export_id: str
    register_id: str
    export_status: ProcessStatusEnum
    queued_at: datetime
    export_latest_timestamp: datetime | None = None
    total_records_exported: int | None = None
    export_format: ExportFormatEnum
    file_presigned_url: str | None = None
    file_url_expires_at: datetime | None = None
    export_latest_error_code: str | None = None
