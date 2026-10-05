'use client';

import Image from "next/image";
import { useTranslations } from 'next-intl';
import { StackedCard } from '@/components/shared';
import { ChangeRequest } from "@/features/change-request/types";
import { DocumentRow } from '@/features/shared/components/DocumentRow';
import { useChangeRequestDocuments } from "../hooks/useChangeRequestDocuments";

interface Props {
    changeRequest: ChangeRequest;
    onViewDetails: () => void;
}

const statusClassMap: Record<string, string> = {
    REJECTED: "text-toast-failed",
    PENDING: "text-amber-500",
    APPROVED: "text-toast-success",
};

export default function ChangeRequestCard({
    changeRequest,
    onViewDetails,
}: Props) {
    const t = useTranslations();
    const { documents } = useChangeRequestDocuments(changeRequest.change_request_id);

    const translateKey = (value?: string | null) => {
        const trimmed = value?.trim();
        if (!trimmed) return '—';
        if (t.has(trimmed)) return t(trimmed);
        const lower = trimmed.toLowerCase();
        if (lower !== trimmed && t.has(lower)) return t(lower);
        return trimmed;
    };

    const formatEnum = (value?: string | null) => {
        const trimmed = value?.trim();
        if (!trimmed) return '—';
        if (t.has(trimmed)) return t(trimmed);
        const lower = trimmed.toLowerCase();
        if (lower !== trimmed && t.has(lower)) return t(lower);
        return trimmed.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    };

    return (
        <StackedCard
            title={changeRequest.record_name ?? ''}
            onViewDetails={onViewDetails}
            columns={[
                {
                    fields: [
                        { label: t('register'), value: translateKey(changeRequest.register_mnemonic) },
                        { label: t.has('tab') ? t('tab') : 'Tab', value: translateKey(changeRequest.tab_label) },
                        { label: t('section'), value: translateKey(changeRequest.section_mnemonic) },
                    ],
                },
                {
                    fields: [
                        { label: t('created_by'), value: changeRequest.created_by?.trim() || '—' },
                        {
                            label: t('created_at'),
                            value: new Date(changeRequest.created_at).toLocaleDateString(),
                        },
                        { label: t('source'), value: changeRequest.source_partner_id?.trim() || '—' },
                    ],
                },
                {
                    fields: [
                        {
                            label: t('approval_status'),
                            value: formatEnum(changeRequest.approval_status),
                            valueClassName:
                                statusClassMap[changeRequest.approval_status] ?? 'text-neutral-first/50',
                        },
                        { label: t('approved_by'), value: changeRequest.approved_by?.trim() || '—' },
                        {
                            label: t('approved_at'),
                            value: changeRequest.approved_at
                                ? new Date(changeRequest.approved_at).toLocaleString()
                                : '—',
                        },
                    ],
                },
                {
                    content: (
                        <>
                            <div className="flex items-center gap-1 leading-none">
                                <span className="text-[16px] font-medium text-neutral-first">
                                    {t('attached_documents')}
                                </span>
                                <Image
                                    src="/images/changerequest/attached_doc_icon.png"
                                    alt=""
                                    width={14}
                                    height={14}
                                    className="mb-0.5 ml-0.5"
                                />
                            </div>
                            <div className="flex flex-col gap-2 font-normal text-[16px] text-neutral-first/50">
                                {documents.slice(0, 3).map((doc, docIndex) => (
                                    <DocumentRow
                                        key={doc.presigned_url ?? docIndex}
                                        doc={doc}
                                    />
                                ))}
                                {Array.from({ length: Math.max(0, 3 - documents.length) }).map((_, idx) => (
                                    <span
                                        key={`placeholder-${idx}`}
                                        className="invisible flex items-center gap-2"
                                        aria-hidden
                                    >
                                        placeholder
                                    </span>
                                ))}
                            </div>
                        </>
                    ),
                },
            ]}
        />
    );
}
