import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFetch } from '@/shared/hooks/useFetch';
import { toast } from 'react-toastify';
import { IntakeFormSection } from '../types/intake-form';
import ActionModal from '@/components/shared/ActionModal';
import type { SectionChanges } from '@openg2p/registry-widgets';
import { extractFilesFromSection, intakeNormalisedRecords } from '@/features/register/utils';
import { UploadedDocument } from '@/features/shared/types';
import { useTranslations } from 'next-intl';
import { useFileUpload } from '@/features/shared/hooks';
import { SectionPayload } from '../types/intake-form';

interface UseIntakeFormSectionActionProps {
    registerId?: string;
    formId: string;
    registerType: string;
    section?: IntakeFormSection | null;
    submissionId?: string | null;
    initialRecordName?: string | null;
    initialSectionPayloads?: SectionPayload[] | null;
    onSuccess?: () => void;
}

export const useIntakeFormSectionAction = ({
    registerId,
    formId,
    registerType,
    section,
    submissionId = null,
    initialRecordName = null,
    initialSectionPayloads = null,
    onSuccess
}: UseIntakeFormSectionActionProps) => {
    const t = useTranslations();
    const router = useRouter();
    const { execute: executeSave } = useFetch();
    const { uploadFile } = useFileUpload();

    const [activeSubmissionId, setActiveSubmissionId] = useState<string | null>(submissionId);
    const [sectionInternalIds, setSectionInternalIds] = useState<Record<string, string>>({});
    const [listSectionRecordIds, setListSectionRecordIds] = useState<Record<string, string[]>>({});
    const [recordName, setRecordName] = useState<string | null>(initialRecordName);
    const [applicationReference, setApplicationReference] = useState<string | null>(null);

    useEffect(() => {
        setActiveSubmissionId(submissionId);
    }, [submissionId]);

    useEffect(() => {
        setRecordName(initialRecordName ?? null);
    }, [initialRecordName]);

    
    useEffect(() => {
        if (!initialSectionPayloads?.length) return;
        const newSectionIds: Record<string, string> = {};
        const newListIds: Record<string, string[]> = {};
        for (const payload of initialSectionPayloads) {
            if (!payload.records?.length) continue;
            if (payload.is_list) {
                const ids = payload.records
                    .map((r: any) => r.internal_record_id)
                    .filter(Boolean);
                if (ids.length) newListIds[payload.section_register_id] = ids;
            } else {
                const id = payload.records[0]?.internal_record_id;
                if (id) newSectionIds[payload.section_register_id] = id;
            }
        }
        setSectionInternalIds(prev => ({ ...prev, ...newSectionIds }));
        setListSectionRecordIds(prev => ({ ...prev, ...newListIds }));
    }, [initialSectionPayloads]);

    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        type: 'warning' | 'success';
        title: string;
        subtitle: string;
        onConfirm?: () => void;
        onClose: () => void;
        confirmText?: string;
        cancelText?: string;
        hideCancel?: boolean;
    } | null>(null);

    const closeModal = () => {
        setModalConfig(null);
    };

    const performFinalize = async () => {
        const targetSubmissionId = activeSubmissionId || submissionId;
        if (!targetSubmissionId || !registerId) return;

        const saveResult = await executeSave('/api/intake-form/finalize-intake-form-submission', {
            method: 'POST',
            body: JSON.stringify({
                submission_id: targetSubmissionId,
                register_id: registerId,
                form_id: formId,
            })
        });

        if (!saveResult) {
            return;
        }

        const handleSuccessClose = () => {
            closeModal();
            router.push(`/intake-form/${registerType}`);
            if (onSuccess) onSuccess();
        };

        setModalConfig({
            isOpen: true,
            type: 'success',
            title: t('submitted_successfully'),
            subtitle: t('submitted_successfully_subtitle'),
            confirmText: t('close'),
            hideCancel: true,
            onClose: handleSuccessClose,
            onConfirm: handleSuccessClose
        });
    };

    const performSave = async (change: SectionChanges, action: 'submit' | 'save', actionSection?: IntakeFormSection): Promise<boolean> => {
        const activeSection = actionSection || section;
        if (!activeSection || !registerId) return false;


        const files = change?.files ?? [];
        const { filesToUpload = [],fileLabels } = extractFilesFromSection(files) || {};

        let documentsResponse: UploadedDocument[] = [];

        if (filesToUpload.length > 0) {
            const uploadResult = await uploadFile(filesToUpload);
            if (!uploadResult || uploadResult.length === 0) {
                return false;
            }
            documentsResponse.push(...uploadResult);
        }

        const existingDocuments = (change?.files || []).filter(file => file && typeof file === 'object' && ('document_id' in file));
        documentsResponse = [...existingDocuments as UploadedDocument[], ...documentsResponse];
        console.log("change payload", change?.records);

        const savePayload = {
            submission_id: activeSubmissionId || submissionId,
            section_id: activeSection.section_id,
            section_payload: intakeNormalisedRecords(
                change?.records,
                sectionInternalIds[activeSection.section_register_id],
                listSectionRecordIds[activeSection.section_register_id],
            ),
            section_register_id: activeSection.section_register_id,
            form_id: formId,
            register_id: registerId,
            documents:documentsResponse.map((document, index) => ({
                document_id: document.document_id,
                label: fileLabels[index] || "unknown_label",
            }))
        };

        const saveResult = await executeSave('/api/intake-form/save-intake-form-submission', {
            method: 'POST',
            body: JSON.stringify(savePayload)
        });

        if (!saveResult) {
            return false;
        }

        if (saveResult.submission_id) {
            setActiveSubmissionId(saveResult.submission_id);
        }

        if (saveResult.application_reference) {
            setApplicationReference(saveResult.application_reference);
        }

        if (saveResult.record_name) {
            setRecordName(saveResult.record_name);
        }

        // Cache internal_record_ids from the response so subsequent saves
        // send UPDATE (not ADD) and keep related records connected.
        if (saveResult.section_payloads) {
            const currentSectionPayload = saveResult.section_payloads.find(
                (payload: any) => payload.section_register_id === activeSection.section_register_id
            );

            if (currentSectionPayload && currentSectionPayload.records?.length > 0) {
                if (currentSectionPayload.is_list) {
                    const ids = currentSectionPayload.records
                        .map((r: any) => r.internal_record_id)
                        .filter(Boolean);
                    setListSectionRecordIds(prev => ({
                        ...prev,
                        [activeSection.section_register_id]: ids,
                    }));
                } else {
                    setSectionInternalIds(prev => ({
                        ...prev,
                        [activeSection.section_register_id]: currentSectionPayload.records[0].internal_record_id,
                    }));
                }
            }
        }

        if (action === 'save') {
            toast.success(t('toast_section_saved_successfully'));
            if (onSuccess) onSuccess();
            return true;
        }

        const handleSuccessClose = () => {
            closeModal();
            if (onSuccess) onSuccess();
            router.push(`/intake-form/${registerType}`);
        };

        setModalConfig({
            isOpen: true,
            type: 'success',
            title: t('submitted_successfully'),
            subtitle: t('submitted_successfully_subtitle'),
            confirmText: t('close'),
            hideCancel: true,
            onClose: handleSuccessClose,
            onConfirm: handleSuccessClose
        });

        return true;
    };

    const handleAction = async (sectionChanges?: SectionChanges, action: 'submit' | 'save' = 'submit', actionSection?: IntakeFormSection): Promise<boolean> => {
        const activeSection = actionSection || section;

        if (action === 'submit') {
            setModalConfig({
                isOpen: true,
                type: 'warning',
                title: t('are_you_sure'),
                subtitle: t('submit_confirmation_subtitle'),
                confirmText: t('submit'),
                cancelText: t('cancel'),
                onClose: closeModal,
                onConfirm: () => {
                    closeModal();
                    if (sectionChanges && activeSection) {
                        performSave(sectionChanges, 'submit', activeSection);
                    } else {
                        performFinalize();
                    }
                }
            });
            return true;
        } else if (sectionChanges && activeSection) {
            return await performSave(sectionChanges, 'save', activeSection);
        }
        return false;
    };

    const FormActionModals = () => {
        if (!modalConfig) return null;
        return React.createElement(ActionModal, modalConfig);
    };

    return { handleAction, FormActionModals, recordName, applicationReference, activeSubmissionId };
};
