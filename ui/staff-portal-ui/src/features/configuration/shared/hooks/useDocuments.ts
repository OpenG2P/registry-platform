'use client';

import { useFetch } from '@/shared/hooks';
import { useCallback, useState } from 'react';

export type ConfigurationDocument = {
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

const GET_DOCUMENTS_PATH = '/api/configuration/shared/get-documents';

export function useDocuments() {
    const { execute, loading, error } = useFetch<ConfigurationDocument[]>();
    const [documents, setDocuments] = useState<ConfigurationDocument[]>([]);

    const getDocuments = useCallback(async (documentIds: string[]) => {
        const ids = documentIds.filter(Boolean);
        if (ids.length === 0) {
            setDocuments([]);
            return [];
        }

        const result = await execute(GET_DOCUMENTS_PATH, {
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
