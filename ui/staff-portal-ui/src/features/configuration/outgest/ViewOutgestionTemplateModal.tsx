'use client';

import { useTranslations } from 'next-intl';
import { BaseModal, Field, FileLink } from '../shared/components';

interface Props {
    onClose: () => void;
    data?: any;
}

export default function ViewOutgestionTemplateModal({
    onClose,
    data,
}: Props) {
    const t = useTranslations();

    return (
        <BaseModal
            title={t('view_outgestion_template')}
            onClose={onClose}
            maxWidth='max-w-200'
        >
            <div className="bg-secondary-second/50 px-8 pt-2 pb-4">
                <Field label={t('data_model_mnemonic')} value={data?.data_model_mnemonic} />

                <Field label={t('register_mnemonic')} value={data?.register_mnemonic} />

                <Field
                    label={t('template')}
                    value={<FileLink documentId={data?.template_document_id} />}
                />
            </div>
        </BaseModal>
    );
}
