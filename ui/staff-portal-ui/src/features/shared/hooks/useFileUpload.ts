'use client';

import { useState, useCallback } from 'react';
import { useFetch } from '@/shared/hooks';

export const useFileUpload = (bucket: string = 'documents') => {
    const { execute } = useFetch();
    const [uploading, setUploading] = useState(false);
    const [uploadedFileName, setUploadedFileName] = useState('');

    const uploadFile = useCallback(
        async (files: File[]) => {
            if (files.length === 0) return [];

            setUploading(true);
            try {
                const formData = new FormData();
                files.forEach(file => {
                    formData.append('documents', file);
                });
                formData.append('bucket', bucket);

                return await execute('/api/shared/upload-document', {
                    method: 'POST',
                    body: formData,
                });
            } finally {
                setUploading(false);
            }
        },
        [execute, bucket]
    );

    return {
        uploadFile,
        uploading,
        uploadedFileName,
        setUploadedFileName,
    };
};
