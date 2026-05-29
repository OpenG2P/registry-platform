from openg2p_fastapi_common.schemas import G2PRequest, G2PRequestBody

from .file_payload import (
    FileUrlRequestPayload,
    GetDocumentLabelsForSectionRequestPayload,
    GetSectionDocumentsForChangeRequestRequestPayload,
    GetSectionDocumentsRequestPayload,
)

class GetDocumentLabelsForSectionRequestBody(G2PRequestBody):
    request_payload: GetDocumentLabelsForSectionRequestPayload


class GetDocumentLabelsForSectionRequest(G2PRequest):
    request_body: GetDocumentLabelsForSectionRequestBody


class GetSectionDocumentsRequestBody(G2PRequestBody):
    request_payload: GetSectionDocumentsRequestPayload


class GetSectionDocumentsRequest(G2PRequest):
    request_body: GetSectionDocumentsRequestBody


class GetSectionDocumentsForChangeRequestRequestBody(G2PRequestBody):
    request_payload: GetSectionDocumentsForChangeRequestRequestPayload


class GetSectionDocumentsForChangeRequestRequest(G2PRequest):
    request_body: GetSectionDocumentsForChangeRequestRequestBody


class FileUrlRequestBody(G2PRequestBody):
    request_payload: FileUrlRequestPayload


class FileUrlRequest(G2PRequest):
    request_body: FileUrlRequestBody
