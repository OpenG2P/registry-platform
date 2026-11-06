'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useFetch } from '@/shared/hooks';
import { toast } from 'react-toastify';
import { useAllRegister } from '../shared';
import { useAllDataModels } from '../shared/hooks/useAllDataModels';
import { useAllPartners } from '../shared/hooks/useAllPartners';
import CustomDropdown from '../shared/components/CustomDropdown';
import { BaseModal, InputField, TextAreaField } from '../shared/components';
import { OutgestTopic, TopicType, resolveTopicType } from '../shared/hooks/useAllOutgestTopics';

interface EditOutgestionTopicModalProps {
    onClose: () => void;
    onSuccess?: () => void;
    data?: OutgestTopic | null;
}

export default function EditOutgestionTopicModal({
    onClose,
    onSuccess,
    data,
}: EditOutgestionTopicModalProps) {
    const t = useTranslations();
    const topicTypeOptions = [
        { label: t('register'), value: 'REGISTER' },
        { label: t('partner'), value: 'PARTNER' },
    ];
    const { execute: updateOutgestionTopic } = useFetch();
    const { registers, loading: registersLoading } = useAllRegister(1, 100);
    const { dataModels, loading: dataModelsLoading } = useAllDataModels(1, 100);
    const { partners, loading: partnersLoading } = useAllPartners();

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

    const [topicType, setTopicType] = useState<TopicType>('REGISTER');
    const [formData, setFormData] = useState({
        topic_id: '',
        register_id: '',
        data_model_id: '',
        partner_id: '',
        websub_topic: '',
        description: '',
    });

    useEffect(() => {
        if (data) {
            setTopicType(resolveTopicType(data.topic_type));
            setFormData({
                topic_id: data.topic_id || '',
                register_id: data.register_id || '',
                data_model_id: data.data_model_id || '',
                partner_id: data.partner_id || '',
                websub_topic: data.websub_topic || '',
                description: data.description || '',
            });
        }
    }, [data]);

    const handleTopicTypeChange = (value: string) => {
        setTopicType(value as TopicType);
        setFormData((prev) => ({
            ...prev,
            register_id: '',
            data_model_id: '',
            partner_id: '',
        }));
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

        const result = await updateOutgestionTopic(
            '/api/configuration/outgest/update-topic',
            {
                method: 'POST',
                body: JSON.stringify({ ...formData, topic_type: topicType }),
            }
        );

        if (result) {
            toast.success(t('topic_updated'));
            onSuccess?.();
            onClose();
        }
    };

    return (
        <BaseModal
            title={t('edit_outgestion_topics')}
            onClose={onClose}
            primaryActionLabel={t('update')}
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
                        label={t('register')}
                        options={registerOptions}
                        value={formData.register_id}
                        loading={registersLoading}
                        disabled={registersLoading}
                        onChange={(value) => setFormData((prev) => ({ ...prev, register_id: value }))}
                    />
                    <CustomDropdown
                        label={t('data_model')}
                        options={dataModelOptions}
                        value={formData.data_model_id}
                        loading={dataModelsLoading}
                        disabled={dataModelsLoading}
                        onChange={(value) => setFormData((prev) => ({ ...prev, data_model_id: value }))}
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
