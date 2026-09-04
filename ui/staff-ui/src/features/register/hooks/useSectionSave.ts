import { useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useFetch } from "@/shared/hooks/useFetch";
import { UploadedDocument } from "@/features/shared/types";
import { useRegister } from "@/context/RegisterContext";
import { useRegisterTabs } from "@/context/RegisterTabsContext";
import { SectionChanges } from "@openg2p/registry-widgets";
import { extractFilesFromSection, normalizeEditActions } from "../utils";
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
                const { section_id, section_register_id, records: sectionChangeRecords, files } = sectionChanges;


                if (!section_id && !section_register_id) {
                    console.error(
                        t("toast_section_info_missing"),
                        { section_id, section_register_id }
                    );
                    return;
                }

                const { filesToUpload,fileLabels } = extractFilesFromSection(files);

                let documentsResponse: UploadedDocument[] = [];
                let document_id: string | undefined;

                // Profile pictures of register records
                if (sectionChanges.image) {
                    const uploadResult = await uploadFile([sectionChanges.image]);
                    const uploaded = Array.isArray(uploadResult) ? uploadResult[0] : null;

                    if (uploaded) {
                        documentsResponse.push(uploaded);
                        document_id = uploaded.document_id;


                        toast.success(t("toast_profile_image_upload_success"), {
                            position: "top-right",
                            autoClose: 4000,
                        });
                    }
                }

                if (filesToUpload.length > 0) {
                    const uploadResult = await uploadFile(filesToUpload);
                    if (!uploadResult || uploadResult.length === 0) {
                        return;
                    }

                    documentsResponse.push(...uploadResult);

                    toast.success(t("toast_upload_success", { count: documentsResponse.length }), {
                        position: "top-right",
                        autoClose: 4000,
                    });
                }

                const records = normalizeEditActions(
                    sectionChangeRecords,
                    internalRecordId,
                    document_id
                )

                console.log("records", records);

                const section = tabSections?.find(
                    (section) => section.section_id === section_id
                );

                const endpoint = section?.is_core_section ? `/api/change-request/core-section/create` : `/api/change-request/create`;

                const abc = {
                    register_id: register_id,
                    register_mnemonic: register_mnemonic,
                    internal_record_id: internalRecordId,
                    section_register_id: section_register_id,
                    tab_id: activeTabId,
                    section_id: section_id,
                    section_records: records,
                    documents: documentsResponse.map((document, index) => ({
                        document_id: document.document_id,
                        label: fileLabels[index] || "unknown_label",
                    })),
                }

                const change_request_response = await submitChangeRequest(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(abc),
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
