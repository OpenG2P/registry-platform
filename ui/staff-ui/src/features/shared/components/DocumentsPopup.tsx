'use client';

import Image from 'next/image';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DocumentRow, type DocumentItem } from './DocumentRow';

interface Props {
    documents: DocumentItem[];
    onClose: () => void;
}

export function DocumentsPopup({ documents, onClose }: Props) {
    const t = useTranslations();

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-first/50 p-4"
            onClick={onClose}
        >
            <div
                className="relative flex max-h-[min(80vh,calc(100svh-1.5rem))] w-full max-w-[min(520px,calc(100vw-1.5rem))] flex-col rounded-[10px] border border-primary-first bg-neutral-second p-4 shadow-lg sm:p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-4 right-4 text-secondary-third transition-colors hover:text-neutral-first/70"
                    aria-label={t('close')}
                >
                    <X size={22} strokeWidth={2} />
                </button>

                <div className="mb-4 flex min-w-0 items-center gap-2 pr-8">
                    <h2 className="min-w-0 truncate text-[18px] font-semibold text-neutral-first sm:text-[20px]" title={t('attached_documents')}>
                        {t('attached_documents')}
                    </h2>
                    <Image
                        src="/images/changerequest/attached_doc_icon.png"
                        alt={t('document_icon_alt')}
                        width={16}
                        height={16}
                    />
                    <span className="text-[14px] text-neutral-first/50">({documents.length})</span>
                </div>

                <div className="flex flex-col gap-2 overflow-y-auto pr-1">
                    {documents.map((doc) => (
                        <DocumentRow
                            key={doc.document_id || doc.label}
                            doc={doc}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
