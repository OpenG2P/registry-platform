'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { KeyValue } from '@/components/ui/KeyValue';
import { DocumentRow } from '@/features/shared/components/DocumentRow';
import { DocumentsPopup } from '@/features/shared/components/DocumentsPopup';
import { UploadedDocument } from '@/features/shared/types';
import { ChangeRequest } from '../types/change-request';

const statusClassMap: Record<string, string> = {
    REJECTED: 'text-toast-failed',
    PENDING: 'text-amber-500',
    APPROVED: 'text-toast-success',
};

const VISIBLE_DOC_COUNT = 3;

interface Props {
    details: ChangeRequest;
    documents?: UploadedDocument[];
}

export default function ChangeRequestHeader({ details, documents = [] }: Props) {
    const t = useTranslations();
    const [showAll, setShowAll] = useState(false);

    const rawTitle = details?.section_mnemonic?.trim();
    const title = rawTitle ? t(rawTitle, { default: rawTitle }) : t('change_request');

    const visibleDocs = documents.slice(0, VISIBLE_DOC_COUNT);
    const remainingCount = Math.max(0, documents.length - VISIBLE_DOC_COUNT);

    return (
        <div className="rounded-[10px] border border-dashed border-primary-second bg-primary-first/20 px-10 py-5">
            {/* Title row */}
            <div className="mb-2 grid grid-cols-1 gap-y-2 md:grid-cols-3 md:gap-x-0">
                <h3
                    className="min-h-[32px] truncate text-[24px] font-medium text-neutral-first md:col-span-2 md:pr-6"
                    title={title}
                >
                    {title}
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
                    <KeyValue label={t('change_id')} value={details.change_request_id || '—'} />
                    <KeyValue
                        label={t('status')}
                        value={details.approval_status || '—'}
                        valueClassName={statusClassMap[details.approval_status] ?? 'text-neutral-first'}
                    />
                    <KeyValue
                        label={t('change_date')}
                        value={
                            details.created_at
                                ? new Date(details.created_at).toLocaleDateString()
                                : '—'
                        }
                    />
                </div>

                <div className="flex h-full flex-col space-y-2 md:border-l md:border-primary-first md:px-6">
                    <KeyValue label={t('created_by')} value={details.created_by || '—'} />
                    <KeyValue
                        label={t('register')}
                        value={details.register_mnemonic?.trim() || '—'}
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
                                <DocumentRow key={doc.document_id || doc.label} doc={doc} />
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

