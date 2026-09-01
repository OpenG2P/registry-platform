import { useCallback, useState } from 'react';
import { useFetch } from '@/shared/hooks/useFetch';
import type {
    ExportRegisterRecordsPayload,
    ExportRegisterRecordsResponse,
} from '../types';

export function useRegisterExport() {
    const { execute } = useFetch<ExportRegisterRecordsResponse>({ enabled: false });
    const [submitting, setSubmitting] = useState(false);

    const enqueue = useCallback(async (payload: ExportRegisterRecordsPayload) => {
        setSubmitting(true);
        try {
            return await execute('/api/register/export-register-records', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
        } finally {
            setSubmitting(false);
        }
    }, [execute]);

    return { enqueue, submitting };
}
