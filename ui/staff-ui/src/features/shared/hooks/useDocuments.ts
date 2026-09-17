'use client';

import { useFetch } from '@/shared/hooks';
import { useCallback, useState } from 'react';
import type { UploadedDocument } from '../types/document';

export function useDocuments() {
    const { execute, loading, error } = useFetch<UploadedDocument[]>();
    const [documents, setDocuments] = useState<UploadedDocument[]>([]);

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
