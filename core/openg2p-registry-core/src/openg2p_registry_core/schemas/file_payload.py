from typing import List, Optional

from pydantic import BaseModel


class UploadedDocumentData(BaseModel):
    document_store_id: str
    document_label: str
    filename: str
    document_url: Optional[str] = None

    class Config:
        from_attributes: bool = True


class UploadDocumentsResponseData(BaseModel):
    uploaded_documents: List[UploadedDocumentData]


class UploadRecordImageData(BaseModel):
    document_store_id: str
    filename: str
    document_url: Optional[str] = None

    class Config:
        from_attributes: bool = True


class FileUrlData(BaseModel):
    file_url: Optional[str] = None


class DeleteFileData(BaseModel):
    document_store_id: str

    class Config:
        from_attributes: bool = True


class DocumentLabelData(BaseModel):
    document_label: str

    class Config:
        from_attributes: bool = True


class SectionDocumentData(BaseModel):
    document_label: str
    document_store_id: str
    document_url: Optional[str] = None

    class Config:
        from_attributes: bool = True


class SectionDocumentsData(BaseModel):
    register_id: str
    record_id: str
    section_id: str
    documents: List[SectionDocumentData]


class ChangeRequestDocumentsData(BaseModel):
    change_request_id: str
    documents: List[SectionDocumentData]


class GetDocumentLabelsForSectionRequestPayload(BaseModel):
    register_id: str
    section_id: str


class GetSectionDocumentsRequestPayload(BaseModel):
    register_id: str
    record_id: str
    section_id: str


class GetSectionDocumentsForChangeRequestRequestPayload(BaseModel):
    change_request_id: str


class FileUrlRequestPayload(BaseModel):
    document_store_id: str

    class Config:
        from_attributes: bool = True
