'use client';

import { useState } from 'react';
import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useFetch } from '@/shared/hooks';
import { toast } from 'react-toastify';
import { useFileUpload } from '@/features/shared/hooks';
import { BaseModal, InputField, FileUploadField, TextAreaField } from '../shared/components';
import { TEMPLATE_ACCEPT, TEMPLATE_UPLOAD_HINT_KEY, validateTemplateUpload } from '../shared/utils/templateUpload';


interface AddDataModelModalProps {
    onClose: () => void;
    onSuccess?: () => void;
}

export default function AddDataModelModal({
    onClose,
    onSuccess,
}: AddDataModelModalProps) {
    const t = useTranslations();
    const { execute: createDataModel, loading } = useFetch();

    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        data_model_mnemonic: '',
        pattern_for_data_model: '',
        response_template_document_id: '',
        is_active: true,
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
        if (!formData.data_model_mnemonic || !formData.pattern_for_data_model) {
            toast.warn('Mnemonic & Pattern are required');
            return;
        }

        let documentId = formData.response_template_document_id;
        if (selectedFile) {
            const result = await uploadFile([selectedFile]);
            const uploadedDocumentId = Array.isArray(result) ? result[0]?.document_id : undefined;
            if (!uploadedDocumentId) {
                return;
            }
            toast.success(t('file_uploaded_successfully'));
            documentId = uploadedDocumentId;
        }

        const result = await createDataModel(
            '/api/configuration/data-models/create',
            {
                method: 'POST',
                body: JSON.stringify({
                    ...formData,
                    response_template_document_id: documentId,
                }),
            }
        );

        if (result?.data_model_id) {
            toast.success(t('data_model_created_successfully'));

            setFormData({
                data_model_mnemonic: '',
                pattern_for_data_model: '',
                response_template_document_id: '',
                is_active: true,
            });

            onSuccess?.();
            onClose();
        }
    };

    const handleCancel = () => {
        setFormData({
            data_model_mnemonic: '',
            pattern_for_data_model: '',
            response_template_document_id: '',
            is_active: true,
        });
        onClose();
    };

    return (
        <BaseModal
            title={t('add_new_data_model')}
            onClose={handleCancel}
            primaryActionLabel={t('save')}
            onPrimaryAction={handleSubmit}
            maxWidth="max-w-200"
        >
            <InputField
                label={t('data_model_mnemonic')}
                value={formData.data_model_mnemonic}
                onChange={(value) =>
                    setFormData((prev) => ({
                        ...prev,
                        data_model_mnemonic: value,
                    }))
                }
            />

            <TextAreaField
                label={t('pattern')}
                value={formData.pattern_for_data_model}
                onChange={(value) =>
                    setFormData((prev) => ({
                        ...prev,
                        pattern_for_data_model: value,
                    }))
                }
                rows={1}
            />

            <div className="grid grid-cols-2 gap-6">
                <FileUploadField
                    label={t('template')}
                    fileInputRef={fileInputRef}
                    uploading={uploading}
                    fileId={formData.response_template_document_id}
                    fileName={uploadedFileName}
                    onFileChange={handleFileChange}
                    onRemove={handleRemoveFile}
                    accept={TEMPLATE_ACCEPT}
                    helperText={t(TEMPLATE_UPLOAD_HINT_KEY)}
                />
            </div>
        </BaseModal>
    );
}