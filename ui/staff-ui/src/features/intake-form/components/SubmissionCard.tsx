'use client';

import Image from 'next/image';
import { useRouter } from '@/i18n/navigation';
import { KeyValue } from '@/components/ui/KeyValue';
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

    const displayValue = (value?: string | null) => {
        const trimmed = value?.trim();
        if (!trimmed) return '—';
        return t.has(trimmed) ? t(trimmed) : trimmed;
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

    const heading = displayValue(submission.application_reference);

    return (
        <div className="rounded-[10px] bg-neutral-second px-10 py-5">
            <h3
                className="mb-4 min-w-0 text-[20px] font-semibold leading-snug tracking-tight text-neutral-first line-clamp-2 md:text-[22px]"
                title={heading !== '—' ? heading : undefined}
            >
                {heading}
            </h3>

            <div className="grid grid-cols-4 items-stretch gap-6 text-[16px] text-neutral-first/50">
                <div className="flex h-full min-h-0 flex-col">
                    <div className="flex flex-1 flex-col space-y-2">
                        <KeyValue
                            label={t('record_name')}
                            value={displayValue(submission.record_name)}
                        />
                        <KeyValue
                            label={t('source')}
                            value={displayValue(submission.submission_source)}
                        />
                        <KeyValue
                            label={t('form_status')}
                            value={displayValue(submission.draft_status)}
                        />
                    </div>
                </div>

                <div className="flex h-full min-h-0 flex-col">
                    <div className="flex flex-1 flex-col space-y-2 border-l-2 border-secondary-second pl-6">
                        <KeyValue
                            label={t('created_by')}
                            value={displayValue(submission.created_by)}
                        />
                        <KeyValue
                            label={t('created_at')}
                            value={formatDate(submission.first_created_at)}
                        />
                        <KeyValue
                            label={t('updated_at')}
                            value={formatDateTime(submission.last_updated_at)}
                        />
                        <KeyValue
                            label={t('finalised_at')}
                            value={formatDateTime(submission.finalized_at)}
                        />
                    </div>
                </div>

                <div className="flex h-full min-h-0 flex-col">
                    <div className="flex flex-1 flex-col space-y-2 border-l-2 border-secondary-second pl-6">
                        <KeyValue
                            label={t('approval_status')}
                            value={displayValue(submission.approval_status)}
                            valueClassName={
                                statusClassMap[submission.approval_status] ?? 'text-neutral-first/50'
                            }
                        />
                        <KeyValue
                            label={t('approved_by')}
                            value={displayValue(submission.approved_by)}
                        />
                        <KeyValue
                            label={t('approved_at')}
                            value={formatDateTime(submission.approved_at)}
                        />
                    </div>
                </div>

                <div className="flex h-full min-h-0 flex-col">
                    <div className="flex flex-1 flex-col space-y-2 border-l-2 border-secondary-second pl-6">
                        {displayFields.map((field) => {
                            const label = t.has(field.field_name) ? t(field.field_name) : field.field_name;
                            const rawValue = field.value == null ? '' : String(field.value);
                            return (
                                <KeyValue
                                    key={field.field_name}
                                    label={label}
                                    value={displayValue(rawValue)}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="my-4 border-t border-secondary-second" />

            <div className="flex items-center justify-between">
                <button
                    type="button"
                    onClick={() =>
                        router.push(`/intake-form/${registerType}/submission/${submission.submission_id}`)
                    }
                    className="flex items-center gap-2 text-[14px] font-normal text-neutral-first opacity-60 transition hover:opacity-100"
                >
                    {t('view_details')}
                    <Image
                        src="/images/common/arrow_next_01.png"
                        alt=""
                        width={14}
                        height={14}
                    />
                </button>
            </div>
        </div>
    );
}
