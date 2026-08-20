import { ReactNode } from 'react';
import { FilterConfig, FilterRule } from '@/features/filter/types';

export type ViewMode = 'card' | 'list';
export type SortDir = 'asc' | 'desc' | null;

export interface ColumnDef<T> {
    key: string;
    header: string;
    getValue?: (item: T) => string | number | null | undefined;
    render?: (item: T) => ReactNode;
    sortable?: boolean;
    sortKey?: string;
}

export interface EntityListPageProps<T> {
    breadcrumb: { label: string; href?: string }[];

    showPagination?: boolean;
    pageStart?: number;
    pageEnd?: number;
    total?: number;
    onPrev?: () => void;
    onNext?: () => void;

    defaultView?: ViewMode;
    viewStorageKey?: string;

    showSearch?: boolean;
    searchValue?: string;
    searchPlaceholder?: string;
    onSearch?: (value: string) => void;

    showFilters?: boolean;
    appliedFilters?: FilterRule[];
    filterConfig?: FilterConfig[];
    filterLoading?: boolean;
    onApplyFilters?: (filters: FilterRule[]) => void;
    removeFilter?: (index: number) => void;
    clearAllFilters?: () => void;

    items: T[];
    loading?: boolean;
    emptyMessage?: ReactNode;
    skeleton?: ReactNode;

    renderCard: (item: T, index: number) => ReactNode;
    cardLayout?: 'compact' | 'stacked';

    columns: ColumnDef<T>[];
    onRowClick?: (item: T) => void;

    sortBy?: string | null;
    onSortChange?: (sortBy: string | null) => void;

    actions?: ReactNode;
}
