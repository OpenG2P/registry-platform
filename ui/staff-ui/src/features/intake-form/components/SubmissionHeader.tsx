'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { KeyValue } from '@/components/ui/KeyValue';
import { DocumentRow } from '@/features/shared/components/DocumentRow';
import { DocumentsPopup } from '@/features/shared/components/DocumentsPopup';
import { IntakeFormSubmission } from '../types/intake-form';
import type { IntakeFormDocument } from '../hooks/useIntakeFormDocuments';

const statusClassMap: Record<string, string> = {
    REJECTED: 'text-toast-failed',
    PENDING: 'text-amber-500',
    APPROVED: 'text-toast-success',
};

const VISIBLE_DOC_COUNT = 3;

interface Props {
    submission: IntakeFormSubmission;
    documents?: IntakeFormDocument[];
}

export default function SubmissionHeader({ submission, documents = [] }: Props) {
    const t = useTranslations();
    const [showAll, setShowAll] = useState(false);

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

    const visibleDocs = documents.slice(0, VISIBLE_DOC_COUNT);
    const remainingCount = Math.max(0, documents.length - VISIBLE_DOC_COUNT);

    return (
        <div className="rounded-[10px] border border-dashed border-primary-second bg-primary-first/20 px-4 py-4 sm:px-6 md:px-10 md:py-5">
            <div className="grid grid-cols-1 items-stretch gap-y-4 text-[16px] text-neutral-first/50 sm:grid-cols-2 sm:gap-y-6 xl:grid-cols-4 xl:gap-y-0">
                <div className="flex h-full min-w-0 flex-col space-y-2 xl:pr-6">
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

                <div className="flex h-full min-w-0 flex-col space-y-2 sm:border-l sm:border-primary-first sm:px-6">
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

                <div className="flex h-full min-w-0 flex-col space-y-2 xl:border-l xl:border-primary-first xl:px-6">
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

                <div className="flex h-full min-w-0 flex-col space-y-2 sm:border-l sm:border-primary-first sm:pl-6">
                    <div className="flex items-center gap-1 leading-none">
                        <span className="text-[16px] font-medium text-neutral-first">
                            {t('attached_documents')}
                        </span>
                        <Image
                            src="/images/changerequest/attached_doc_icon.png"
                            alt={t('document_icon_alt')}
                            width={14}
                            height={14}
                        />
                    </div>
                    {documents.length === 0 ? (
                        <>
                            <span className="font-normal text-neutral-first/40">—</span>
                            <span className="invisible" aria-hidden>
                                —
                            </span>
                            <span className="invisible" aria-hidden>
                                —
                            </span>
                        </>
                    ) : (
                        <>
                            {visibleDocs.map((doc) => (
                                <DocumentRow
                                    key={doc.document_id || doc.document_store_id || doc.label}
                                    doc={doc}
                                />
                            ))}
                            {Array.from({
                                length: Math.max(0, VISIBLE_DOC_COUNT - visibleDocs.length),
                            }).map((_, i) => (
                                <span key={`ph-${i}`} className="invisible" aria-hidden>
                                    —
                                </span>
                            ))}
                        </>
                    )}
                    {remainingCount > 0 && (
                        <button
                            type="button"
                            onClick={() => setShowAll(true)}
                            className="text-left font-semibold text-primary-second hover:underline"
                        >
                            {t('view_more')} (+{remainingCount})
                        </button>
                    )}
                </div>
            </div>

            {showAll && (
                <DocumentsPopup documents={documents} onClose={() => setShowAll(false)} />
            )}
        </div>
    );
}
