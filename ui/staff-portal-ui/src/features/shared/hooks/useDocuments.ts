'use client';

import { useFetch } from '@/shared/hooks';
import { useCallback, useState } from 'react';

export type SharedDocument = {
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

export function useDocuments() {
    const { execute, loading, error } = useFetch<SharedDocument[]>();
    const [documents, setDocuments] = useState<SharedDocument[]>([]);

    const getDocuments = useCallback(async (documentIds: string[]) => {
        const ids = documentIds.filter(Boolean);
        if (ids.length === 0) {
            setDocuments([]);
            return [];
        }

        const result = await execute('/api/shared/get-documents', {
            method: 'POST',
            body: JSON.stringify({ document_ids: ids }),
        });

        const docs = Array.isArray(result) ? result : [];
        setDocuments(docs);
        return docs;
    }, [execute]);

    const getDocument = useCallback(async (documentId: string) => {
        if (!documentId) return null;
        const docs = await getDocuments([documentId]);
        return docs[0] ?? null;
    }, [getDocuments]);

    const getFileUrl = useCallback(async (documentId: string) => {
        const document = await getDocument(documentId);
        return document?.presigned_url ?? null;
    }, [getDocument]);

    return {
        documents,
        getDocuments,
        getDocument,
        getFileUrl,
        loading,
        error,
        setDocuments,
    };
}
