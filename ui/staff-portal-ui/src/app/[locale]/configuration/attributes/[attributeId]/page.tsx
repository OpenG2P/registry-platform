'use client';

import { useState } from 'react';
import { BreadcrumbBar } from '@/components/shared';
import { useParams } from 'next/navigation';
import { useBreadcrumb } from '@/shared/hooks/useBreadcrumb';
import { useTranslations } from 'next-intl';
import { useRbac } from '@/context/RbacContext';
import { ConfigDetailsSummary } from '@/features/configuration/shared/components';
import { useAttribute } from '@/features/configuration/shared/hooks';
import { CONFIGURATION_ATTRIBUTES_ACTIONS } from '@/features/configuration/shared/utils/configurationAttributes.actions';
import {
    AttributeValuesView,
    EditAttributeModal,
} from '@/features/configuration/attributes';

const AttributeDetailPage = () => {
    const t = useTranslations();
    const { can } = useRbac();
    const { attributeId: rawAttributeId } = useParams<{ attributeId: string }>();
    const attributeId = decodeURIComponent(rawAttributeId ?? '');

    const { attribute, loading, refresh } = useAttribute(attributeId);
    const [showEditModal, setShowEditModal] = useState(false);

    const canEdit = can(CONFIGURATION_ATTRIBUTES_ACTIONS.edit);

    const breadcrumb = useBreadcrumb({
        rootItem: { label: t('attribute_values'), href: '/configuration/attributes' },
        customItems: [
            {
                label: attribute?.attribute_display || attributeId,
                href: `/configuration/attributes/${encodeURIComponent(attributeId)}`,
            },
        ],
    });

    if (loading && !attribute) {
        return (
            <div className="min-h-screen bg-secondary-first flex items-center justify-center">
                <img src="/images/common/loading.gif" className="w-12 h-12" alt="Loading" />
            </div>
        );
    }

    if (!attribute) {
        return (
            <div className="min-h-screen bg-secondary-first flex items-center justify-center text-[16px] text-secondary-third">
                {t('no_attributes')}
            </div>
        );
    }

    return (
        <>
            <div className="pt-10 px-7.5 mb-6">
                <BreadcrumbBar breadcrumb={breadcrumb} />
            </div>

            <ConfigDetailsSummary
                title={attribute.attribute_display}
                description={attribute.attribute_code}
                extraInfo1={
                    attribute.is_hierarchical ? t('hierarchical') : t('flat')
                }
                onEdit={canEdit ? () => setShowEditModal(true) : undefined}
            />

            <AttributeValuesView
                key={`${attribute.attribute_id}-${attribute.is_hierarchical}`}
                attribute={attribute}
            />

            {showEditModal && (
                <EditAttributeModal
                    attribute={attribute}
                    onClose={() => setShowEditModal(false)}
                    onSuccess={() => {
                        refresh();
                    }}
                />
            )}
        </>
    );
};

export default AttributeDetailPage;
