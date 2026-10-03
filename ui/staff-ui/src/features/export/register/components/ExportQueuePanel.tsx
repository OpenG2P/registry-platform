'use client';

import { useState } from 'react';
import { Loader2, RefreshCw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PaginationBar } from '@/components/shared';
import { formatDateTime, formatDuration } from '@/shared/utils/dateUtils';
import type { ExportQueueRecord } from '../types';
import {
    isDownloadExpired,
    isExportInProgress,
} from '../utils';

interface ExportQueuePanelProps {
    isOpen: boolean;
    onClose: () => void;
    records: ExportQueueRecord[];
    loading: boolean;
    pageStart: number;
    pageEnd: number;
    total: number;
    onPrev: () => void;
    onNext: () => void;
    onRefresh: () => void | Promise<void>;
    onExportRecords: () => void;
    onRetry: (record: ExportQueueRecord) => void;
    onDownload: (url: string) => void;
}

const TH_CLASS =
    'text-left font-medium py-2.5 px-4 border-b border-secondary-second bg-neutral-second whitespace-nowrap sticky top-0 text-neutral-first/60';
const TD_CLASS = 'py-2.5 px-4 whitespace-nowrap align-middle';

function rowTone(index: number): string {
    return index % 2 === 0 ? 'bg-secondary-second/25' : 'bg-neutral-second';
}

function statusClass(status: string): string {
    switch (status.toUpperCase()) {
        case 'COMPLETED':
            return 'bg-toast-success/15 text-toast-success';
        case 'FAILED':
            return 'bg-toast-failed/15 text-toast-failed';
        case 'EXPIRED':
            return 'bg-neutral-first/10 text-neutral-first/50';
        default:
            return 'bg-amber-500/15 text-amber-600';
    }
}

