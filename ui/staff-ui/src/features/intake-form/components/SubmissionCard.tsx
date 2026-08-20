'use client';

import { useRouter } from '@/i18n/navigation';
import { StackedCard } from '@/components/shared';
import { IntakeFormSubmission } from '../types/intake-form';
import { useTranslations } from 'next-intl';

interface IntakeFormSubmissionCardProps {
    submission: IntakeFormSubmission;
    registerType: string;
}

const statusClassMap: Record<string, string> = {
    REJECTED: 'text-toast-failed',
    PENDING: 'text-amber-500',
    APPROVED: 'text-toast-success',
};

export function IntakeFormSubmissionCard({ submission, registerType }: IntakeFormSubmissionCardProps) {
    const t = useTranslations();
    const router = useRouter();

    const translateKey = (value?: string | null) => {
        const trimmed = value?.trim();
        if (!trimmed) return '—';
        if (t.has(trimmed)) return t(trimmed);
        const lower = trimmed.toLowerCase();
        if (lower !== trimmed && t.has(lower)) return t(lower);
        return trimmed;
    };

    const formatDate = (value?: string | null) => {
        if (!value) return '—';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
    };

    const formatDateTime = (value?: string | null) => {
        if (!value) return '—';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
    };

    const displayFields = [...(submission.display_fields ?? [])]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .slice(0, 4);

    return (
        <StackedCard
            title={submission.application_reference ?? ''}
            onViewDetails={() =>
                router.push(`/intake-form/${registerType}/submission/${submission.submission_id}`)
            }
            columns={[
                {
                    fields: [
                        { label: t('record_name'), value: translateKey(submission.record_name) },
                        { label: t('source'), value: translateKey(submission.submission_source) },
                        { label: t('form_status'), value: translateKey(submission.draft_status) },
                    ],
                },
                {
                    fields: [
                        { label: t('created_by'), value: translateKey(submission.created_by) },
                        { label: t('created_at'), value: formatDate(submission.first_created_at) },
                        { label: t('updated_at'), value: formatDateTime(submission.last_updated_at) },
                        { label: t('finalised_at'), value: formatDateTime(submission.finalized_at) },
                    ],
                },
                {
                    fields: [
                        {
                            label: t('approval_status'),
                            value: translateKey(submission.approval_status),
                            valueClassName:
                                statusClassMap[submission.approval_status] ?? 'text-neutral-first/50',
                        },
                        { label: t('approved_by'), value: translateKey(submission.approved_by) },
                        { label: t('approved_at'), value: formatDateTime(submission.approved_at) },
                    ],
                },
                {
                    fields: displayFields.map((field) => {
                        const rawValue = field.value == null ? '' : String(field.value);
                        return {
                            label: t.has(field.field_name) ? t(field.field_name) : field.field_name,
                            value: translateKey(rawValue),
                        };
                    }),
                },
            ]}
        />
    );
}
