'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useAllRegister } from '../shared/hooks/useAllRegister';
import { useFetch } from '@/shared/hooks';

import { toast } from 'react-toastify';
import { convertImageToBase64 } from '../shared/utils/convertImageToBase64';
import { BaseModal } from '../shared/components';
import RegisterFormFields, { EMPTY_REGISTER_FORM } from './RegisterFormFields';

interface AddRegisterModalProps {
    onClose: () => void;
    onSuccess?: () => void;
}

const PURPOSE_OPTIONS = [
    { label: 'REGISTER', value: 'REGISTER' },
    { label: 'PROGRAM_APPLICATION', value: 'PROGRAM_APPLICATION' },
    { label: 'TABLE', value: 'TABLE' },
    { label: 'CORE_TABLE', value: 'CORE_TABLE' },
];

export default function AddRegisterModal({ onClose, onSuccess }: AddRegisterModalProps) {
    const t = useTranslations();
    const { registers } = useAllRegister(1, 100);
    const { execute: createRegister } = useFetch();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState(EMPTY_REGISTER_FORM);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                toast.error('Image size must be less than 2MB');
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

        const result = await createRegister('/api/configuration/registers/create', {
            method: 'POST',
            body: JSON.stringify({
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
                        : undefined,
                registrant_re_auth_warning_days_before:
                    formData.registrant_re_auth_warning_days_before !== ''
                        ? Number(formData.registrant_re_auth_warning_days_before)
                        : undefined,
                outgest_applicable: formData.outgest_applicable,
            }),
        });

        if (result?.register_id) {
            toast.success(`Register "${result.register_mnemonic}" created successfully`);
            setFormData(EMPTY_REGISTER_FORM);
            if (onSuccess) onSuccess();
            onClose();
        } else {
            toast.error('Failed to create register');
        }
    };

    return (
        <BaseModal
            title={t('add_new_register')}
            onClose={onClose}
            primaryActionLabel={t('save')}
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
            />
        </BaseModal>
    );
}
