import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useFetch } from '@/shared/hooks/useFetch';
import { isRecordAccessDeniedError } from '@/shared/utils/isRecordAccessDeniedError';
import { IntakeFormSubmission } from '../types/intake-form';

export const useIntakeFormSubmission = (submissionId?: string) => {
    const router = useRouter();
    const [submission, setSubmission] = useState<IntakeFormSubmission | null>(null);
    const [loadingSubmission, setLoadingSubmission] = useState(!!submissionId);

    const fetchOptions = useMemo(
        () => ({
            method: 'POST' as const,
            body: JSON.stringify({
                submission_id: submissionId,
            }),
        }),
        [submissionId],
    );

    const { data, loading, error, execute } = useFetch<IntakeFormSubmission>({
        url: '/api/intake-form/get-intake-form-submission',
        options: fetchOptions,
        enabled: !!submissionId,
    });

    useEffect(() => {
        if (data && isRecordAccessDeniedError(data)) {
            router.replace('/record-access-denied');
            return;
        }
        if (data) setSubmission(data);
        setLoadingSubmission(loading);
    }, [data, loading, router]);

    const refetchSubmission = useCallback(async () => {
        if (!submissionId) return;
        const result = await execute('/api/intake-form/get-intake-form-submission', fetchOptions);
        if (!result) return;

        if (isRecordAccessDeniedError(result)) {
            router.replace('/record-access-denied');
            return;
        }

        const errorMessage =
            typeof result === 'object' && result !== null && 'error' in result
                ? (result as { error?: unknown }).error
                : undefined;
        if (typeof errorMessage === 'string' && errorMessage.trim()) return;

        if (typeof result === 'object' && result !== null && 'submission_id' in result) {
            setSubmission(result as IntakeFormSubmission);
        }
    }, [submissionId, execute, fetchOptions, router]);

    const isInitialLoading = !submission && loadingSubmission;

    return {
        submission,
        section_payloads: submission?.section_payloads,
        loading: submissionId ? isInitialLoading : false,
        error,
        refetchSubmission,
        execute: refetchSubmission,
    };
};
