"use client";

import { BreadcrumbBar, PaginationBar } from "@/components/shared";
import { FilterBar } from "@/features/filter/components";
import { FilterConfig, FilterRule } from "@/features/filter/types";
import { SearchBar } from "@/components/ui";

interface TopBarProps {
    breadcrumb?: any[];
    showFilters?: boolean;
    showPagination?: boolean;

    showSearch?: boolean;
    searchValue?: string;
    searchPlaceholder?: string;
    onSearch?: (value: string) => void;
    pxClass?: string;

    showCapsule?: boolean;
    capsule?: React.ReactNode;

    actions?: React.ReactNode;

    subHeading?: string | React.ReactNode;
    showSubHeading?: boolean;


    pageStart?: number;
    pageEnd?: number;
    total?: number;

    onPrev?: () => void;
    onNext?: () => void;

    onFilters?: () => void;
    onApplyFilters?: (filters: FilterRule[]) => void;

    showAddNewButton?: boolean;
    onAddNewButton?: () => void;
    addNewButtonText?: string;

    showSecondaryButton?: boolean;
    secondaryButtonText?: string;
    onSecondaryButton?: () => void;

    appliedFilters?: FilterRule[];
    filterConfig?: FilterConfig[];
    filterLoading?: boolean;

    /** Rendered after the PaginationBar — use for the MoreMenu kebab */
    endActions?: React.ReactNode;

    /** Sit beside tabs instead of stretching across the page */
    embedded?: boolean;
}

export default function TopBar({
    breadcrumb = [],
    showSearch = false,
    searchValue = '',
    searchPlaceholder = 'Search',
    onSearch,
    pxClass,
    showFilters = true,
    showPagination = true,
    showCapsule = false,
    showSubHeading = false,
    subHeading,
    capsule,
    actions,
    pageStart,
    pageEnd,
    total,
    onPrev,
    onNext,
    onFilters,
    onApplyFilters,
    showAddNewButton = false,
    onAddNewButton,
    addNewButtonText = "Add New",
    showSecondaryButton = false,
    secondaryButtonText,
    onSecondaryButton,
    appliedFilters = [],
    filterConfig = [],
    filterLoading = false,
    endActions,
    embedded = false,
}: TopBarProps) {
    return (
        <div
            className={
                embedded
                    ? 'flex h-full w-full min-w-0 items-center justify-end'
                    : 'flex min-h-17.5 w-full items-center justify-center py-2'
            }
        >
            <div
                className={
                    embedded
                        ? 'flex w-full min-w-0 items-center justify-end'
                        : 'flex w-full flex-wrap items-start justify-between gap-3 px-3 sm:px-6 lg:px-7.5'
                }
            >
                {(!embedded || (breadcrumb && breadcrumb.length > 0) || showCapsule || (showSubHeading && subHeading)) && (
                <div className="flex min-w-0 max-w-full flex-1 items-start gap-4">
                    {breadcrumb && breadcrumb.length > 0 && (
                        <BreadcrumbBar breadcrumb={breadcrumb} />
                    )}

                    {showCapsule && capsule}

                    {showSubHeading && subHeading && (
                        <div className="text-[20px] text-primary-second font-medium">
                            {subHeading}
                        </div>
                    )}
                </div>
                )}
                <div
                    className={
                        embedded
                            ? 'flex w-full min-w-0 flex-wrap items-center justify-between gap-2 sm:w-auto sm:flex-nowrap sm:justify-end sm:gap-4'
                            : 'flex w-full flex-wrap items-center justify-end gap-2 sm:gap-4 xl:w-auto xl:shrink-0'
                    }
                >
                    {showSearch && onSearch && (
                        <div className="ml-auto shrink-0 border border-primary-second rounded-[10px] h-8.5 flex items-center bg-neutral-second">
                            <SearchBar
                                placeholder={searchPlaceholder}
                                category=""
                                searchValue={searchValue}
                                iconSize={16}
                                onSearch={onSearch}
                                pxClass={pxClass}
                                textClass="text-[16px]"
                            />
                        </div>
                    )}
                    {showFilters && (
                        <FilterBar
                            onFilters={onFilters}
                            onApplyFilters={onApplyFilters}
                            appliedFilters={appliedFilters}
                            filterConfig={filterConfig}
                            filterLoading={filterLoading}
                        />
                    )}

                    {showSecondaryButton && (
                        <button
                            onClick={onSecondaryButton}
                            className="h-8.5 px-6 bg-primary-first rounded-[10px] flex items-center gap-2 "
                        >
                            <span className="text-[16px] font-medium text-neutral-first truncate overflow-hidden whitespace-nowrap">
                                {secondaryButtonText}
                            </span>
                            <span className=" text-[20px] font-bold text-neutral-first leading-none">
                                +
                            </span>
                        </button>
                    )}

                    <div
                        className={
                            showAddNewButton && showPagination && onPrev && onNext
                                ? 'flex w-full min-w-0 items-center justify-between gap-2 sm:contents'
                                : 'contents'
                        }
                    >
                        {showAddNewButton && (
                            <button
                                onClick={onAddNewButton}
                                title={addNewButtonText}
                                className="flex h-8.5 min-w-0 max-w-full shrink items-center gap-2 overflow-hidden rounded-[10px] bg-primary-first px-3 sm:shrink-0 sm:px-6"
                            >
                                <span className="min-w-0 truncate overflow-hidden whitespace-nowrap text-[16px] font-medium text-neutral-first">
                                    {addNewButtonText}
                                </span>
                                <span className="shrink-0 text-[20px] font-bold leading-none text-neutral-first">
                                    +
                                </span>
                            </button>
                        )}

                        {actions}

                        {showPagination && onPrev && onNext && (
                            <div className="shrink-0">
                                <PaginationBar
                                    pageStart={pageStart ?? 0}
                                    pageEnd={pageEnd ?? 0}
                                    total={total ?? 0}
                                    onPrev={onPrev}
                                    onNext={onNext}
                                />
                            </div>
                        )}
                    </div>

                    {endActions}
                </div>
            </div>
        </div>
    );
}
