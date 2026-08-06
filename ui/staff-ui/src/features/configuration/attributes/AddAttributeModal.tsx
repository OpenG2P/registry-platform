'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useFetch } from '@/shared/hooks';
import { toast } from 'react-toastify';
import { BaseModal, InputField, CheckboxField } from '../shared/components';

interface AddAttributeModalProps {
    onClose: () => void;
    onSuccess?: () => void;
}

export default function AddAttributeModal({
    onClose,
    onSuccess,
}: AddAttributeModalProps) {
    const t = useTranslations();
    const { execute: createAttribute } = useFetch();

    const [formData, setFormData] = useState({
        attribute_code: '',
        is_hierarchical: false,
    });

    const handleSubmit = async () => {
        if (!formData.attribute_code.trim()) {
            toast.warn(t('please_fill_required_fields'));
            return;
        }

        const result = await createAttribute(
            '/api/configuration/attributes/create-attribute',
            {
                method: 'POST',
                body: JSON.stringify({
                    ...formData,
                    attribute_display: formData.attribute_code.trim(),
                }),
            },
        );

        if (result?.attribute_id) {
            toast.success(t('toast_attribute_created'));
            onSuccess?.();
            onClose();
        }
    };

    return (
        <BaseModal
            title={t('add_new_attribute')}
            onClose={onClose}
            primaryActionLabel={t('save')}
            onPrimaryAction={handleSubmit}
            maxWidth="max-w-150"
        >
            <InputField
                label={t('attribute_code')}
                value={formData.attribute_code}
                onChange={(value) =>
                    setFormData((prev) => ({ ...prev, attribute_code: value }))
                }
            />
            <CheckboxField
                label={t('is_hierarchical')}
                checked={formData.is_hierarchical}
                onChange={(value) =>
                    setFormData((prev) => ({ ...prev, is_hierarchical: value }))
                }
            />
        </BaseModal>
    );
}
