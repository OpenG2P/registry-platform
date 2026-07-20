export type UploadedDocument = {
    document_id: string;
    document_store_id: string;
    bucket: string;
    source_filename: string;
    created_by: string;
    created_at: string;
    presigned_url: string;
    section_id: string;
    label: string;
};
