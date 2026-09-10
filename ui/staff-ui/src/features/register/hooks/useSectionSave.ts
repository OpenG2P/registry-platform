import { useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useFetch } from "@/shared/hooks/useFetch";
import { UploadedDocument } from "@/features/shared/types";
import { useRegister } from "@/context/RegisterContext";
import { useRegisterTabs } from "@/context/RegisterTabsContext";
import { SectionChanges } from "@openg2p/registry-widgets";
import { matchUploadedDocuments, normalizeEditActions, extractFilesFromSection } from "../utils";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { useFileUpload } from "@/features/shared/hooks";

import { TabSection } from "@/features/register/types";

export const useSectionSave = (
    onChangeRequestCreated: () => void,
    tabSections?: TabSection[]
) => {
    const t = useTranslations();
    const { id } = useParams<{ type: string; id: string }>();
    const internalRecordId = id ? decodeURIComponent(id) : undefined;
    const { activeTabId } = useRegisterTabs();
    const { currentRegister } = useRegister();

    const { execute: submitChangeRequest } = useFetch();
    const { uploadFile } = useFileUpload();

    const isSubmitting = useRef(false);

    const handleSectionSave = useCallback(
        async (sectionChanges: SectionChanges) => {

            // prevent duplicate submission, when user click multiples time
            if (isSubmitting.current) return;

            if (!currentRegister || !internalRecordId) {
                return;
            }

            isSubmitting.current = true;
            try {

                const { register_id, register_mnemonic } = currentRegister;
                const {
                    section_id,
                    section_register_id,
                    records: sectionChangeRecords,
                    section_files,
                } = sectionChanges;


                if (!section_id && !section_register_id) {
                    console.error(
                        t("toast_section_info_missing"),
                        { section_id, section_register_id }
                    );
                    return;
                }

                const supportingExtracted = extractFilesFromSection(
                    section_files,
                    "_supporting_docs",
                );
                const directExtracted = extractFilesFromSection(
                    section_files,
                    '_direct_file',
                );
                const profileExtracted = extractFilesFromSection(
                    section_files,
                    '_profile',
                );

                const uploadGroup = async (files: File[]) => {
                    if (files.length === 0) {
                        return { documents: [] as UploadedDocument[], failed: false };
                    }

                    const uploadResult = await uploadFile(files);
                    if (!uploadResult || uploadResult.length === 0) {
                        return { documents: [] as UploadedDocument[], failed: true };
                    }

                    return { documents: uploadResult as UploadedDocument[], failed: false };
                };

                const supportingUpload = await uploadGroup(supportingExtracted.filesToUpload);
                const directUpload = await uploadGroup(directExtracted.filesToUpload);
                const profileUpload = await uploadGroup(profileExtracted.filesToUpload);

                if (supportingUpload.failed || directUpload.failed || profileUpload.failed) {
                    toast.error(t("file_upload_failed"), {
                        position: "top-right",
                        autoClose: 4000,
                    });
                    return;
                }

                const supportingMatched = matchUploadedDocuments(
                    supportingUpload.documents,
                    supportingExtracted,
                );
                const directMatched = matchUploadedDocuments(
                    directUpload.documents,
                    directExtracted,
                );
                const profileMatched = matchUploadedDocuments(
                    profileUpload.documents,
                    profileExtracted,
                );

                const uploadedCount =
                    supportingMatched.documents.length +
                    directMatched.documents.length +
                    profileMatched.documents.length;
                if (uploadedCount > 0) {
                    toast.success(t("toast_upload_success", { count: uploadedCount }), {
                        position: "top-right",
                        autoClose: 4000,
                    });
                }

                const supportingDocuments = [
                    ...supportingExtracted.existingDocuments.map((document) => ({
                        document_id: document.document_id,
                        label: document.label,
                    })),
                    ...supportingMatched.documents.map((document, index) => ({
                        document_id: document.document_id,
                        label: supportingMatched.fileLabels[index] || "unknown_label",
                    })),
                ];

                const directDocuments = [
                    ...directExtracted.existingDocuments.map((document) => ({
                        document_id: document.document_id,
                        label: document.label,
                        target: {
                            field: document.field,
                            document_key: document.document_key,
                            label: document.label,
                            tag: document.tag,
                        },
                    })),
                    ...directMatched.documents.map((document, index) => ({
                        document_id: document.document_id,
                        label: directMatched.fileLabels[index] || "unknown_label",
                        target: directMatched.fileTargets[index],
                    })),
                ];

                const profileDocumentId =
                    profileMatched.documents[0]?.document_id ??
                    profileExtracted.existingDocuments[0]?.document_id;
                

                const records = normalizeEditActions(
                    sectionChangeRecords,
                    internalRecordId,
                    profileDocumentId,
                ).map((record) => {
                    if (typeof record !== "object" || record === null) return record;
                    if (directDocuments.length === 0) return record;
                    return {
                        ...(record as Record<string, unknown>),
                        documents: directDocuments.map(({ document_id, label }) => ({
                            document_id,
                            label,
                        })),
                    };
                });

                const section = tabSections?.find(
                    (section) => section.section_id === section_id
                );

                const endpoint = section?.is_core_section ? `/api/change-request/core-section/create` : `/api/change-request/create`;

                const changeRequestPayload = {
                    register_id: register_id,
                    register_mnemonic: register_mnemonic,
                    internal_record_id: internalRecordId,
                    section_register_id: section_register_id,
                    tab_id: activeTabId,
                    section_id: section_id,
                    section_records: records,
                    documents: supportingDocuments,
                };

                const change_request_response = await submitChangeRequest(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(changeRequestPayload),
                });

                if (change_request_response?.change_request_id) {
                    toast.success(t("toast_cr_created"), {
                        position: "top-right",
                        autoClose: 6000,
                    });
                    // Update the Pending change request count
                    onChangeRequestCreated();
                }
            } finally {
                isSubmitting.current = false;
            }
        },[
            currentRegister,
            internalRecordId,
            submitChangeRequest,
            activeTabId,
            uploadFile,
            onChangeRequestCreated,
            t,
            tabSections,
        ]
    );

    return { handleSectionSave };
};
