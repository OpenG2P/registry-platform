'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useFetch } from '@/shared/hooks';
import { toast } from 'react-toastify';
import { useAllRegister } from '../shared';
import { useAllDataModels } from '../shared/hooks/useAllDataModels';
import { useAllPartners } from '../shared/hooks/useAllPartners';
import CustomDropdown from '../shared/components/CustomDropdown';
import { BaseModal, InputField, TextAreaField } from '../shared/components';
import { TopicType } from '../shared/hooks/useAllOutgestTopics';

interface AddOutgestionTopicModalProps {
    onClose: () => void;
    onSuccess?: () => void;
}

export default function AddOutgestionTopicModal({
    onClose,
    onSuccess,
}: AddOutgestionTopicModalProps) {
    const t = useTranslations();
    const topicTypeOptions = [
        { label: t('register'), value: 'REGISTER' },
        { label: t('partner'), value: 'PARTNER' },
    ];
    const { execute: createOutgestionTopic, loading } = useFetch();
    const { registers, loading: registersLoading } = useAllRegister(1, 100);
    const { dataModels, loading: dataModelsLoading } = useAllDataModels(1, 100);
    const { partners, loading: partnersLoading } = useAllPartners();

    const [topicType, setTopicType] = useState<TopicType>('REGISTER');

    const registerOptions = registers?.map((item: any) => ({
        label: t(item.register_mnemonic),
        value: item.register_id,
    })) || [];

    const dataModelOptions = dataModels?.map((item: any) => ({
        label: t(item.data_model_mnemonic),
        value: item.data_model_id,
    })) || [];

    const partnerOptions = partners?.map((item) => ({
        label: t(item.name || item.partner_id),
        value: item.partner_id,
    })) || [];

    const [formData, setFormData] = useState({
        register_id: '',
        data_model_id: '',
        partner_id: '',
        websub_topic: '',
        description: '',
    });

    const handleTopicTypeChange = (value: string) => {
        setTopicType(value as TopicType);
        setFormData({ register_id: '', data_model_id: '', partner_id: '', websub_topic: '', description: '' });
    };

    const handleSubmit = async () => {
        if (topicType === 'REGISTER' && (!formData.register_id || !formData.data_model_id)) {
            toast.warn(t('register_and_data_model_required'));
            return;
        }
        if (topicType === 'PARTNER' && !formData.partner_id) {
            toast.warn(t('partner_required'));
            return;
        }

        const result = await createOutgestionTopic(
            '/api/configuration/outgest/create-topic',
            {
                method: 'POST',
                body: JSON.stringify({ ...formData, topic_type: topicType }),
            }
        );

        if (result?.topic_id) {
            toast.success(t('topic_created'));
            onSuccess?.();
            onClose();
        }
    };

    const handleCancel = () => onClose();

    return (
        <BaseModal
            title={t('add_new_outgestion_topic')}
            onClose={handleCancel}
            primaryActionLabel={t('save')}
            onPrimaryAction={handleSubmit}
            maxWidth='max-w-200'
        >
            <CustomDropdown
                label={t('topic_type')}
                options={topicTypeOptions}
                value={topicType}
                onChange={handleTopicTypeChange}
            />

            {topicType === 'REGISTER' && (
                <>
                    <CustomDropdown
                        label={t('data_model')}
                        options={dataModelOptions}
                        value={formData.data_model_id}
                        loading={dataModelsLoading}
                        disabled={dataModelsLoading}
                        onChange={(value) => setFormData((prev) => ({ ...prev, data_model_id: value }))}
                    />
                    <CustomDropdown
                        label={t('register')}
                        options={registerOptions}
                        value={formData.register_id}
                        loading={registersLoading}
                        disabled={registersLoading}
                        onChange={(value) => setFormData((prev) => ({ ...prev, register_id: value }))}
                    />
                </>
            )}

            {topicType === 'PARTNER' && (
                <CustomDropdown
                    label={t('partner')}
                    options={partnerOptions}
                    value={formData.partner_id}
                    loading={partnersLoading}
                    disabled={partnersLoading}
                    onChange={(value) => setFormData((prev) => ({ ...prev, partner_id: value }))}
                />
            )}

            <InputField
                label={t('websub_topic')}
                value={formData.websub_topic}
                onChange={(value) => setFormData((prev) => ({ ...prev, websub_topic: value }))}
            />

            <TextAreaField
                label={t('description')}
                value={formData.description}
                onChange={(value) => setFormData((prev) => ({ ...prev, description: value }))}
                rows={4}
            />
        </BaseModal>
    );
}
