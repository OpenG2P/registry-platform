'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useFetch } from '@/shared/hooks';
import { toast } from 'react-toastify';
import { BaseModal, InputField } from '../shared/components';
import type { AttributeValue } from '../shared/types/attributes';

interface EditAttributeValueModalProps {
    value: AttributeValue;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function EditAttributeValueModal({
    value,
    onClose,
    onSuccess,
}: EditAttributeValueModalProps) {
    const t = useTranslations();
    const { execute: updateValue } = useFetch();

    const [formData, setFormData] = useState({
        value_code: value.value_code,
        sort_order: String(value.sort_order ?? 0),
    });

    const handleSubmit = async () => {
        if (!formData.value_code.trim()) {
            toast.warn(t('please_fill_required_fields'));
            return;
        }

        const result = await updateValue(
            '/api/configuration/attributes/update-attribute-value',
            {
                method: 'POST',
                body: JSON.stringify({
                    value_id: value.value_id,
                    attribute_id: value.attribute_id,
                    value_code: formData.value_code.trim(),
                    value_display: formData.value_code.trim(),
                    parent_value_id: value.parent_value_id ?? '',
                    sort_order: Number(formData.sort_order) || 0,
                }),
            },
        );

        if (result?.value_id) {
            toast.success(t('toast_attribute_value_updated'));
            onSuccess?.();
            onClose();
        } else {
            toast.error(t('toast_attribute_value_update_failed'));
        }
    };

    return (
        <BaseModal
            title={t('edit_attribute_value')}
            onClose={onClose}
            primaryActionLabel={t('save')}
            onPrimaryAction={handleSubmit}
            maxWidth="max-w-150"
        >
            <InputField
                label={t('value_code')}
                value={formData.value_code}
                onChange={(v) =>
                    setFormData((prev) => ({ ...prev, value_code: v }))
                }
            />
            <InputField
                label={t('sort_order')}
                value={formData.sort_order}
                onChange={(v) =>
                    setFormData((prev) => ({ ...prev, sort_order: v }))
                }
            />
        </BaseModal>
    );
}
