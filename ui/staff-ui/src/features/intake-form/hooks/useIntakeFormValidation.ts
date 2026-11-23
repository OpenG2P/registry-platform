import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useFetch } from '@/shared/hooks/useFetch';

export interface IntakeSubmissionValidationIssue {
    code?: string;
    severity?: string;
    section_id?: string;
    section_register_id?: string;
    internal_record_id?: string;
    link_internal_record_id?: string;
    upstream_submission_id?: string;
    upstream_application_reference?: string;
    upstream_approval_status?: string;
    message?: string;
}

export interface IntakeSubmissionValidation {
    submission_id?: string;
    is_valid?: boolean;
    issues?: IntakeSubmissionValidationIssue[];
}

export function useIntakeFormValidation() {
    const t = useTranslations();
    const { execute, loading } = useFetch<IntakeSubmissionValidation>();

    const validateSubmission = useCallback(async (submissionId: string) => {
        const validation = await execute('/api/intake-form/validate-intake-form-submission', {
            method: 'POST',
            body: JSON.stringify({ submission_id: submissionId }),
        });

        if (!validation) return null;

        const issueText = (validation.issues ?? [])
            .map((issue) => {
                switch (issue.code) {
                    case 'PARENT_SUBMISSION_PENDING':
                        return t('parent_submission_pending');
                    case 'PARENT_SUBMISSION_REJECTED':
                        return t('parent_submission_rejected');
                    case 'PARENT_NOT_IN_LIVE_REGISTER':
                        return t('parent_not_in_live_register');
                    case 'PARENT_LINK_REQUIRED':
                        return t('parent_link_required');
                    case 'DOMAIN_VALIDATION_ERROR':
                        return t('domain_validation_error');
                    default:
                        return '';
                }
            })
            .filter(Boolean)
            .join('\n\n');

        return { ...validation, issueText };
    }, [execute, t]);

    return { validateSubmission, loading };
}
