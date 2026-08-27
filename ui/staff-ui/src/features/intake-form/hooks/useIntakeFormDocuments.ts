import { useFetch } from '@/shared/hooks/useFetch';

export interface IntakeFormDocument {
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

export function useIntakeFormDocuments(submissionId?: string | null) {
    const { data, loading, error } = useFetch<IntakeFormDocument[]>({
        url: '/api/intake-form/get-documents',
        enabled: !!submissionId,
        options: {
            method: 'POST',
            body: JSON.stringify({ submission_id: submissionId }),
        },
    });

    return {
        documents: data ?? [],
        loading,
        error,
    };
}
