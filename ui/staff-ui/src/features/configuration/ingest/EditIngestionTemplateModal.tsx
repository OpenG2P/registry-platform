'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useFetch } from '@/shared/hooks';
import { toast } from 'react-toastify';
import { useFileUpload, useDocuments } from '@/features/shared/hooks';
import { BaseModal, Field, FileUploadField, CheckboxField } from '../shared/components';
import { TEMPLATE_ACCEPT, TEMPLATE_UPLOAD_HINT_KEY, validateTemplateUpload } from '../shared/utils/templateUpload';


interface EditIngestionTemplateModalProps {
    onClose: () => void;
    onSuccess?: () => void;
    data?: any;
}

export default function EditIngestionTemplateModal({
    onClose,
    onSuccess,
    data,
}: EditIngestionTemplateModalProps) {
    const t = useTranslations();
    const { execute: updateIngestionTemplate } = useFetch();
    const { getDocument } = useDocuments();

    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        template_id: '',
        template_document_id: '',
        jsonld_expansion_required: false
    });

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const { uploadFile, uploading, uploadedFileName, setUploadedFileName } = useFileUpload('templates');

    useEffect(() => {
        if (!data) return;

        setFormData({
            template_id: data.template_id || '',
            template_document_id: data.template_document_id || '',
            jsonld_expansion_required: data.jsonld_expansion_required || false
        });

        const documentId = data.template_document_id;
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
        const result = await updateIngestionTemplate(
            '/api/configuration/ingest/update-template',
            {
                method: 'POST',
                body: JSON.stringify({
                    ...formData,
                    template_id: data?.template_id,
                    template_document_id: documentId
                }),
            }
        );

        if (result) {
            toast.success(t('ingest_template_updated'));
            setFormData({
                template_id: '',
                template_document_id: '',
                jsonld_expansion_required: false
            });
            setUploadedFileName('');
            onSuccess?.();
            onClose();
        }
    };

    const handleCancel = () => {
        onClose();
    };

    return (
        <BaseModal
            title={t('edit_ingestion_templates')}
            onClose={handleCancel}
            primaryActionLabel={t('update')}
            onPrimaryAction={handleSubmit}
            maxWidth='max-w-200'
        >
            <Field label={t('register_mnemonic')} value={data.register_mnemonic} />
            <Field label={t('data_model_mnemonic')} value={data.data_model_mnemonic} />
            <div className="flex gap-6">
                <div className="flex-1">
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
                </div>

                <div className="flex-1">
                    <CheckboxField
                        label={t('jsonld_expansion')}
                        checked={formData.jsonld_expansion_required}
                        onChange={(value) =>
                            setFormData((prev) => ({
                                ...prev,
                                jsonld_expansion_required: value,
                            }))
                        }
                    />
                </div>
            </div>
        </BaseModal>
    );
}