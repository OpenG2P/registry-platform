'use client';

import { useState } from 'react';
import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useFetch } from '@/shared/hooks';
import { toast } from 'react-toastify';
import { useFileUpload } from '@/features/shared/hooks';
import { useRuntimeConfig } from '@/context/RuntimeConfigContext';
import { useAllRegister } from '../shared';
import { useAllDataModels } from '../shared/hooks/useAllDataModels';
import { BaseModal, CustomDropdown, FileUploadField } from '../shared/components';
import { TEMPLATE_ACCEPT, TEMPLATE_UPLOAD_HINT_KEY, validateTemplateUpload } from '../shared/utils/templateUpload';


interface AddOutgestionTemplateModalProps {
    onClose: () => void;
    onSuccess?: () => void;
}

export default function AddOutgestionTemplateModal({
    onClose,
    onSuccess,
}: AddOutgestionTemplateModalProps) {
    const t = useTranslations();
    const { execute: createOutgestionTemplate, loading } = useFetch();
    const { config } = useRuntimeConfig();
    const currentPage = 1;

    const { registers, loading: registersLoading } = useAllRegister(currentPage, config.pageSize);
    const { dataModels, loading: dataModelsLoading } = useAllDataModels(currentPage, config.pageSize);

    const registerOptions =
        registers?.map((item: any) => ({
            label: t(item.register_subject),
            value: item.register_id,
        })) || [];

    const dataModelOptions =
        dataModels?.map((item: any) => ({
            label: item.data_model_mnemonic,
            value: item.data_model_id,
        })) || [];

    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        register_id: '',
        data_model_id: '',
        template_document_id: '',
    });

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const { uploadFile, uploading, uploadedFileName, setUploadedFileName } = useFileUpload('templates');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        const errorMessage = validateTemplateUpload(file, t);
        if (errorMessage) {
            toast.error(errorMessage);
            return;
        }

        setSelectedFile(file);
        setUploadedFileName(file.name);
    };

    const handleRemoveFile = () => {
        setSelectedFile(null);
        setUploadedFileName('');
    };

    const handleSubmit = async () => {
        if (!formData.register_id || !formData.data_model_id) {
            toast.warn('Register Id & Data Model Id are required');
            return;
        }

        let documentId = formData.template_document_id;
        if (selectedFile) {
            const result = await uploadFile([selectedFile]);
            const uploadedDocumentId = Array.isArray(result) ? result[0]?.document_id : undefined;
            if (!uploadedDocumentId) {
                return;
            }
            toast.success(t('file_uploaded_successfully'));
            documentId = uploadedDocumentId;
        }

        const result = await createOutgestionTemplate(
            '/api/configuration/outgest/create-template',
            {
                method: 'POST',
                body: JSON.stringify({
                    ...formData,
                    template_document_id: documentId
                }),
            }
        );

        if (result?.template_id) {
            toast.success(t('outgest_template_created'));

            setFormData({
                register_id: '',
                data_model_id: '',
                template_document_id: '',
            });
            setUploadedFileName('');

            onSuccess?.();
            onClose();
        }
    };

    const handleCancel = () => {
        setFormData({
            register_id: '',
            data_model_id: '',
            template_document_id: '',
        });

        onClose();
    };

    return (
        <BaseModal
            title={t('add_new_outgestion_template')}
            onClose={handleCancel}
            primaryActionLabel={t('save')}
            onPrimaryAction={handleSubmit}
            maxWidth='max-w-200'
        >
            <CustomDropdown
                label={t('data_model_id')}
                options={dataModelOptions}
                value={formData.data_model_id}
                loading={dataModelsLoading}
                disabled={dataModelsLoading}
                onChange={(value) =>
                    setFormData((prev) => ({
                        ...prev,
                        data_model_id: value,
                    }))
                }
            />

            <CustomDropdown
                label={t('register_id')}
                options={registerOptions}
                value={formData.register_id}
                loading={registersLoading}
                disabled={registersLoading}
                onChange={(value) =>
                    setFormData((prev) => ({
                        ...prev,
                        register_id: value,
                    }))
                }
            />

            <FileUploadField
                label={t('template')}
                fileInputRef={fileInputRef}
                uploading={uploading}
                fileId={formData.template_document_id}
                fileName={uploadedFileName}
                onFileChange={handleFileChange}
                onRemove={handleRemoveFile}
                accept={TEMPLATE_ACCEPT}
                helperText={t(TEMPLATE_UPLOAD_HINT_KEY)}
            />
        </BaseModal>
    );
}