export default function ExportQueuePanel({
    isOpen,
    onClose,
    records,
    loading,
    pageStart,
    pageEnd,
    total,
    onPrev,
    onNext,
    onRefresh,
    onExportRecords,
    onRetry,
    onDownload,
}: ExportQueuePanelProps) {
    const t = useTranslations();
    const [refreshing, setRefreshing] = useState(false);

    if (!isOpen) return null;

    const columns = [
        t.has('export_format') ? t('export_format') : 'Format',
        t.has('status') ? t('status') : 'Status',
        t.has('created_at') ? t('created_at') : 'Created at',
        t.has('total_time_taken') ? t('total_time_taken') : 'Total time taken',
        t.has('records_exported') ? t('records_exported') : 'Records',
        t.has('action') ? t('action') : 'Action',
    ];

    const tableHead = (
        <thead>
            <tr>
                {columns.map((header) => (
                    <th key={header} className={TH_CLASS}>
                        {header}
                    </th>
                ))}
            </tr>
        </thead>
    );

    const tableFooter = (rowCount: number) => (
        <div className={`h-6.25 ${rowTone(rowCount)}`}>&nbsp;</div>
    );

    const labelFor = (value: string) => (t.has(value) ? t(value) : value);

    const handleRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        const startedAt = Date.now();
        try {
            await onRefresh();
        } finally {
            const elapsed = Date.now() - startedAt;
            const remaining = 400 - elapsed;
            if (remaining > 0) {
                await new Promise((resolve) => window.setTimeout(resolve, remaining));
            }
            setRefreshing(false);
        }
    };

    return (
        <>
            <div
                className="fixed inset-0 z-50 bg-neutral-first/50"
                onClick={onClose}
            />
            <div className="fixed inset-0 z-[51] flex items-center justify-center p-4 pointer-events-none">
                <div
                    className="pointer-events-auto w-full max-w-5xl max-h-[92vh] bg-neutral-second rounded-[10px] shadow-[0_24px_64px_rgba(0,0,0,0.28)] flex flex-col"
                    onClick={(event) => event.stopPropagation()}
                >
                    <div className="flex items-center justify-between px-5 py-4 border-b border-secondary-second shrink-0">
                        <h2 className="text-[20px] font-semibold text-primary-second">
                            {t.has('export_history')
                                ? t('export_history')
                                : 'Export History'}
                        </h2>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => void handleRefresh()}
                                disabled={refreshing}
                                aria-busy={refreshing}
                                className="h-8.5 px-4 rounded-[10px] bg-primary-first text-[14px] font-medium text-neutral-first flex items-center gap-2 disabled:opacity-80"
                            >
                                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                                {refreshing
                                    ? (t.has('refreshing') ? t('refreshing') : 'Refreshing')
                                    : (t.has('refresh') ? t('refresh') : 'Refresh')}
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-0 border-0 bg-transparent cursor-pointer opacity-60 hover:opacity-100"
                                aria-label={t.has('close') ? t('close') : 'Close'}
                            >
                                <X size={22} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto modal-scroll">
                        {loading && records.length === 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-[14px]">
                                    {tableHead}
                                    <tbody>
                                        {[0, 1, 2, 3, 4, 5, 6, 7].map((row) => (
                                            <tr key={row} className={rowTone(row)}>
                                                <td className={TD_CLASS}>
                                                    <div className="h-5 w-14 rounded-full bg-secondary-second animate-pulse" />
                                                </td>
                                                <td className={TD_CLASS}>
                                                    <div className="h-5 w-20 rounded-full bg-secondary-second animate-pulse" />
                                                </td>
                                                <td className={TD_CLASS}>
                                                    <div className="h-3.5 w-28 bg-secondary-second rounded animate-pulse" />
                                                </td>
                                                <td className={TD_CLASS}>
                                                    <div className="h-3.5 w-16 bg-secondary-second rounded animate-pulse" />
                                                </td>
                                                <td className={TD_CLASS}>
                                                    <div className="h-3.5 w-10 bg-secondary-second rounded animate-pulse" />
                                                </td>
                                                <td className={TD_CLASS}>
                                                    <div className="h-3.5 w-16 bg-secondary-second rounded animate-pulse" />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {tableFooter(8)}
                            </div>
                        ) : records.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center px-5">
                                <p className="text-[16px] text-neutral-first/60 mb-4">
                                    {t.has('export_no_exports_yet')
                                        ? t('export_no_exports_yet')
                                        : 'No exports yet.'}
                                </p>
                                <button
                                    type="button"
                                    onClick={onExportRecords}
                                    className="h-8.5 px-6 bg-primary-first rounded-[10px] text-[15px] font-medium"
                                >
                                    {t.has('export_records') ? t('export_records') : 'Export Records'}
                                </button>
                            </div>
                        ) : (
                            <div className={`overflow-x-auto transition-opacity ${refreshing ? 'opacity-50' : ''}`}>
                                <table className="w-full border-collapse text-[14px]">
                                    {tableHead}
                                    <tbody>
                                        {records.map((record, index) => {
                                            const status = record.export_status || '';
                                            const expired = isDownloadExpired(record);
                                            const inProgress = isExportInProgress(record);
                                            const completed = status.toUpperCase() === 'COMPLETED';
                                            const failed = status.toUpperCase() === 'FAILED';

                                            return (
                                                <tr key={record.export_id} className={rowTone(index)}>
                                                    <td className={TD_CLASS}>
                                                        <span className="inline-flex px-2 py-0.5 rounded-full text-[12px] font-medium bg-primary-first">
                                                            {labelFor(String(record.export_format))}
                                                        </span>
                                                    </td>
                                                    <td className={TD_CLASS}>
                                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[12px] font-medium ${statusClass(status)}`}>
                                                            {inProgress ? <Loader2 size={12} className="animate-spin" /> : null}
                                                            {labelFor(status)}
                                                        </span>
                                                        {failed && record.export_latest_error_code ? (
                                                            <p className="text-[12px] text-toast-failed mt-1">
                                                                {record.export_latest_error_code}
                                                            </p>
                                                        ) : null}
                                                    </td>
                                                    <td className={TD_CLASS}>
                                                        {formatDateTime(record.queued_at, '—')}
                                                    </td>
                                                    <td className={TD_CLASS}>
                                                        {formatDuration(record.queued_at, record.export_latest_timestamp)}
                                                    </td>
                                                    <td className={TD_CLASS}>
                                                        {record.total_records_exported ?? '—'}
                                                    </td>
                                                    <td className={TD_CLASS}>
                                                        {completed && record.file_presigned_url && !expired ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => onDownload(record.file_presigned_url as string)}
                                                                className="text-primary-second font-medium underline"
                                                            >
                                                                {t.has('download') ? t('download') : 'Download'}
                                                            </button>
                                                        ) : null}
                                                        {completed && expired ? (
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-neutral-first/50">
                                                                    {t.has('download_expired')
                                                                        ? t('download_expired')
                                                                        : 'Download expired'}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onRetry(record)}
                                                                    className="text-primary-second font-medium underline text-left"
                                                                >
                                                                    {t.has('export_again') ? t('export_again') : 'Export Again'}
                                                                </button>
                                                            </div>
                                                        ) : null}
                                                        {failed ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => onRetry(record)}
                                                                className="text-primary-second font-medium underline"
                                                            >
                                                                {t.has('retry_export') ? t('retry_export') : 'Retry Export'}
                                                            </button>
                                                        ) : null}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {tableFooter(records.length)}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end px-5 py-3 border-t border-secondary-second shrink-0">
                        <PaginationBar
                            pageStart={pageStart}
                            pageEnd={pageEnd}
                            total={total}
                            onPrev={onPrev}
                            onNext={onNext}
                        />
                    </div>
                </div>
            </div>
        </>
    );
}
