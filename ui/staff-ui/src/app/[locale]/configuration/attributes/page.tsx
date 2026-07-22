'use client';

import { useState } from 'react';
import { TopBar } from '@/components/shared';
import { useFetch, usePagination } from '@/shared/hooks';
import { useRuntimeConfig } from '@/context/RuntimeConfigContext';
import { useRbac } from '@/context/RbacContext';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { toast } from 'react-toastify';
import Can from '@/components/shared/Can';
import { DataTable, DeleteButton, EditButton } from '@/features/configuration/shared/components';
import { useAllAttributes } from '@/features/configuration/shared/hooks';
import { CONFIGURATION_ATTRIBUTES_ACTIONS } from '@/features/shared/permissions';
import type { Attribute } from '@/features/configuration/shared/types/attributes';
import { AddAttributeModal, EditAttributeModal } from '@/features/configuration/attributes';

const AttributesListPage = () => {
    const t = useTranslations();
    const router = useRouter();
    const { config } = useRuntimeConfig();
    const { can } = useRbac();
    const pageSize = config.pageSize || 20;

    const [currentPage, setCurrentPage] = useState(1);
    const [searchText, setSearchText] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editAttribute, setEditAttribute] = useState<Attribute | null>(null);

    const { execute: deleteAttribute } = useFetch();
    const canCreate = can(CONFIGURATION_ATTRIBUTES_ACTIONS.create);

    const { attributes, pagination, loading, refresh } = useAllAttributes(
        currentPage,
        pageSize,
        searchText,
    );

    const { pageStart, pageEnd, total } = usePagination({
        totalItems: pagination?.number_of_items || 0,
        currentPage,
        pageSize,
        currentCount: attributes.length,
    });

    const proceedDelete = async (attribute: Attribute) => {
        const result = await deleteAttribute('/api/configuration/attributes/delete-attribute', {
            method: 'POST',
            body: JSON.stringify({ attribute_id: attribute.attribute_id }),
        });

        if (result?.attribute_id) {
            toast.success(t('toast_attribute_deleted'));
            refresh();
        } else {
            toast.error(t('toast_attribute_delete_failed'));
        }
    };

    const handleDelete = (attribute: Attribute) => {
        toast.info(
            ({ closeToast }) => (
                <div className="p-1">
                    <p className="font-bold text-neutral-first mb-3">
                        {t('confirm_remove_attribute')}
                    </p>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={async () => {
                                closeToast();
                                try {
                                    await proceedDelete(attribute);
                                } catch {
                                    toast.error(t('toast_operation_failed'));
                                }
                            }}
                            className="bg-primary-second text-neutral-second px-4 py-1.5 rounded-full text-sm font-semibold hover:bg-primary-second transition-colors shadow-sm"
                        >
                            {t('remove')}
                        </button>
                        <button
                            type="button"
                            onClick={closeToast}
                            className="bg-secondary-first text-neutral-first/70 px-4 py-1.5 rounded-full text-sm font-semibold hover:bg-secondary-second transition-colors"
                        >
                            {t('cancel')}
                        </button>
                    </div>
                </div>
            ),
            {
                position: 'top-right',
                autoClose: false,
                closeOnClick: false,
                draggable: false,
                closeButton: false,
                className: 'rounded-[15px] shadow-xl border border-secondary-first',
            },
        );
    };

    const columns = [
        {
            key: 'attribute_code',
            label: t('attribute_code'),
            render: (item: Attribute) =>
                item.attribute_code? t(item.attribute_code) : item.attribute_code,
        },
        {
            key: 'is_hierarchical',
            label: t('is_hierarchical'),
            render: (item: Attribute) => (item.is_hierarchical ? t('true') : t('false')),
        },
    ];

    return (
        <>
            <TopBar
                breadcrumb={[{ label: t('attribute_values') }]}
                showFilters={false}
                showSearch
                searchValue={searchText}
                searchPlaceholder={t('search_attributes')}
                onSearch={(value) => {
                    setSearchText(value);
                    setCurrentPage(1);
                }}
                showPagination
                showAddNewButton={canCreate}
                addNewButtonText={t('add_new_attribute')}
                onAddNewButton={() => setShowAddModal(true)}
                pageStart={pageStart}
                pageEnd={pageEnd}
                total={total}
                onPrev={() => setCurrentPage((p) => Math.max(1, p - 1))}
                onNext={() => setCurrentPage((p) => p + 1)}
            />

            <DataTable
                columns={columns}
                data={attributes}
                loading={loading}
                rowKey={(item) => item.attribute_id}
                onRowClick={(item) =>
                    router.push(`/configuration/attributes/${encodeURIComponent(item.attribute_id)}`)
                }
                actions={(item) => (
                    <>
                        <Can action={CONFIGURATION_ATTRIBUTES_ACTIONS.edit}>
                            <EditButton
                                label={t('common.edit')}
                                onClick={() => setEditAttribute(item)}
                            />
                        </Can>
                        <Can action={CONFIGURATION_ATTRIBUTES_ACTIONS.delete}>
                            <DeleteButton
                                label={t('remove')}
                                onClick={() => handleDelete(item)}
                            />
                        </Can>
                    </>
                )}
            />

            {showAddModal && (
                <AddAttributeModal
                    onClose={() => setShowAddModal(false)}
                    onSuccess={refresh}
                />
            )}

            {editAttribute && (
                <EditAttributeModal
                    attribute={editAttribute}
                    onClose={() => setEditAttribute(null)}
                    onSuccess={refresh}
                />
            )}
        </>
    );
};

export default AttributesListPage;
