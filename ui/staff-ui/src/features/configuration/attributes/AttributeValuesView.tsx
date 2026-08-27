'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { TopBar } from '@/components/shared';
import { useFetch, usePagination, usePageSize } from '@/shared/hooks';
import { useRbac } from '@/context/RbacContext';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import Can from '@/components/shared/Can';
import {
    DataTable,
    DeleteButton,
    EditButton,
} from '@/features/configuration/shared/components';
import {
    useAttributeValues,
    valueHasChildren,
} from '@/features/configuration/shared/hooks';
import { CONFIGURATION_ATTRIBUTES_ACTIONS } from '@/features/shared/permissions';
import type { Attribute, AttributeValue } from '@/features/configuration/shared/types/attributes';
import AddAttributeValueModal from './AddAttributeValueModal';
import EditAttributeValueModal from './EditAttributeValueModal';

interface AttributeValuesViewProps {
    attribute: Attribute;
}

export default function AttributeValuesView({ attribute }: AttributeValuesViewProps) {
    const t = useTranslations();
    const { can } = useRbac();
    const pageSize = usePageSize();
    const [valuePage, setValuePage] = useState(1);

    useEffect(() => {
        setValuePage(1);
    }, [pageSize]);
    const [searchText, setSearchText] = useState('');
    const [parentValueId, setParentValueId] = useState<string | null>(null);
    const [valueBreadcrumb, setValueBreadcrumb] = useState<AttributeValue[]>([]);
    const [valueModal, setValueModal] = useState<'add' | 'edit' | null>(null);
    const [selectedValue, setSelectedValue] = useState<AttributeValue | null>(null);

    const { execute: deleteValue } = useFetch();
    const canCreate = can(CONFIGURATION_ATTRIBUTES_ACTIONS.create);
    const isHierarchical = attribute.is_hierarchical;

    const {
        attributeValues,
        pagination,
        loading,
        refresh,
    } = useAttributeValues(
        attribute.attribute_id,
        valuePage,
        pageSize,
        parentValueId ?? undefined,
        searchText,
    );

    const { pageStart, pageEnd, total } = usePagination({
        totalItems: pagination?.number_of_items || 0,
        currentPage: valuePage,
        pageSize,
        currentCount: attributeValues.length,
    });

    useEffect(() => {
        const totalPages = pagination?.number_of_pages ?? 1;
        if (valuePage > totalPages) {
            setValuePage(totalPages);
        }
    }, [pagination?.number_of_pages, valuePage]);

    useEffect(() => {
        setValuePage(1);
        setSearchText('');
        setParentValueId(null);
        setValueBreadcrumb([]);
    }, [attribute.attribute_id]);

    const handleDrillIntoValue = (value: AttributeValue) => {
        if (!isHierarchical || !valueHasChildren(value.value_id, attributeValues)) {
            return;
        }
        setParentValueId(value.value_id);
        setValueBreadcrumb((prev) => [...prev, value]);
        setSearchText('');
        setValuePage(1);
    };

    const handleBreadcrumbClick = (index: number) => {
        if (index < 0) {
            setParentValueId(null);
            setValueBreadcrumb([]);
        } else {
            const crumb = valueBreadcrumb[index];
            setParentValueId(crumb.value_id);
            setValueBreadcrumb(valueBreadcrumb.slice(0, index + 1));
        }
        setSearchText('');
        setValuePage(1);
    };

    const proceedDelete = async (value: AttributeValue) => {
        const result = await deleteValue('/api/configuration/attributes/delete-attribute-value', {
            method: 'POST',
            body: JSON.stringify({ value_id: value.value_id }),
        });

        if (result?.value_id) {
            toast.success(t('toast_attribute_value_deleted'));
            refresh();
        }
    };

    const handleDelete = (value: AttributeValue) => {
        toast.info(
            ({ closeToast }) => (
                <div className="p-1">
                    <p className="font-bold text-neutral-first mb-3">
                        {t('confirm_remove_attribute_value')}
                    </p>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={async () => {
                                closeToast();
                                await proceedDelete(value);
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

    const columns = useMemo(
        () => [
            {
                key: 'value_code',
                label: t('value_code'),
                render: (item: AttributeValue) => (
                    <div className="flex items-center gap-2">
                        <span className="truncate">
                            {item.value_code ? t(item.value_code) : item.value_code}
                        </span>
                        {isHierarchical &&
                            valueHasChildren(item.value_id, attributeValues) && (
                                <ChevronRight
                                    size={16}
                                    className="text-neutral-first/40 shrink-0"
                                />
                            )}
                    </div>
                ),
            },
            { key: 'sort_order', label: t('sort_order') },
        ],
        [t, isHierarchical, attributeValues],
    );

    return (
        <>
            <div className="ml-4 mt-4 px-7.5">
                <div className="flex justify-between items-center min-h-14 gap-4 flex-wrap">
                    <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="font-medium text-[20px]">
                                {t('attribute_values_list')}
                            </div>
                            {valueBreadcrumb.length > 0 && (
                                <div className="flex items-center gap-1 text-[16px] font-medium text-neutral-first/70">
                                    <button
                                        type="button"
                                        onClick={() => handleBreadcrumbClick(-1)}
                                        className="hover:text-primary-second transition-colors"
                                    >
                                        {t('root')}
                                    </button>
                                    {valueBreadcrumb.map((crumb, index) => (
                                        <span
                                            key={crumb.value_id}
                                            className="flex items-center gap-1"
                                        >
                                            <span>/</span>
                                            <button
                                                type="button"
                                                onClick={() => handleBreadcrumbClick(index)}
                                                className="hover:text-primary-second transition-colors truncate max-w-40"
                                            >
                                                {crumb.value_code
                                                    ? t(crumb.value_code)
                                                    : crumb.value_code}
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        {isHierarchical && parentValueId && (
                            <p className="text-[16px] text-neutral-first/50 m-0">
                                {t('hierarchical_drill_down_hint')}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center h-full">
                        <TopBar
                            breadcrumb={[]}
                            showFilters={false}
                            showSearch
                            searchValue={searchText}
                            searchPlaceholder={t('search_attribute_values')}
                            onSearch={(value) => {
                                setSearchText(value);
                                setValuePage(1);
                            }}
                            showPagination
                            showAddNewButton={canCreate}
                            addNewButtonText={t('add_attribute_value')}
                            onAddNewButton={() => setValueModal('add')}
                            pageStart={pageStart}
                            pageEnd={pageEnd}
                            total={total}
                            onPrev={() => setValuePage((p) => Math.max(1, p - 1))}
                            onNext={() => setValuePage((p) => p + 1)}
                        />
                    </div>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={attributeValues}
                loading={loading}
                rowKey={(item) => item.value_id}
                onRowClick={
                    isHierarchical
                        ? (item) => {
                              if (valueHasChildren(item.value_id, attributeValues)) {
                                  handleDrillIntoValue(item);
                              }
                          }
                        : undefined
                }
                actions={(item) => (
                    <>
                        <Can action={CONFIGURATION_ATTRIBUTES_ACTIONS.edit}>
                            <EditButton
                                label={t('common.edit')}
                                onClick={() => {
                                    setSelectedValue(item);
                                    setValueModal('edit');
                                }}
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

            {valueModal === 'add' && (
                <AddAttributeValueModal
                    attributeId={attribute.attribute_id}
                    parentValueId={parentValueId ?? undefined}
                    onClose={() => setValueModal(null)}
                    onSuccess={refresh}
                />
            )}

            {valueModal === 'edit' && selectedValue && (
                <EditAttributeValueModal
                    value={selectedValue}
                    onClose={() => {
                        setValueModal(null);
                        setSelectedValue(null);
                    }}
                    onSuccess={refresh}
                />
            )}
        </>
    );
}