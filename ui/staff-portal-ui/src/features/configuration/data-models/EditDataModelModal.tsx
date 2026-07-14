'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useFetch } from '@/shared/hooks';
import { toast } from 'react-toastify';
import { useFileUpload, useDocuments } from '@/features/shared/hooks';
import { BaseModal, InputField, FileUploadField, CheckboxField, TextAreaField } from '../shared/components';
import { TEMPLATE_ACCEPT, TEMPLATE_UPLOAD_HINT_KEY, validateTemplateUpload } from '../shared/utils/templateUpload';

interface EditDataModelModalProps {
    onClose: () => void;
    onSuccess?: () => void;
    data?: any;
}

export default function EditDataModelModal({
    onClose,
    onSuccess,
    data,
}: EditDataModelModalProps) {
    const t = useTranslations();
    const { execute: updateDataModel } = useFetch();
    const { getDocument } = useDocuments();

    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        data_model_mnemonic: '',
        pattern_for_data_model: '',
        response_template_document_id: '',
        is_active: true,
    });

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const { uploadFile, uploading, uploadedFileName, setUploadedFileName } = useFileUpload('templates');

    useEffect(() => {
        if (!data) return;

        setFormData({
            data_model_mnemonic: data.data_model_mnemonic || '',
            pattern_for_data_model: data.pattern_for_data_model || '',
            response_template_document_id:
                data.response_template_document_id || '',
            is_active: data.is_active ?? true,
        });

        const documentId = data.response_template_document_id;
        if (!documentId) {
            setUploadedFileName('');
            return;
        }

        getDocument(documentId).then((document) => {
            setUploadedFileName(document?.source_filename || document?.label || '');
        });
    }, [data]);

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
                toast.error(t('failed_to_upload_file'));
                return;
            }
            toast.success(t('file_uploaded_successfully'));
            documentId = uploadedDocumentId;
        }

        const result = await updateDataModel(
            '/api/configuration/data-models/update',
            {
                method: 'POST',
                body: JSON.stringify({
                    ...formData,
                    data_model_id: data?.data_model_id,
                    response_template_document_id: documentId,
                }),
            }
        );

        if (result) {
            toast.success(t('data_model_updated_successfully'));
            onSuccess?.();
            onClose();
        } else {
            toast.error('failed_to_update_data_model');
        }
    };

    const handleCancel = () => {
        onClose();
    };

    return (
        <BaseModal
            title={t('edit_data_model')}
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

                <CheckboxField
                    label={t('status')}
                    checked={formData.is_active}
                    onChange={(value) =>
                        setFormData((prev) => ({
                            ...prev,
                            is_active: value,
                        }))
                    }
                />
            </div>
        </BaseModal>
    );
}