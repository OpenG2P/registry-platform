'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FilterRule } from '@/features/filter/types';
import type { ExportFormat, ExportScope } from '../types';

interface ExportRecordsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStart: (format: ExportFormat, scope: ExportScope) => void;
    submitting?: boolean;
    selectedCount: number;
    totalCount: number;
    initialScope?: ExportScope;
    searchQuery: string;
    appliedFilters: FilterRule[];
}

function RadioOption({
    name,
    value,
    checked,
    disabled,
    label,
    hint,
    onChange,
}: {
    name: string;
    value: string;
    checked: boolean;
    disabled?: boolean;
    label: string;
    hint?: string;
    onChange: () => void;
}) {
    return (
        <label
            className={`flex h-full items-start gap-3 rounded-[10px] border px-4 py-2.5 ${
                disabled
                    ? 'border-secondary-second text-neutral-first/40 cursor-not-allowed'
                    : checked
                        ? 'border-primary-second bg-primary-first/20 cursor-pointer'
                        : 'border-secondary-second cursor-pointer'
            }`}
        >
            <input
                type="radio"
                name={name}
                value={value}
                checked={checked}
                disabled={disabled}
                onChange={onChange}
                className="mt-1 accent-primary-second"
            />
            <span>
                <span className="block text-[15px] font-medium text-neutral-first">{label}</span>
                {hint ? (
                    <span className="block text-[13px] text-neutral-first/60 mt-0.5">{hint}</span>
                ) : null}
            </span>
        </label>
    );
}

export default function ExportRecordsModal({
    isOpen,
    onClose,
    onStart,
    submitting = false,
    selectedCount,
    totalCount,
    initialScope = 'all',
    searchQuery,
    appliedFilters,
}: ExportRecordsModalProps) {
    const t = useTranslations();
    const [format, setFormat] = useState<ExportFormat>('XLSX');
    const [scope, setScope] = useState<ExportScope>(initialScope);
    const hasSearchOrFilter = Boolean(searchQuery) || appliedFilters.length > 0;

    useEffect(() => {
        if (!isOpen) return;
        setFormat('XLSX');
        setScope(selectedCount > 0 ? initialScope : 'all');
    }, [isOpen, initialScope, selectedCount]);

    if (!isOpen) return null;

    const selectedDisabled = selectedCount === 0;
    const allScopeLabel = hasSearchOrFilter
        ? (t.has('export_all_filtered') ? t('export_all_filtered') : 'All filtered records')
        : (t.has('export_all_records') ? t('export_all_records') : 'All records');

    return (
        <>
            <div
                className="fixed inset-0 z-50 bg-neutral-first/50"
                onClick={onClose}
            />
            <div className="fixed inset-0 z-[51] flex items-center justify-center p-4 pointer-events-none">
                <div
                    className="pointer-events-auto w-full max-w-150 bg-neutral-second rounded-[10px] shadow-[0_24px_64px_rgba(0,0,0,0.28)] flex flex-col"
                    onClick={(event) => event.stopPropagation()}
                >
                    <div className="flex items-center justify-between px-5 py-3 border-b border-secondary-second shrink-0">
                        <h2 className="text-[20px] font-semibold text-primary-second">
                            {t.has('export_records') ? t('export_records') : 'Export Records'}
                        </h2>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-0 border-0 bg-transparent cursor-pointer opacity-60 hover:opacity-100"
                            aria-label={t.has('close') ? t('close') : 'Close'}
                        >
                            <X size={22} />
                        </button>
                    </div>

                    <div className="px-5 py-4 space-y-4">
                        <div>
                            <p className="text-[15px] font-medium text-neutral-first mb-2">
                                {t.has('export_scope') ? t('export_scope') : 'Export scope'}
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <RadioOption
                                    name="export-scope"
                                    value="all"
                                    checked={scope === 'all'}
                                    label={allScopeLabel}
                                    hint={
                                        t.has('export_total_count')
                                            ? t('export_total_count', { count: totalCount })
                                            : `${totalCount.toLocaleString()} records`
                                    }
                                    onChange={() => setScope('all')}
                                />
                                <RadioOption
                                    name="export-scope"
                                    value="selected"
                                    checked={scope === 'selected'}
                                    disabled={selectedDisabled}
                                    label={t.has('export_selected_only') ? t('export_selected_only') : 'Selected records'}
                                    hint={
                                        selectedCount > 0
                                            ? (t.has('export_selected_count')
                                                ? t('export_selected_count', { count: selectedCount })
                                                : `${selectedCount} records`)
                                            : undefined
                                    }
                                    onChange={() => setScope('selected')}
                                />
                            </div>
                        </div>

                        <div>
                            <p className="text-[15px] font-medium text-neutral-first mb-2">
                                {t.has('export_format') ? t('export_format') : 'Export format'}
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <RadioOption
                                    name="export-format"
                                    value="XLSX"
                                    checked={format === 'XLSX'}
                                    label={t.has('XLSX') ? t('XLSX') : 'XLSX'}
                                    onChange={() => setFormat('XLSX')}
                                />
                                <RadioOption
                                    name="export-format"
                                    value="ZIP_CSV"
                                    checked={format === 'ZIP_CSV'}
                                    label={t.has('ZIP_CSV') ? t('ZIP_CSV') : 'ZIP CSV'}
                                    onChange={() => setFormat('ZIP_CSV')}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 px-5 py-3 border-t border-secondary-second shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-9 px-4 rounded-[10px] bg-secondary-second text-[14px] font-medium text-neutral-first/70"
                        >
                            {t.has('cancel') ? t('cancel') : 'Cancel'}
                        </button>
                        <button
                            type="button"
                            onClick={() => onStart(format, scope)}
                            disabled={submitting || (scope === 'selected' && selectedDisabled)}
                            className="h-9 px-4 rounded-[10px] bg-primary-first text-[14px] font-medium text-neutral-first disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {t.has('export_start') ? t('export_start') : 'Start Export'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
