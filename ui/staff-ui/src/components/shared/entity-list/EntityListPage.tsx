'use client';

import { useTranslations } from 'next-intl';
import { BreadcrumbBar, PaginationBar } from '@/components/shared';
import { SelectedFilters } from '@/features/filter/components';
import DataTable from './DataTable';
import MoreMenu from './MoreMenu';
import { useListView } from './useListView';
import { EntityListPageProps } from './types';

export default function EntityListPage<T>({
    breadcrumb,
    showPagination = true,
    pageStart,
    pageEnd,
    total,
    onPrev,
    onNext,
    defaultView = 'card',
    viewStorageKey,
    showSearch = false,
    searchValue = '',
    searchPlaceholder,
    onSearch,
    showFilters = false,
    appliedFilters = [],
    filterConfig = [],
    filterLoading = false,
    onApplyFilters,
    removeFilter,
    clearAllFilters,
    items,
    loading = false,
    emptyMessage,
    skeleton,
    renderCard,
    cardLayout = 'stacked',
    columns,
    onRowClick,
    sortBy,
    onSortChange,
    actions,
    moreMenuItems,
}: EntityListPageProps<T>) {
    const t = useTranslations();
    const { view, setView } = useListView(defaultView, viewStorageKey);

    const hasFilterRow = showSearch || showFilters || appliedFilters.length > 0;

    const emptyContent = emptyMessage ?? (
        <div className="text-sm text-neutral-first/50 text-center py-6">
            {t.has('no_items_found') ? t('no_items_found') : 'No items found'}
        </div>
    );

    const topBar = (
        <div className="w-full h-17.5 flex justify-center items-center">
            <div className="w-full px-7.5 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    {breadcrumb.length > 0 && <BreadcrumbBar breadcrumb={breadcrumb} />}
                </div>
                <div className="flex items-center gap-2 sm:gap-4">
                    {actions}

                    {showPagination && onPrev && onNext && (
                        <PaginationBar
                            pageStart={pageStart ?? 0}
                            pageEnd={pageEnd ?? 0}
                            total={total ?? 0}
                            onPrev={onPrev}
                            onNext={onNext}
                        />
                    )}

                    <MoreMenu
                        view={view}
                        onViewChange={setView}
                        extraItems={moreMenuItems}
                    />
                </div>
            </div>
        </div>
    );

    // Filter + Search row (inside panel)
    const filterRow = hasFilterRow ? (
        <div className="relative z-20 px-2 pt-1">
            <SelectedFilters
                appliedFilters={appliedFilters}
                filterConfig={filterConfig}
                removeFilter={removeFilter ?? (() => {})}
                clearAllFilters={clearAllFilters ?? (() => {})}
                searchValue={showSearch ? searchValue : undefined}
                searchPlaceholder={searchPlaceholder ?? (t.has('search') ? t('search') : 'Search')}
                onSearch={showSearch ? onSearch : undefined}
                pxClass="px-0.5"
                showFilters={showFilters}
                filterLoading={filterLoading}
                onApplyFilters={onApplyFilters}
            />
        </div>
    ) : null;

    const TABLE_SKELETON_ROWS = 8;
    const CELL_WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-1/3', 'w-4/5', 'w-3/5', 'w-2/5', 'w-3/4'];

    const tableSkeletonContent = (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
                <thead>
                    <tr>
                        {columns.map((col) => (
                            <th
                                key={col.key}
                                className="text-left font-medium py-2.5 px-4 border-b border-secondary-second bg-neutral-second whitespace-nowrap"
                            >
                                <div className="h-3.5 bg-secondary-second rounded animate-pulse w-20" />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {[...Array(TABLE_SKELETON_ROWS)].map((_, rowIdx) => (
                        <tr
                            key={rowIdx}
                            className={rowIdx % 2 === 1 ? 'bg-secondary-second/25' : 'bg-neutral-second'}
                        >
                            {columns.map((col, colIdx) => (
                                <td key={col.key} className="py-3 px-4 whitespace-nowrap align-middle">
                                    <div
                                        className={`h-3.5 bg-secondary-second rounded animate-pulse ${
                                            CELL_WIDTHS[(colIdx + rowIdx) % CELL_WIDTHS.length]
                                        }`}
                                    />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    if (view === 'list') {
        return (
            <div className="min-h-screen bg-secondary-first">
                {topBar}
                <div className="mx-7.5 mb-15">
                    <div className="bg-neutral-second rounded-[10px]">
                        {filterRow}
                        <div className="overflow-hidden rounded-b-[10px]">
                            {loading ? tableSkeletonContent : (
                                <DataTable
                                    items={items}
                                    columns={columns}
                                    onRowClick={onRowClick}
                                    sortBy={sortBy}
                                    onSortChange={onSortChange}
                                />
                            )}
                            <div
                                className={`h-6.25 rounded-b-[10px] ${
                                    items.length % 2 !== 0 ? 'bg-neutral-second' : 'bg-secondary-second/25'
                                }`}
                            >
                                &nbsp;
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Card view (compact)
    if (cardLayout === 'compact') {
        return (
            <div className="min-h-screen bg-secondary-first">
                {topBar}
                <div className="mx-7.5 mb-15">
                    <div className="bg-neutral-second rounded-[10px]">
                        {filterRow}
                        <div className="overflow-hidden rounded-b-[10px]">
                            {loading ? (
                                skeleton
                            ) : items.length === 0 ? (
                                emptyContent
                            ) : (
                                items.map((item, i) => renderCard(item, i))
                            )}
                            <div
                                className={`h-6.25 rounded-b-[10px] ${
                                    items.length % 2 !== 0 ? 'bg-neutral-second' : 'bg-secondary-second/25'
                                }`}
                            >
                                &nbsp;
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Card view (stacked)
    return (
        <div className="min-h-screen bg-secondary-first">
            {topBar}
            <div className="px-7.5 mb-15">
                {hasFilterRow && (
                    <div className="bg-neutral-second rounded-[10px] mb-4">
                        {filterRow}
                    </div>
                )}
                {loading ? (
                    <div className="space-y-4">
                        {skeleton}
                    </div>
                ) : items.length === 0 ? (
                    emptyContent
                ) : (
                    <div className="space-y-4">
                        {items.map((item, i) => renderCard(item, i))}
                    </div>
                )}
            </div>
        </div>
    );
}
