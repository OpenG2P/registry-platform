import { useMemo } from 'react';
import { useFetch } from '@/shared/hooks';
import type { AttributeValue, PaginationMeta } from '../types/attributes';

const ATTRIBUTE_VALUE_FETCH_SIZE = 500;

function normalizeParentId(parentValueId: string | null | undefined): string {
    return parentValueId?.trim() ?? '';
}

function filterValuesByParent(
    values: AttributeValue[],
    parentValueId: string | null | undefined,
): AttributeValue[] {
    const parent = normalizeParentId(parentValueId);
    if (!parent) {
        return values.filter(
            (value) => !value.parent_value_id || value.parent_value_id.trim() === '',
        );
    }
    return values.filter((value) => value.parent_value_id === parent);
}

function filterValuesBySearch(
    values: AttributeValue[],
    searchText?: string,
): AttributeValue[] {
    const query = searchText?.trim().toLowerCase();
    if (!query) return values;

    return values.filter(
        (value) =>
            value.value_code.toLowerCase().includes(query) ||
            value.value_display.toLowerCase().includes(query) ||
            value.value_id.toLowerCase().includes(query),
    );
}

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
    const normalizedSearch = searchText?.trim() ?? '';

    const fetchOptions = useMemo(
        () => ({
            method: 'POST' as const,
            body: JSON.stringify({
                current_page: 1,
                page_size: ATTRIBUTE_VALUE_FETCH_SIZE,
                attribute_id: attributeId,
                parent_value_id: '',
                search_text: normalizedSearch,
            }),
        }),
        [attributeId, normalizedSearch],
    );

    const { data, loading, error, execute } = useFetch<{
        attributeValues: AttributeValue[];
        pagination?: PaginationMeta;
    }>({
        url: '/api/configuration/attributes/get-attribute-values',
        enabled: !!attributeId,
        options: fetchOptions,
    });

    const allValues = data?.attributeValues ?? [];

    const filteredValues = useMemo(() => {
        const byParent = filterValuesByParent(allValues, parentValueId);
        return filterValuesBySearch(byParent, normalizedSearch);
    }, [allValues, parentValueId, normalizedSearch]);

    const effectivePage = page ?? 1;
    const effectivePageSize = pageSize ?? 20;

    const attributeValues = useMemo(() => {
        const start = (effectivePage - 1) * effectivePageSize;
        return filteredValues.slice(start, start + effectivePageSize);
    }, [filteredValues, effectivePage, effectivePageSize]);

    const pagination = useMemo(
        (): PaginationMeta => ({
            number_of_items: filteredValues.length,
            number_of_pages: Math.max(
                1,
                Math.ceil(filteredValues.length / effectivePageSize),
            ),
        }),
        [filteredValues.length, effectivePageSize],
    );

    return {
        attributeValues,
        allAttributeValues: allValues,
        pagination,
        loading,
        error,
        refresh: execute,
    };
}
