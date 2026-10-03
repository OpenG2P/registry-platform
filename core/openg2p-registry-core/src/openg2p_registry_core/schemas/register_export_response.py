from typing import Optional

from openg2p_fastapi_common.schemas import G2PResponse, G2PResponseBody

from .register_export_payload import (
    ExportRegisterRecordsData,
    RegisterExportQueueData,
)


class ExportRegisterRecordsResponseBody(G2PResponseBody):
    response_payload: Optional[ExportRegisterRecordsData] = None


class ExportRegisterRecordsResponse(G2PResponse):
    response_body: Optional[ExportRegisterRecordsResponseBody] = None


class GetExportQueueRecordsResponseBody(G2PResponseBody):
    response_payload: Optional[list[RegisterExportQueueData]] = None


class GetExportQueueRecordsResponse(G2PResponse):
    response_body: Optional[GetExportQueueRecordsResponseBody] = None
