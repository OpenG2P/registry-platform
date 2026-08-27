from pydantic import Field
from openg2p_fastapi_common.schemas import G2PRequest, G2PRequestBody

from .register_export_payload import ExportRegisterRecordsRequestPayload
from .register_payload import EmptyRequestPayload


class ExportRegisterRecordsRequestBody(G2PRequestBody):
    request_payload: ExportRegisterRecordsRequestPayload


class ExportRegisterRecordsRequest(G2PRequest):
    request_body: ExportRegisterRecordsRequestBody


class GetExportQueueRecordsRequestBody(G2PRequestBody):
    request_payload: EmptyRequestPayload = Field(
        default_factory=EmptyRequestPayload
    )


class GetExportQueueRecordsRequest(G2PRequest):
    request_body: GetExportQueueRecordsRequestBody
