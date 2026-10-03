import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFetch } from '@/shared/hooks/useFetch';
import type { ExportQueueApiResponse, ExportQueueRecord } from '../types';
import { isExportInProgress } from '../utils';

const PAGE_SIZE = 20;
const POLL_MS = 10_000;

export function useExportQueue(enabled: boolean) {
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        if (enabled) setCurrentPage(1);
    }, [enabled]);

    const options = useMemo(() => ({
        method: 'POST' as const,
        body: JSON.stringify({
            current_page: currentPage,
            page_size: PAGE_SIZE,
        }),
    }), [currentPage]);

    const { data, loading, execute } = useFetch<ExportQueueApiResponse>({
        url: '/api/register/get-export-queue-records',
        enabled,
        options,
    });

    const records: ExportQueueRecord[] = data?.records ?? [];
    const paginationInfo = data?.pagination;

    const pagination = useMemo(() => {
        const total = paginationInfo?.number_of_items || 0;
        if (!total) {
            return { pageStart: 0, pageEnd: 0, total: 0 };
        }
        return {
            pageStart: (currentPage - 1) * PAGE_SIZE + 1,
            pageEnd: Math.min(currentPage * PAGE_SIZE, total),
            total,
        };
    }, [paginationInfo, currentPage]);

    const refresh = useCallback(async () => {
        await execute('/api/register/get-export-queue-records', options);
    }, [execute, options]);

    const hasInProgress = useMemo(
        () => records.some(isExportInProgress),
        [records],
    );

    useEffect(() => {
        if (!enabled || !hasInProgress) return;
        const timer = window.setInterval(() => {
            void execute('/api/register/get-export-queue-records', options);
        }, POLL_MS);
        return () => window.clearInterval(timer);
    }, [enabled, hasInProgress, execute, options]);

    const onPrev = useCallback(() => {
        setCurrentPage((page) => Math.max(1, page - 1));
    }, []);

    const onNext = useCallback(() => {
        const totalPages = paginationInfo?.number_of_pages ?? 1;
        setCurrentPage((page) => Math.min(totalPages, page + 1));
    }, [paginationInfo]);

    return {
        records,
        loading,
        pagination,
        refresh,
        onPrev,
        onNext,
        hasInProgress,
    };
}
