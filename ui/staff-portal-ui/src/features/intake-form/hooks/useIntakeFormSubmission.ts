import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useFetch } from '@/shared/hooks/useFetch';
import { isRecordAccessDeniedError } from '@/shared/utils/isRecordAccessDeniedError';
import { IntakeFormSubmission } from '../types/intake-form';

export const useIntakeFormSubmission = (submissionId?: string) => {
    const router = useRouter();

    const { data, loading, error, execute } = useFetch<IntakeFormSubmission>({
        url: '/api/intake-form/get-intake-form-submission',
        options: {
            method: 'POST',
            body: JSON.stringify({
                submission_id: submissionId,
            }),
        },
        enabled: !!submissionId,
    });
    // Redirect to record access denied page if the record is access denied
    const isRecordAccessDenied = data != null && isRecordAccessDeniedError(data);

    useEffect(() => {
        if (isRecordAccessDenied) {
            router.replace('/record-access-denied');
        }
    }, [isRecordAccessDenied, router]);

    return {
        submission: isRecordAccessDenied ? null : data,
        section_payloads: isRecordAccessDenied ? undefined : data?.section_payloads,
        loading: loading || isRecordAccessDenied,
        error,
        execute,
    };
};