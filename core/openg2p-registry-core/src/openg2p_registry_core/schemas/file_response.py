from typing import Optional

from openg2p_fastapi_common.schemas import G2PResponse, G2PResponseBody

from .file_payload import (
    ChangeRequestDocumentsData,
    DeleteFileData,
    FileUrlData,
    SectionDocumentsData,
    UploadDocumentsResponseData,
    UploadRecordImageData,
)


class UploadDocumentsResponseBody(G2PResponseBody):
    response_payload: Optional[UploadDocumentsResponseData] = None


class UploadDocumentsResponse(G2PResponse):
    response_body: Optional[UploadDocumentsResponseBody] = None


class UploadRecordImageResponseBody(G2PResponseBody):
    response_payload: Optional[UploadRecordImageData] = None


class UploadRecordImageResponse(G2PResponse):
    response_body: Optional[UploadRecordImageResponseBody] = None


class FileUrlResponseBody(G2PResponseBody):
    response_payload: Optional[FileUrlData] = None


class FileUrlResponse(G2PResponse):
    response_body: Optional[FileUrlResponseBody] = None


class DeleteFileResponseBody(G2PResponseBody):
    response_payload: Optional[DeleteFileData] = None


class DeleteFileResponse(G2PResponse):
    response_body: Optional[DeleteFileResponseBody] = None


class SectionDocumentsResponseBody(G2PResponseBody):
    response_payload: Optional[SectionDocumentsData] = None


class SectionDocumentsResponse(G2PResponse):
    response_body: Optional[SectionDocumentsResponseBody] = None


class ChangeRequestDocumentsResponseBody(G2PResponseBody):
    response_payload: Optional[ChangeRequestDocumentsData] = None


class ChangeRequestDocumentsResponse(G2PResponse):
    response_body: Optional[ChangeRequestDocumentsResponseBody] = None
