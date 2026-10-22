'use client';

import React from 'react';

export type Column<T> = {
    key: keyof T | string;
    label: string;
    render?: (item: T) => React.ReactNode;
};

interface Props<T> {
    columns: Column<T>[];
    data: T[];
    loading?: boolean;
    rowKey: (item: T) => string;
    actions?: (item: T) => React.ReactNode;
    onRowClick?: (item: T) => void;
    embedded?: boolean;
}

export default function DataTable<T>({
    columns,
    data,
    loading,
    rowKey,
    actions,
    onRowClick,
    embedded = false,
}: Props<T>) {
    const gridCols = columns.length + (actions ? 1 : 0);
    const gridStyle = {
        gridTemplateColumns: actions
            ? `repeat(${columns.length}, minmax(0, 1fr)) minmax(max-content, 1fr)`
            : `repeat(${gridCols}, minmax(0, 1fr))`,
    };
    const gridMinWidth = `calc(${gridCols} * 12rem + ${Math.max(gridCols - 1, 0)} * 1rem)`;

    return (
        <div className={`${embedded ? 'mx-0' : 'mx-3 sm:mx-6 lg:mx-7.5'} overflow-hidden rounded-[10px] bg-neutral-second py-4`}>
            <div className="overflow-x-auto">
                <div style={{ minWidth: gridMinWidth }}>
                    <div
                        className="grid gap-4 px-4 pb-2 sm:px-8 lg:px-12"
                        style={gridStyle}
                    >
                        {columns.map((col) => (
                            <div
                                key={String(col.key)}
                                className="py-3 text-left text-base font-semibold text-primary-second"
                            >
                                {col.label}
                            </div>
                        ))}

                        {actions && (
                            <div className="py-3 text-left text-base font-semibold text-primary-second">
                                Actions
                            </div>
                        )}
                    </div>

                    {loading ? (
                        <div className="flex justify-center items-center py-60">
                            <img
                                src="/images/common/loading.gif"
                                className="w-12 h-12"
                                alt="Loading"
                            />
                        </div>
                    ) : (
                        data.map((item, index) => (
                            <div
                                key={rowKey(item)}
                                onClick={() => onRowClick?.(item)}
                                className={`grid min-h-15 items-center gap-4 px-4 py-2 sm:px-8 lg:px-12 ${index % 2 === 0 ? 'bg-secondary-second/25' : 'bg-neutral-second'} ${onRowClick ? 'cursor-pointer' : ''}`}
                                style={gridStyle}
                            >
                                {columns.map((col) => {
                                    const value = col.render
                                        ? col.render(item)
                                        : (item as any)[col.key] ?? '-';

                                    return (
                                        <div
                                            key={String(col.key)}
                                            className="min-w-0 truncate text-[16px] font-medium"
                                            title={typeof value === 'string' ? value : undefined}
                                        >
                                            {value}
                                        </div>
                                    );
                                })}

                                {actions && (
                                    <div className="flex shrink-0 items-center gap-2 sm:gap-6">
                                        {actions(item)}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}