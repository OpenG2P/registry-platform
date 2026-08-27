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

    const title = details.record_name?.trim() || '—';

    const displayValue = (value?: string | null) => {
        const trimmed = value?.trim();
        if (!trimmed) return '—';
        return t.has(trimmed) ? t(trimmed) : trimmed;
    };

    const visibleDocs = documents.slice(0, VISIBLE_DOC_COUNT);
    const remainingCount = Math.max(0, documents.length - VISIBLE_DOC_COUNT);

    return (
        <div className="rounded-[10px] border border-dashed border-primary-second bg-primary-first/20 px-4 py-4 sm:px-6 md:px-10 md:py-5">
            {/* <h3
                className="mb-2 min-h-[32px] truncate text-[24px] font-medium text-neutral-first"
                title={title !== '—' ? title : undefined}
            >
                {title}
            </h3> */}

            <div className="grid grid-cols-1 items-stretch gap-y-4 text-[16px] text-neutral-first/50 sm:grid-cols-2 sm:gap-y-6 xl:grid-cols-4 xl:gap-y-0">
                <div className="flex h-full min-w-0 flex-col space-y-2 xl:pr-6">
                    <KeyValue
                        label={t('register')}
                        value={displayValue(details.register_mnemonic)}
                    />
                    <KeyValue
                        label={t.has('tab') ? t('tab') : 'Tab'}
                        value={displayValue(details.tab_label)}
                    />
                    <KeyValue
                        label={t('section')}
                        value={displayValue(details.section_mnemonic)}
                    />
                </div>

                <div className="flex h-full min-w-0 flex-col space-y-2 sm:border-l sm:border-primary-first sm:px-6">
                    <KeyValue
                        label={t('created_by')}
                        value={details.created_by?.trim() || '—'}
                    />
                    <KeyValue
                        label={t('created_at')}
                        value={
                            details.created_at
                                ? new Date(details.created_at).toLocaleDateString()
                                : '—'
                        }
                    />
                    <KeyValue
                        label={t('source')}
                        value={details.source_partner_id?.trim() || '—'}
                    />
                </div>

                <div className="flex h-full min-w-0 flex-col space-y-2 xl:border-l xl:border-primary-first xl:px-6">
                    <KeyValue
                        label={t('approval_status')}
                        value={details.approval_status}
                        valueClassName={
                            statusClassMap[details.approval_status] ?? 'text-neutral-first/50'
                        }
                    />
                    <KeyValue
                        label={t('approved_by')}
                        value={details.approved_by?.trim() || '—'}
                    />
                    <KeyValue
                        label={t('approved_at')}
                        value={
                            details.approved_at
                                ? new Date(details.approved_at).toLocaleString()
                                : '—'
                        }
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
