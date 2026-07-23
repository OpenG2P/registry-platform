'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { KeyValue } from '@/components/ui/KeyValue';
import { DocumentRow } from '@/features/shared/components/DocumentRow';
import { DocumentsPopup } from '@/features/shared/components/DocumentsPopup';
import { IntakeFormSubmission } from '../types/intake-form';
import { useIntakeFormDocuments } from '../hooks/useIntakeFormDocuments';

const statusClassMap: Record<string, string> = {
    REJECTED: 'text-toast-failed',
    PENDING: 'text-amber-500',
    APPROVED: 'text-toast-success',
    DRAFT: 'text-toast-info',
    FINAL: 'text-toast-success',
    SUBMITTED: 'text-indigo-500',
    FINALIZED: 'text-toast-success',
    FAILED: 'text-toast-failed',
    NOT_APPLICABLE: 'text-neutral-first/50',
};

const VISIBLE_DOC_COUNT = 3;

interface Props {
    submission?: IntakeFormSubmission | null;
}

export default function SubmissionHeader({ submission }: Props) {
    const t = useTranslations();
    const { documents, loading } = useIntakeFormDocuments(submission?.submission_id);
    const [showAll, setShowAll] = useState(false);

    if (loading && documents.length === 0) return null;

    const visibleDocs = documents.slice(0, VISIBLE_DOC_COUNT);
    const remainingCount = Math.max(0, documents.length - VISIBLE_DOC_COUNT);

    return (
        <div className="rounded-[10px] border border-dashed border-primary-second bg-primary-first/20 px-10 py-5">
            {/* Title row */}
            <div className="mb-2 grid grid-cols-1 gap-y-2 md:grid-cols-3 md:gap-x-0">
                <h3
                    className="min-h-[32px] truncate text-[24px] font-medium text-neutral-first md:col-span-2 md:pr-6"
                    title={t('intake_submission')}
                >
                    {t('intake_submission')}
                </h3>
                <div className="flex min-h-[32px] items-center gap-1 md:pl-6">
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
            </div>

            <div className="grid grid-cols-1 items-stretch gap-y-4 text-[16px] text-neutral-first/50 md:grid-cols-3 md:gap-y-0">
                <div className="flex h-full flex-col space-y-2 md:pr-6">
                    <KeyValue label={t('submission')} value={submission?.submission_id || '—'} />
                    <KeyValue
                        label={t('draft_status')}
                        value={submission?.draft_status || '—'}
                        valueClassName={statusClassMap[submission?.draft_status || ''] ?? 'text-neutral-first'}
                    />
                    <KeyValue
                        label={t('approval_status')}
                        value={submission?.approval_status || '—'}
                        valueClassName={statusClassMap[submission?.approval_status || ''] ?? 'text-neutral-first'}
                    />
                </div>

                <div className="flex h-full flex-col space-y-2 md:border-l md:border-primary-first md:px-6">
                    <KeyValue label={t('created_by')} value={submission?.created_by || '—'} />
                    <KeyValue
                        label={t('register_ingest_process_status')}
                        value={submission?.register_ingest_process_status || '—'}
                        valueClassName={
                            statusClassMap[submission?.register_ingest_process_status || ''] ??
                            'text-neutral-first'
                        }
                    />
                    <KeyValue label={t('documents_attached')} value={documents.length.toString()} />
                </div>

                <div className="flex h-full flex-col space-y-2 md:border-l md:border-primary-first md:pl-6">
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

