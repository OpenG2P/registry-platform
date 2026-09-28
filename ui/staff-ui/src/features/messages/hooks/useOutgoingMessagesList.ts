import { useCallback, useEffect, useState } from 'react';
import { useFetch } from '@/shared/hooks';
import { OutgoingMessage } from '@/features/messages/types';

interface UseOutgoingMessagesListOptions {
    pageSize?: number;
    initialPage?: number;
    searchText?: string;
    enabled?: boolean;
}

export function useOutgoingMessagesList({
    pageSize,
    initialPage = 1,
    searchText = '',
    enabled = true,
}: UseOutgoingMessagesListOptions) {
    const [currentPage, setCurrentPage] = useState(initialPage);

    useEffect(() => {
        setCurrentPage(1);
    }, [pageSize, searchText]);

    const { data, loading } = useFetch<any>({
        url: '/api/outgoing-message/get/list',
        enabled,
        options: {
            method: 'POST',
            body: JSON.stringify({
                current_page: currentPage,
                page_size: pageSize,
                search_text: searchText,
            }),
        },
    });

    const messages: OutgoingMessage[] = data?.messages ?? [];
    const paginationInfo = data?.pagination;

    const onPrev = useCallback(() => setCurrentPage(p => Math.max(1, p - 1)), []);

    const onNext = useCallback(() => {
        const totalPages = paginationInfo?.number_of_pages ?? 1;
        setCurrentPage(p => Math.min(totalPages, p + 1));
    }, [paginationInfo]);

    return {
        messages,
        loading,
        currentPage,
        pageSize,
        paginationInfo,
        setCurrentPage,
        onPrev,
        onNext,
    };
}
