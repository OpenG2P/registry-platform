'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useAllRegister } from '../shared/hooks/useAllRegister';
import { useFetch } from '@/shared/hooks';
import { toast } from 'react-toastify';
import { Register } from '../shared/types';
import { convertImageToBase64 } from '../shared/utils/convertImageToBase64';
import { BaseModal } from '../shared/components';
import RegisterFormFields, { EMPTY_REGISTER_FORM } from './RegisterFormFields';

interface EditRegisterModalProps {
    onClose: () => void;
    onSuccess?: () => void;
    initialData: Register;
}

const PURPOSE_OPTIONS = [
    { label: 'REGISTER', value: 'REGISTER' },
    { label: 'PROGRAM_APPLICATION', value: 'PROGRAM_APPLICATION' },
    { label: 'TABLE', value: 'TABLE' },
];

export default function EditRegisterModal({ onClose, onSuccess, initialData }: EditRegisterModalProps) {
    const t = useTranslations();
    const { registers } = useAllRegister(1, 100);
    const { execute: updateRegister } = useFetch();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState(EMPTY_REGISTER_FORM);

    useEffect(() => {
        if (initialData) {
            setFormData({
                register_mnemonic: initialData.register_mnemonic || '',
                register_description: initialData.register_description || '',
                master_register_id: initialData.master_register_id || '',
                dedup_is_enabled: initialData.dedup_is_enabled || false,
                dedup_threshold_score: initialData.dedup_threshold_score?.toString() || '0',
                register_icon: initialData.register_icon || '',
                register_rank: initialData.register_rank?.toString() || '0',
                register_purpose: initialData.register_purpose || 'REGISTER',
                functional_id_generation_required: initialData.functional_id_generation_required || false,
                completion_score_required: initialData.completion_score_required || false,
                requires_registrant_authentication: initialData.requires_registrant_authentication || false,
                registrant_authentication_validity_days:
                    initialData.registrant_authentication_validity_days?.toString() ?? '',
                registrant_re_auth_warning_days_before:
                    initialData.registrant_re_auth_warning_days_before?.toString() ?? '',
                outgest_applicable: initialData.outgest_applicable || false,
            });
        }
    }, [initialData]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 1 * 1024 * 1024) {
                toast.error('Image size must be less than 1MB');
                return;
            }

            try {
                const base64 = await convertImageToBase64(file);
                setFormData((prev) => ({ ...prev, register_icon: base64 }));
            } catch {
                toast.error('Failed to process image');
            }
        }
    };

    const handleSubmit = async () => {
        if (!formData.register_mnemonic || !formData.register_description || !formData.register_purpose) {
            toast.warn('Basic fields (Mnemonic, Description, Purpose) are required');
            return;
        }

        const result = await updateRegister('/api/configuration/registers/edit', {
            method: 'POST',
            body: JSON.stringify({
                register_id: initialData.register_id,
                register_mnemonic: formData.register_mnemonic,
                register_description: formData.register_description,
                master_register_id: formData.master_register_id || null,
                dedup_is_enabled: formData.dedup_is_enabled,
                dedup_threshold_score: Number(formData.dedup_threshold_score) || 0,
                register_icon: formData.register_icon,
                register_rank: Number(formData.register_rank) || 0,
                register_purpose: formData.register_purpose,
                functional_id_generation_required: formData.functional_id_generation_required,
                completion_score_required: formData.completion_score_required,
                requires_registrant_authentication: formData.requires_registrant_authentication,
                registrant_authentication_validity_days:
                    formData.registrant_authentication_validity_days !== ''
                        ? Number(formData.registrant_authentication_validity_days)
                        : null,
                registrant_re_auth_warning_days_before:
                    formData.registrant_re_auth_warning_days_before !== ''
                        ? Number(formData.registrant_re_auth_warning_days_before)
                        : null,
                outgest_applicable: formData.outgest_applicable,
            }),
        });

        if (result) {
            toast.success(`Register "${formData.register_mnemonic}" updated successfully`);
            if (onSuccess) onSuccess();
            onClose();
        }
    };

    return (
        <BaseModal
            title={t('edit_register')}
            onClose={onClose}
            primaryActionLabel={t('update')}
            onPrimaryAction={handleSubmit}
            maxWidth="max-w-225"
        >
            <RegisterFormFields
                formData={formData}
                setFormData={setFormData}
                registers={registers}
                fileInputRef={fileInputRef}
                onFileChange={handleFileChange}
                purposeOptions={PURPOSE_OPTIONS}
                iconPreview={(icon) =>
                    icon.startsWith('data:') ? icon : `data:image/png;base64,${icon}`
                }
            />
        </BaseModal>
    );
}
