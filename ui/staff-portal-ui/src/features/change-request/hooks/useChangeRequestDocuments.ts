import { useFetch } from '@/shared/hooks';

export interface ChangeRequestDocument {
    document_id: string;
    document_store_id: string;
    bucket: string;
    source_filename: string;
    created_by: string;
    created_at: string;
    presigned_url: string;
    document_url: string;
    section_id: string;
    label: string;
    document_label: string;
}

export function useChangeRequestDocuments(
    changeRequestId?: string,
    enabled = true
) {
    const { data, loading, error } = useFetch<{
        documents: ChangeRequestDocument[];
    }>({
        url: '/api/change-request/get-documents',
        enabled: enabled && !!changeRequestId,
        options: {
            method: 'POST',
            body: JSON.stringify({
                change_request_id: changeRequestId
            })
        },
    });
    return {
        documents: data?.documents ?? [],
        loading,
        error,
    };
}
