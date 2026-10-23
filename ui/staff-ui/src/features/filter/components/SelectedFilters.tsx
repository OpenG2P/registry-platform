"use client";

import { useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { SlidersHorizontal } from "lucide-react";
import { FilterConfig, FilterRule } from "@/features/filter/types";
import { SearchBar } from "@/components/ui";
import { useTranslations } from "next-intl";
import { useClickOutside } from "@/shared/hooks/useClickOutside";
import FilterDropdown from "./FilterDropdown";

const OPERATOR_KEYS: Record<string, string> = {
    eq: "filter_operator_eq",
    neq: "filter_operator_neq",
    in: "filter_operator_in",
    nin: "filter_operator_nin",
    contains: "filter_operator_contains",
    ncontains: "filter_operator_ncontains",
    startsWith: "filter_operator_startsWith",
    endsWith: "filter_operator_endsWith",
    gt: "filter_operator_gt",
    gte: "filter_operator_gte",
    lt: "filter_operator_lt",
    lte: "filter_operator_lte",
    isNull: "filter_operator_isNull",
    between: "filter_operator_between",
};

const VISIBLE_FILTER_COUNT = 2;

interface SelectedFiltersProps {
    appliedFilters: FilterRule[];
    filterConfig: FilterConfig[];
    removeFilter: (index: number) => void;
    clearAllFilters: () => void;
    searchValue?: string;
    searchPlaceholder?: string;
    onSearch?: (value: string) => void;
    pxClass?: string;
    showFilters?: boolean;
    filterLoading?: boolean;
    onApplyFilters?: (filters: FilterRule[]) => void;
    leading?: ReactNode;
}

export default function SelectedFilters({
    appliedFilters,
    filterConfig,
    removeFilter,
    clearAllFilters,
    searchValue = '',
    searchPlaceholder,
    onSearch,
    pxClass,
    showFilters = false,
    filterLoading = false,
    onApplyFilters,
    leading,
}: SelectedFiltersProps) {
    const t = useTranslations();
    const resolvedSearchPlaceholder = searchPlaceholder || t('search');
    const [filterOpen, setFilterOpen] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);
    const moreRef = useRef<HTMLDivElement>(null);

    useClickOutside(filterRef, () => setFilterOpen(false), filterOpen);
    useClickOutside(moreRef, () => setMoreOpen(false), moreOpen);

    const handleApplyFilters = (filters: FilterRule[]) => {
        onApplyFilters?.(filters);
        setFilterOpen(false);
    };

    const getFilterLabel = (rule: FilterRule) => {
        const config = filterConfig.find((f) => f.field_name === rule.field_name);
        let valueLabel = rule.value;
        if (Array.isArray(rule.value)) {
            valueLabel = rule.value.join(' - ');
        } else if (config?.filter_type === 'dropdown' && config.options_source) {
            const option = config.options_source.find((o) => o.value === rule.value);
            valueLabel = option?.label || rule.value;
        } else if (config?.filter_type === 'boolean' && typeof rule.value === 'boolean') {
            valueLabel = rule.value ? t('true') : t('false');
        }

        return `${t(config?.display_label || '')}: ${t(OPERATOR_KEYS[rule.operator] ?? rule.operator)} ${valueLabel || ''}`;
    };

    const visibleFilters = appliedFilters.slice(0, VISIBLE_FILTER_COUNT);
    const hiddenCount = Math.max(0, appliedFilters.length - VISIBLE_FILTER_COUNT);

    const renderChip = (filter: FilterRule, index: number, truncate = false) => (
        <div
            key={`${filter.field_name}-${index}`}
            className="h-8.5 flex items-center bg-primary-first/25 rounded-[10px] px-3 gap-2 text-neutral-first/50 text-[14px] font-normal leading-normal max-w-full"
        >
            <span className={truncate ? 'truncate max-w-55' : ''} title={getFilterLabel(filter)}>
                {getFilterLabel(filter)}
            </span>
            <button
                type="button"
                onClick={() => {
                    removeFilter(index);
                    if (appliedFilters.length - 1 <= VISIBLE_FILTER_COUNT) {
                        setMoreOpen(false);
                    }
                }}
                aria-label={t('remove')}
                className="shrink-0"
            >
                <Image src="/images/common/close.png" width={16} height={16} alt={t('common.remove')} className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
        </div>
    );

    return (
        <div className="mb-2 flex flex-col gap-3 rounded-[10px] bg-neutral-second px-3 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4 sm:py-4">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 sm:gap-4">
                {leading ? (
                    <div className="flex shrink-0 items-center border-r border-secondary-second pr-4 -ml-1 sm:ml-0 lg:ml-2">
                        {leading}
                    </div>
                ) : null}
                <span className="shrink-0 pl-1 text-[14px] font-normal text-neutral-first sm:w-27.5 sm:text-[16px]" title={t('selected_filters')}>
                    {t('selected_filters')}
                </span>

                {appliedFilters.length === 0 ? (
                    <div className="h-8.5 flex items-center bg-primary-first/25 rounded-[10px] px-3 text-neutral-first/50 font-['Roboto'] text-[14px] not-italic font-normal leading-normal">
                        {t('none')}
                    </div>
                ) : (
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                        {visibleFilters.map((filter, index) => renderChip(filter, index, true))}
                        {hiddenCount > 0 ? (
                            <div className="relative shrink-0" ref={moreRef}>
                                <button
                                    type="button"
                                    onClick={() => setMoreOpen((open) => !open)}
                                    className="h-8.5 px-3 rounded-[10px] bg-primary-first/25 text-[14px] font-medium text-primary-second whitespace-nowrap"
                                >
                                    {t.has('n_more')
                                        ? t('n_more', { count: hiddenCount })
                                        : `+${hiddenCount} more`}
                                </button>
                                {moreOpen ? (
                                    <div className="absolute left-0 top-[calc(100%+8px)] z-50 flex max-h-72 w-[min(20rem,calc(100vw-2rem))] flex-col gap-2 overflow-y-auto modal-scroll rounded-[10px] border border-primary-second bg-neutral-second p-3 shadow-lg">
                                        {appliedFilters.slice(VISIBLE_FILTER_COUNT).map((filter, offset) =>
                                            renderChip(filter, offset + VISIBLE_FILTER_COUNT),
                                        )}
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                        <button
                            type="button"
                            onClick={() => {
                                setMoreOpen(false);
                                clearAllFilters();
                            }}
                            className="text-primary-second text-sm shrink-0 whitespace-nowrap"
                        >
                            {t('clear_all')}
                        </button>
                    </div>
                )}
            </div>

            {onSearch && (
                <div className="relative w-full shrink-0 sm:ml-auto sm:w-auto" ref={filterRef}>
                    <div className="flex h-8.5 w-full items-center rounded-[10px] border border-primary-second bg-neutral-second sm:w-[280px] lg:w-[360px]">
                        {showFilters && (
                            <button
                                type="button"
                                aria-label={t.has('filters') ? t('filters') : 'Filter'}
                                aria-expanded={filterOpen}
                                disabled={filterLoading}
                                onClick={() => setFilterOpen((open) => !open)}
                                className="h-full flex items-center pl-2.5 pr-2 border-r border-primary-second/40 text-neutral-first disabled:opacity-50"
                            >
                                <SlidersHorizontal size={16} strokeWidth={2.5} />
                            </button>
                        )}
                        <SearchBar
                            placeholder={resolvedSearchPlaceholder}
                            category=""
                            searchValue={searchValue}
                            iconSize={16}
                            iconClassName="h-3.5 w-3.5 sm:h-4 sm:w-4"
                            onSearch={onSearch}
                            pxClass={pxClass}
                            textClass="text-[16px]"
                        />
                    </div>

                    {filterOpen && !filterLoading && (
                        <>
                            <div className="absolute left-[12px] top-[calc(100%+8px-9px)] z-[60] bg-neutral-second border-t border-r border-primary-first w-[20px] h-[20px] -rotate-45 rounded-[2px] shadow-[0_0_4px_0_rgba(0,0,0,0.25)] [clip-path:polygon(-20px_-20px,_40px_-20px,_40px_40px)]" />
                            <div className="absolute inset-x-0 top-[calc(100%+8px)] z-50 w-full sm:inset-x-auto sm:right-0 sm:w-auto">
                                <div className="relative z-10">
                                    <FilterDropdown
                                        onApply={handleApplyFilters}
                                        onClose={() => setFilterOpen(false)}
                                        appliedFilters={appliedFilters}
                                        filterConfig={filterConfig}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
