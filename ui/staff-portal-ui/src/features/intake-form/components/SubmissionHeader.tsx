'use client';

import Image from "next/image";
import { useTranslations } from "next-intl";
import { IntakeFormSubmission } from "../types/intake-form";
import { useMemo } from "react";
import { useIntakeFormDocuments } from "../hooks/useIntakeFormDocuments";
import { UploadedDocument } from "@/shared/types";

const statusClassMap: Record<string, string> = {
    REJECTED: "text-toast-failed",
    PENDING: "text-amber-500",
    APPROVED: "text-toast-success",
    DRAFT: "text-toast-info",
    SUBMITTED: "text-indigo-500",
    FINALIZED: "text-toast-success",
};

interface Props {
    submission?: IntakeFormSubmission | null;
    section_payloads?: any[] | null;
}

export default function SubmissionHeader({ submission, section_payloads }: Props) {
    const documents = useMemo(() => {
        const allDocs: UploadedDocument[] = [];
        section_payloads?.forEach(section => {
            if (section.documents) {
                allDocs.push(...section.documents);
            }
        });
        return allDocs;
    }, [section_payloads]);

    const { documents: docsWithUrls } = useIntakeFormDocuments(documents);

    return (
        <div className="rounded-[10px] bg-primary-first/20 px-10 py-5 flex flex-col border border-dashed border-primary-second">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <InfoSection submission={submission} />
                <VerificationStats documentsCount={documents.length} />
                <AttachedDocuments documents={docsWithUrls} />
            </div>
        </div>
    );
}

const InfoSection = ({ submission }: { submission?: IntakeFormSubmission | null }) => {
    const t = useTranslations();
    return (
        <div className="space-y-2 text-[16px] text-neutral-first/50">
            <h3 className="text-[24px] font-medium text-neutral-first truncate" title={t('intake_submission') || 'Intake Submission'}>
                {t('intake_submission')}
            </h3>
            <div className="flex w-full overflow-hidden">
                <span className="w-1/2 truncate" title={t('submission_id')}>{t('submission')}:</span>
                <span className="w-1/2 pl-4 text-neutral-first font-medium truncate" title={submission?.submission_id ? String(submission.submission_id) : ''}>
                    {submission?.submission_id}
                </span>
            </div>
            <div className="flex w-full overflow-hidden">
                <span className="w-1/2 truncate" title={t('draft_status')}>{t('draft_status')}:</span>
                <span className={`w-1/2 pl-4 font-medium truncate ${statusClassMap[submission?.draft_status || ''] ?? "text-neutral-first/50"}`} title={submission?.draft_status}>
                    {submission?.draft_status}
                </span>
            </div>
            <div className="flex w-full overflow-hidden">
                <span className="w-1/2 truncate" title={t('approval_status')}>{t('approval_status')}:</span>
                <span className={`w-1/2 pl-4 font-medium truncate ${statusClassMap[submission?.approval_status || ''] ?? "text-neutral-first/50"}`} title={submission?.approval_status}>
                    {submission?.approval_status}
                </span>
            </div>
            <div className="flex w-full overflow-hidden">
                <span className="w-1/2 truncate" title={t('created_by')}>{t('created_by')}:</span>
                <span className="w-1/2 pl-4 text-neutral-first font-medium truncate" title={submission?.created_by || '--'}>
                    {submission?.created_by || '--'}
                </span>
            </div>
            <div className="flex w-full overflow-hidden">
                <span className="w-1/2 truncate" title={t('register_ingest_process_status')}>{t('register_ingest_process_status')}:</span>
                <span className={`w-1/2 pl-4 font-medium truncate ${statusClassMap[submission?.register_ingest_process_status || ''] ?? "text-neutral-first/50"}`} title={submission?.register_ingest_process_status || '--'}>
                    {submission?.register_ingest_process_status || '--'}
                </span>
            </div>
        </div>
    );
};

const VerificationStats = ({ documentsCount }: { documentsCount: number }) => {
    const t = useTranslations();
    return (
        <div className="space-y-2 text-[16px] text-neutral-first/50">
            <h3 className="text-lg font-semibold text-neutral-first invisible">
                Verification
            </h3>

            <div className="border-l border-primary-first pl-6 space-y-2">
                <div className="flex w-full overflow-hidden">
                    <span className="w-1/2 truncate" title={t('documents_attached')}>{t('documents_attached')}:</span>
                    <span className="w-1/2 pl-4 text-neutral-first font-medium truncate" title={documentsCount.toString()}>
                        {documentsCount}
                    </span>
                </div>
            </div>
        </div>
    );
};

const AttachedDocuments = ({ documents = [] }: { documents?: any[] }) => {
    const t = useTranslations();

    const visibleDocs = documents.slice(0, 3);
    const placeholdersCount = Math.max(0, 3 - visibleDocs.length);

    return (
        <div className="space-y-2 text-[16px] text-neutral-first/50">
            <div className="pl-6 flex items-center leading-none mt-2">
                <span className="text-[16px] font-medium text-neutral-first">
                    {t('attached_documents')}
                </span>
                <Image
                    src="/images/changerequest/attached_doc_icon.png"
                    alt={t('document_icon_alt')}
                    width={14}
                    height={14}
                    className="ml-1 mb-1"
                />
            </div>

            <div className="border-l border-primary-first pl-6 flex flex-col gap-2 font-semibold min-h-15">
                {visibleDocs.map((doc, index) => (
                    <a
                        key={index}
                        href={doc.document_url ? doc.document_url : "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-2 ${doc.document_url
                            ? 'cursor-pointer hover:underline text-neutral-first'
                            : 'opacity-50 pointer-events-none'
                            }`}
                    >
                        {doc.document_label}
                        <Image src="/images/common/arrow_next_01.png" alt={t('arrow')} width={14} height={14} />
                    </a>
                ))}

                {Array.from({ length: placeholdersCount }).map((_, i) => (
                    <span key={i} className="invisible">placeholder</span>
                ))}
            </div>
        </div>
    );
};
