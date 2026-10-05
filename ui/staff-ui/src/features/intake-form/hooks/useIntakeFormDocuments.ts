import { useFetch } from '@/shared/hooks/useFetch';
import type { UploadedDocument } from '@/features/shared/types/document';

export type IntakeFormDocument = UploadedDocument;

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
