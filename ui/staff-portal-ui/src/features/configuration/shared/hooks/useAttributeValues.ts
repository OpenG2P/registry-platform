import { useFetch } from '@/shared/hooks';
import type { AttributeValue, PaginationMeta } from '../types/attributes';

export function valueHasChildren(
    valueId: string,
    values: AttributeValue[],
): boolean {
    return values.some((value) => value.parent_value_id === valueId);
}

export function useAttributeValues(
    attributeId?: string,
    page?: number,
    pageSize?: number,
    parentValueId?: string,
    searchText?: string,
) {
    const { data, loading, error, execute } = useFetch<{
        attributeValues: AttributeValue[];
        pagination?: PaginationMeta;
    }>({
        url: '/api/configuration/attributes/get-attribute-values',
        enabled: !!attributeId,
        options: {
            method: 'POST',
            body: JSON.stringify({
                current_page: page ?? 1,
                page_size: pageSize ?? 20,
                attribute_id: attributeId,
                parent_value_id: parentValueId ?? '',
                search_text: searchText?.trim() ?? '',
            }),
        },
    });

    return {
        attributeValues: data?.attributeValues ?? [],
        pagination: data?.pagination,
        loading,
        error,
        refresh: execute,
    };
}
