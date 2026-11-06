'use client';

import { useTranslations } from 'next-intl';
import { BaseModal, Field } from '../shared/components';
import { formatDateTime } from '@/shared/utils/dateUtils';
import { OutgestTopic, resolveTopicType } from '../shared/hooks/useAllOutgestTopics';

interface Props {
    onClose: () => void;
    data?: OutgestTopic | null;
}

export default function ViewOutgestionTopicModal({ onClose, data }: Props) {
    const t = useTranslations();
    const topicType = resolveTopicType(data?.topic_type);
    const isPartner = topicType === 'PARTNER';

    return (
        <BaseModal
            title={t('view_outgestion_topic')}
            onClose={onClose}
            maxWidth="max-w-200"
        >
            <div className="bg-secondary-second/50 px-8 pt-2 pb-4">
                <Field label={t('topic_type')} value={isPartner ? t('partner') : t('register')} />

                {isPartner ? (
                    <>
                        <Field label={t('partner')} value={data?.partner_name ? t(data.partner_name) : data?.partner_id} />
                    </>
                ) : (
                    <>
                        <Field label={t('register')} value={data?.register_mnemonic ? t(data.register_mnemonic) : data?.register_mnemonic} />
                        <Field label={t('data_model')} value={data?.data_model_mnemonic ? t(data.data_model_mnemonic) : data?.data_model_mnemonic} />
                    </>
                )}

                <Field label={t('websub_topic')} value={data?.websub_topic} />

                <Field label={t('description')} value={data?.description} />

                <Field
                    label={t('is_active')}
                    value={data?.is_active ? t('true') : t('false')}
                />

                <Field
                    label={t('websub_register_status')}
                    value={data?.websub_register_status}
                />

                <Field
                    label={t('websub_register_datetime')}
                    value={formatDateTime(data?.websub_register_datetime)}
                />

                <Field
                    label={t('websub_register_attempts')}
                    value={data?.websub_register_number_of_attempts}
                />

                <Field
                    label={t('websub_register_error')}
                    value={data?.websub_register_latest_error_message}
                />
            </div>
        </BaseModal>
    );
}
