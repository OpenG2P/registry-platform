'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useFetch } from '@/shared/hooks';
import { toast } from 'react-toastify';
import { BaseModal, InputField } from '../shared/components';

interface AddAttributeValueModalProps {
    attributeId: string;
    parentValueId?: string;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function AddAttributeValueModal({
    attributeId,
    parentValueId,
    onClose,
    onSuccess,
}: AddAttributeValueModalProps) {
    const t = useTranslations();
    const { execute: createValue } = useFetch();

    const [formData, setFormData] = useState({
        value_code: '',
        value_display: '',
        sort_order: '0',
    });

    const handleSubmit = async () => {
        if (!formData.value_code.trim() || !formData.value_display.trim()) {
            toast.warn(t('please_fill_required_fields'));
            return;
        }

        const result = await createValue(
            '/api/configuration/attributes/create-attribute-value',
            {
                method: 'POST',
                body: JSON.stringify({
                    attribute_id: attributeId,
                    value_code: formData.value_code.trim(),
                    value_display: formData.value_display.trim(),
                    parent_value_id: parentValueId ?? '',
                    sort_order: Number(formData.sort_order) || 0,
                }),
            },
        );

        if (result?.value_id) {
            toast.success(t('toast_attribute_value_created'));
            onSuccess?.();
            onClose();
        } else {
            toast.error(t('toast_attribute_value_create_failed'));
        }
    };

    return (
        <BaseModal
            title={t('add_attribute_value')}
            onClose={onClose}
            primaryActionLabel={t('save')}
            onPrimaryAction={handleSubmit}
            maxWidth="max-w-150"
        >
            <InputField
                label={t('value_code')}
                value={formData.value_code}
                onChange={(value) =>
                    setFormData((prev) => ({ ...prev, value_code: value }))
                }
            />
            <InputField
                label={t('value_display')}
                value={formData.value_display}
                onChange={(value) =>
                    setFormData((prev) => ({ ...prev, value_display: value }))
                }
            />
            <InputField
                label={t('sort_order')}
                value={formData.sort_order}
                onChange={(value) =>
                    setFormData((prev) => ({ ...prev, sort_order: value }))
                }
            />
        </BaseModal>
    );
}
