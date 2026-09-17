import { useFetch } from '@/shared/hooks';
import type { UploadedDocument } from '@/features/shared/types/document';

export type ChangeRequestDocument = UploadedDocument;

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
