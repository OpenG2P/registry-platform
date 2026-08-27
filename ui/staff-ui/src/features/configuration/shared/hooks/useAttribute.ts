import { useFetch } from '@/shared/hooks';
import type { Attribute } from '../types/attributes';

export function useAttribute(attributeId?: string) {
    const { data, loading, error, execute } = useFetch<Attribute>({
        url: '/api/configuration/attributes/get-attribute',
        enabled: !!attributeId,
        options: {
            method: 'POST',
            body: JSON.stringify({
                current_page: 1,
                page_size: 1,
                attribute_id: attributeId,
            }),
        },
    });

    return {
        attribute: data,
        loading,
        error,
        refresh: execute,
    };
}
