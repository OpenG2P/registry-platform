'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import { useDocuments } from '@/features/shared/hooks';

interface Props {
    documentId?: string;
    label?: string;
    className?: string;
}

export default function FileLink({
    documentId,
    label,
    className,
}: Props) {
    const t = useTranslations();
    const { getDocument } = useDocuments();
    const [displayLabel, setDisplayLabel] = useState(label || '');

    useEffect(() => {
        if (label) {
            setDisplayLabel(label);
            return;
        }

        if (!documentId) {
            setDisplayLabel('');
            return;
        }

        let cancelled = false;
        setDisplayLabel('');

        getDocument(documentId).then((document) => {
            if (cancelled) return;
            const fileName = document?.source_filename || document?.label || '';
            setDisplayLabel(fileName);
        });

        return () => {
            cancelled = true;
        };
    }, [documentId, label]);

    const handleClick = async (e: React.MouseEvent) => {
        e.stopPropagation();

        if (!documentId) return;

        const document = await getDocument(documentId);
        const url = document?.presigned_url;

        if (url) {
            window.open(url, '_blank');
        } else {
            toast.error('Failed to open file');
        }
    };


    return (
        <button
            onClick={handleClick}
            disabled={!documentId}
            className={`text-neutral-first hover:text-toast-info hover:underline transition-colors truncate disabled:opacity-50 ${className}`}
            title={displayLabel || ''}
        >
            {displayLabel || ''}
        </button>
    );
}
