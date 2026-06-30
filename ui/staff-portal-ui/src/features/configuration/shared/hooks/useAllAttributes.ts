import { useFetch } from '@/shared/hooks';
import type { Attribute, PaginationMeta } from '../types/attributes';

export function useAllAttributes(
    page?: number,
    pageSize?: number,
    searchText?: string,
) {
    const { data, loading, error, execute } = useFetch<{
        attributes: Attribute[];
        pagination?: PaginationMeta;
    }>({
        url: '/api/configuration/attributes/get-attributes',
        options: {
            method: 'POST',
            body: JSON.stringify({
                current_page: page,
                page_size: pageSize,
                search_text: searchText?.trim() ?? '',
            }),
        },
    });

    return {
        attributes: data?.attributes ?? [],
        pagination: data?.pagination,
        loading,
        error,
        refresh: execute,
    };
}
