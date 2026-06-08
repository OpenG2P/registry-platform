'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useFetch } from '@/shared/hooks';
import { toast } from 'react-toastify';
import { BaseModal, InputField, CheckboxField } from '../shared/components';
import type { Attribute } from '../shared/types/attributes';

interface EditAttributeModalProps {
    attribute: Attribute;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function EditAttributeModal({
    attribute,
    onClose,
    onSuccess,
}: EditAttributeModalProps) {
    const t = useTranslations();
    const { execute: updateAttribute } = useFetch();

    const [formData, setFormData] = useState({
        attribute_code: attribute.attribute_code,
        attribute_display: attribute.attribute_display,
        is_hierarchical: attribute.is_hierarchical,
    });

    const handleSubmit = async () => {
        if (!formData.attribute_code.trim() || !formData.attribute_display.trim()) {
            toast.warn(t('please_fill_required_fields'));
            return;
        }

        const result = await updateAttribute(
            '/api/configuration/attributes/update-attribute',
            {
                method: 'POST',
                body: JSON.stringify({
                    attribute_id: attribute.attribute_id,
                    ...formData,
                }),
            },
        );

        if (result?.attribute_id) {
            toast.success(t('toast_attribute_updated'));
            onSuccess?.();
            onClose();
        } else {
            toast.error(t('toast_attribute_update_failed'));
        }
    };

    return (
        <BaseModal
            title={t('edit_attribute')}
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
            <InputField
                label={t('attribute_display')}
                value={formData.attribute_display}
                onChange={(value) =>
                    setFormData((prev) => ({ ...prev, attribute_display: value }))
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
