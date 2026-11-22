'use client';

import { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';

import { EntityListPage, StackedCardSkeleton } from '@/components/shared';
import { ColumnDef } from '@/components/shared/entity-list/types';
import { ChangeRequestCard } from '@/features/change-request/components';
import { useChangeRequestSearch } from '@/features/change-request/hooks/useChangeRequestSearch';
import { usePagination, usePageSize } from '@/shared/hooks';
import { ChangeRequest } from '@/features/change-request/types';
import { useFilters } from '@/features/filter/hooks/useFilters';
import { FilterConfig } from '@/features/filter/types';
import { useRegister } from '@/context/RegisterContext';

const statusClassMap: Record<string, string> = {
    REJECTED: 'text-toast-failed',
    PENDING: 'text-amber-500',
    APPROVED: 'text-toast-success',
};

export default function ChangeRequestPage() {
    const router = useRouter();
    const t = useTranslations();
    const pageSize = usePageSize();

    const searchParams = useSearchParams();
    const searchQuery = searchParams.get('search') || '';
    const sortBy = searchParams.get('sort') || null;
    const { registers } = useRegister();

    const changeRequestFilterConfig = useMemo<FilterConfig[]>(() => [
        {
            field_name: 'approval_status',
            display_label: 'approval_status',
            filter_type: 'dropdown',
            order: 1,
            allowed_operators: ['eq', 'in'],
            options_source: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((value) => ({
                value,
                label: t.has(value) ? t(value) : value,
            })),
        },
        {
            field_name: 'register_id',
            display_label: 'register',
            filter_type: 'dropdown',
            order: 2,
            allowed_operators: ['eq'],
            options_source: registers.map((register) => ({
                value: register.register_id,
                label: t.has(register.register_mnemonic)
                    ? t(register.register_mnemonic)
                    : register.register_subject || register.register_mnemonic,
            })),
        },
    ], [registers, t]);

    const {
        appliedFilters,
        filterBy,
        filterConfig,
        filterLoading,
        applyFilters,
        removeFilter,
        clearAllFilters,
    } = useFilters('', changeRequestFilterConfig);

    const {
        changeRequests,
        loading,
        currentPage,
        paginationInfo,
        onPrev,
        onNext,
    } = useChangeRequestSearch({
        pageSize,
        searchText: searchQuery || undefined,
        sortBy,
        filterBy,
    });

    const { pageStart, pageEnd, total } = usePagination({
        totalItems: paginationInfo?.number_of_items ?? 0,
        currentPage,
        pageSize,
        currentCount: changeRequests.length,
    });

    const translateKey = (value?: string | null) => {
        const trimmed = value?.trim();
        if (!trimmed) return '—';
        if (t.has(trimmed)) return t(trimmed);
        const lower = trimmed.toLowerCase();
        if (lower !== trimmed && t.has(lower)) return t(lower);
        return trimmed;
    };

    const formatEnum = (value?: string | null) => {
        const trimmed = value?.trim();
        if (!trimmed) return '—';
        if (t.has(trimmed)) return t(trimmed);
        const lower = trimmed.toLowerCase();
        if (lower !== trimmed && t.has(lower)) return t(lower);
        return trimmed.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    };

    const handleSearch = useCallback((searchValue: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (searchValue.trim()) {
            params.set('search', searchValue.trim());
        } else {
            params.delete('search');
        }
        router.push(`/change-request?${params.toString()}`);
    }, [searchParams, router]);

    const handleSort = useCallback((nextSortBy: string | null) => {
        const params = new URLSearchParams(searchParams.toString());
        if (nextSortBy) {
            params.set('sort', nextSortBy);
        } else {
            params.delete('sort');
        }
        router.push(`/change-request?${params.toString()}`);
    }, [searchParams, router]);

    const columns: ColumnDef<ChangeRequest>[] = [
        {
            key: 'record_name',
            header: t.has('record_name') ? t('record_name') : 'Record Name',
            getValue: (cr) => cr.record_name ?? '',
            render: (cr) => (
                <span className="font-medium text-[15px]">{cr.record_name?.trim() || '—'}</span>
            ),
        },
        {
            key: 'register_mnemonic',
            header: t.has('register') ? t('register') : 'Register',
            getValue: (cr) => translateKey(cr.register_mnemonic),
        },
        {
            key: 'tab_label',
            header: t.has('tab') ? t('tab') : 'Tab',
            getValue: (cr) => translateKey(cr.tab_label),
        },
        {
            key: 'section_mnemonic',
            header: t.has('section') ? t('section') : 'Section',
            getValue: (cr) => translateKey(cr.section_mnemonic),
        },
        {
            key: 'created_by',
            header: t.has('created_by') ? t('created_by') : 'Created by',
            getValue: (cr) => cr.created_by,
        },
        {
            key: 'created_at',
            header: t.has('created_at') ? t('created_at') : 'Created at',
            getValue: (cr) => cr.created_at,
            render: (cr) => new Date(cr.created_at).toLocaleDateString(),
        },
        {
            key: 'approval_status',
            header: t.has('approval_status') ? t('approval_status') : 'Status',
            getValue: (cr) => cr.approval_status,
            render: (cr) => (
                <span className={`font-medium ${statusClassMap[cr.approval_status] ?? ''}`}>
                    {formatEnum(cr.approval_status)}
                </span>
            ),
        },
    ];

    const skeleton = (
        <>
            {[...Array(3)].map((_, i) => (
                <StackedCardSkeleton key={i} />
            ))}
        </>
    );

    return (
        <EntityListPage<ChangeRequest>
            breadcrumb={[{ label: t('change_request') }]}
            showPagination
            pageStart={pageStart}
            pageEnd={pageEnd}
            total={total}
            onPrev={onPrev}
            onNext={onNext}
            defaultView="card"
            viewStorageKey="changeRequestView"
            showSearch
            searchValue={searchQuery}
            searchPlaceholder={t('search')}
            onSearch={handleSearch}
            showFilters
            appliedFilters={appliedFilters}
            filterConfig={filterConfig}
            filterLoading={filterLoading}
            onApplyFilters={applyFilters}
            removeFilter={removeFilter}
            clearAllFilters={clearAllFilters}
            items={changeRequests}
            loading={loading}
            skeleton={skeleton}
            emptyMessage={
                <div className="text-sm text-neutral-first/50 text-center py-6">
                    {t('no_change_requests_found')}
                </div>
            }
            renderCard={(cr) => (
                <ChangeRequestCard
                    key={cr.change_request_id}
                    changeRequest={cr}
                    onViewDetails={() =>
                        router.push(`/change-request/${cr.change_request_id}`)
                    }
                />
            )}
            cardLayout="stacked"
            columns={columns}
            sortBy={sortBy}
            onSortChange={handleSort}
            onRowClick={(cr) =>
                router.push(`/change-request/${cr.change_request_id}`)
            }
        />
    );
}
