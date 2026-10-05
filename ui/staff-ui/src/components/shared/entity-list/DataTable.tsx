'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ColumnDef, SortDir } from './types';

interface DataTableProps<T> {
    items: T[];
    columns: ColumnDef<T>[];
    onRowClick?: (item: T) => void;
    sortBy?: string | null;
    onSortChange?: (sortBy: string | null) => void;
    selectable?: boolean;
    selectedIds?: Set<string>;
    getItemId?: (item: T) => string;
    onToggleSelect?: (id: string) => void;
    onTogglePageSelect?: (ids: string[], selected: boolean) => void;
}

function parseSortBy(sortBy?: string | null): { key: string | null; dir: SortDir } {
    const trimmed = sortBy?.trim();
    if (!trimmed) return { key: null, dir: null };
    if (trimmed.startsWith('-')) return { key: trimmed.slice(1), dir: 'desc' };
    return { key: trimmed, dir: 'asc' };
}

function nextSortBy(current: string | null | undefined, key: string): string | null {
    const { key: activeKey, dir } = parseSortBy(current);
    if (activeKey !== key) return key;
    if (dir === 'asc') return `-${key}`;
    return null;
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
    return (
        <span className="inline-flex flex-col -space-y-1 ml-1.5 align-middle" aria-hidden="true">
            <ChevronUp
                strokeWidth={3}
                className={`size-3 transition-opacity ${active && dir === 'asc' ? 'opacity-100 text-primary-second' : 'opacity-30'}`}
            />
            <ChevronDown
                strokeWidth={3}
                className={`size-3 transition-opacity ${active && dir === 'desc' ? 'opacity-100 text-primary-second' : 'opacity-30'}`}
            />
        </span>
    );
}

export default function DataTable<T>({
    items,
    columns,
    onRowClick,
    sortBy,
    onSortChange,
    selectable = false,
    selectedIds,
    getItemId,
    onToggleSelect,
    onTogglePageSelect,
}: DataTableProps<T>) {
    const t = useTranslations();
    const isServerSort = typeof onSortChange === 'function';
    const [localSortBy, setLocalSortBy] = useState<string | null>(null);
    const activeSortBy = isServerSort ? sortBy : localSortBy;
    const { key: sortKey, dir: sortDir } = parseSortBy(activeSortBy);

    const fieldForColumn = (col: ColumnDef<T>) => col.sortKey ?? col.key;

    const cycleSort = (col: ColumnDef<T>) => {
        const next = nextSortBy(activeSortBy, fieldForColumn(col));
        if (isServerSort) {
            onSortChange(next);
            return;
        }
        setLocalSortBy(next);
    };

    const rows = isServerSort
        ? items
        : [...items].sort((a, b) => {
              if (!sortKey) return 0;
              const col = columns.find((c) => fieldForColumn(c) === sortKey);
              if (!col?.getValue) return 0;
              const av = String(col.getValue(a) ?? '').toLowerCase();
              const bv = String(col.getValue(b) ?? '').toLowerCase();
              if (av < bv) return sortDir === 'asc' ? -1 : 1;
              if (av > bv) return sortDir === 'asc' ? 1 : -1;
              return 0;
          });

    const pageIds = selectable && getItemId ? rows.map((item) => getItemId(item)) : [];
    const allPageSelected =
        pageIds.length > 0 && pageIds.every((id) => selectedIds?.has(id));
    const somePageSelected =
        pageIds.some((id) => selectedIds?.has(id)) && !allPageSelected;

    if (items.length === 0) {
        return (
            <div className="text-center py-10 text-neutral-first/50 text-[14px]">
                {t.has('no_items_found') ? t('no_items_found') : 'No items found'}
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
                <thead>
                    <tr>
                        {selectable ? (
                            <th className="w-10 py-2.5 px-4 border-b border-secondary-second bg-neutral-second sticky top-0">
                                <input
                                    type="checkbox"
                                    checked={allPageSelected}
                                    ref={(el) => {
                                        if (el) el.indeterminate = somePageSelected;
                                    }}
                                    onChange={(event) =>
                                        onTogglePageSelect?.(pageIds, event.target.checked)
                                    }
                                    className="size-4 accent-primary-second"
                                    aria-label={t.has('select_all') ? t('select_all') : 'Select all'}
                                />
                            </th>
                        ) : null}
                        {columns.map((col) => {
                            const isActive = sortKey === fieldForColumn(col);
                            const dir: SortDir = isActive ? sortDir : null;
                            return (
                                <th
                                    key={col.key}
                                    className={`text-left font-medium py-2.5 px-4 border-b border-secondary-second bg-neutral-second whitespace-nowrap sticky top-0 select-none ${
                                        isActive ? 'text-primary-second' : 'text-neutral-first/60'
                                    }`}
                                    aria-sort={
                                        isActive
                                            ? sortDir === 'asc'
                                                ? 'ascending'
                                                : 'descending'
                                            : 'none'
                                    }
                                >
                                    {col.sortable !== false ? (
                                        <button
                                            type="button"
                                            className="inline-flex items-center bg-transparent border-none p-0 font-[inherit] text-inherit cursor-pointer hover:text-neutral-first transition-colors"
                                            onClick={() => cycleSort(col)}
                                        >
                                            {col.header}
                                            <SortIcon active={isActive} dir={dir} />
                                        </button>
                                    ) : (
                                        col.header
                                    )}
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((item, rowIndex) => (
                        <tr
                            key={rowIndex}
                            onClick={() => onRowClick?.(item)}
                            className={`cursor-pointer ${
                                rowIndex % 2 === 1 ? 'bg-secondary-second/25' : 'bg-neutral-second'
                            }`}
                        >
                            {selectable && getItemId ? (
                                <td
                                    className="py-2.5 px-4 align-middle"
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedIds?.has(getItemId(item)) ?? false}
                                        onChange={() => onToggleSelect?.(getItemId(item))}
                                        className="size-4 accent-primary-second"
                                    />
                                </td>
                            ) : null}
                            {columns.map((col) => (
                                <td key={col.key} className="py-2.5 px-4 whitespace-nowrap align-middle">
                                    {col.render
                                        ? col.render(item)
                                        : String(col.getValue?.(item) ?? '—')}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
