'use client';

import { KeyValue } from '@/components/ui/KeyValue';
import { OutgoingMessage } from '../types';
import { useLocale, useTranslations } from 'next-intl';
import { formatDateTime } from '@/shared/utils/dateUtils';

interface Props {
    message: OutgoingMessage;
}

export default function OutgoingMessageCard({ message }: Props) {
    const t = useTranslations();
    const locale = useLocale();
    const empty = t('n_a');

    const text = (value?: string | number | null) =>
        value === null || value === undefined || value === '' ? empty : String(value);

    const registerMnemonic = message.register_mnemonic?.toLowerCase();

    return (
        <div className="rounded-[10px] bg-neutral-second px-10 py-8">
            <div className="grid gap-6 grid-cols-1 md:grid-cols-4 text-[16px] text-neutral-first/50">
                <div className="space-y-4">
                    <h3 className="text-[18px] font-semibold text-primary-second">
                        {t('source')}
                    </h3>
                    <div className="space-y-2">
                        <KeyValue label={t('outgest_id')} value={message.outgest_id} />
                        <KeyValue label={t('source_register')} value={text(message.register_mnemonic)} />
                        <KeyValue label={t('record_id')} value={text(message.internal_record_id)} />
                        <KeyValue label={t('partner')} value={text(message.partner_mnemonic)} />
                        <KeyValue label={t('queued_date_time')} value={formatDateTime(message.created_at)} />
                    </div>
                </div>

                <div className="border-l-2 space-y-4 border-secondary-second pl-6">
                    <h3 className="text-[18px] font-semibold text-primary-second">{t('topic')}</h3>
                    <div className="space-y-2">
                        <KeyValue label={t('websub_topic')} value={text(message.websub_topic)} />
                        <KeyValue label={t('data_model')} value={text(message.data_model_mnemonic)} />
                        {message.change_request_id && (
                            <KeyValue
                                label={t('cr')}
                                value={message.change_request_id}
                                href={`/${locale}/change-request/${message.change_request_id}`}
                            />
                        )}
                        {message.intake_form_submission_id && (
                            <KeyValue
                                label={t('form_submission_id')}
                                value={message.intake_form_submission_id}
                                href={
                                    registerMnemonic
                                        ? `/${locale}/intake-form/${registerMnemonic}/submission/${message.intake_form_submission_id}`
                                        : undefined
                                }
                            />
                        )}
                        <KeyValue label={t('changed_by')} value={text(message.changed_by)} />
                        <KeyValue label={t('approved_by')} value={text(message.approved_by)} />
                    </div>
                </div>

                <div className="border-l-2 space-y-4 border-secondary-second pl-6">
                    <h3 className="text-[18px] font-semibold text-primary-second">{t('transformation')}</h3>
                    <div className="space-y-2">
                        <KeyValue label={t('status')} value={text(message.transformation_status)} />
                        <KeyValue label={t('date_and_time')} value={formatDateTime(message.transformation_datetime)} />
                        <KeyValue label={t('attempts')} value={text(message.transformation_number_of_attempts)} />
                        <KeyValue label={t('error')} value={text(message.transformation_latest_error_code)} />
                    </div>
                </div>

                <div className="border-l-2 space-y-4 border-secondary-second pl-6">
                    <h3 className="text-[18px] font-semibold text-primary-second">{t('publish')}</h3>
                    <div className="space-y-2">
                        <KeyValue label={t('status')} value={text(message.publish_status)} />
                        <KeyValue label={t('date_and_time')} value={formatDateTime(message.publish_datetime)} />
                        <KeyValue label={t('attempts')} value={text(message.publish_number_of_attempts)} />
                        <KeyValue label={t('error')} value={text(message.publish_latest_error_code)} />
                    </div>
                </div>
            </div>
        </div>
    );
}
