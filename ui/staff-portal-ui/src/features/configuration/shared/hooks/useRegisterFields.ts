import { useMemo } from 'react';
import { useFetch } from '@/shared/hooks';

export interface RegisterField {
    field_name: string;
    data_type: string;
    required: boolean;
    nullable: boolean;
}

type RegisterFieldsResponse = {
    register_id?: string;
    register_mnemonic?: string;
    fields?: RegisterField[];
    pagination?: {
        number_of_items: number;
        number_of_pages: number;
    };
    error?: string;
};

export function useRegisterFields(registerId: string) {
    const fetchOptions = useMemo(
        () => ({
            method: 'POST' as const,
            body: JSON.stringify({
                register_id: registerId,
                current_page: 1,
                page_size: 500,
            }),
        }),
        [registerId],
    );

    const { data, loading, error, execute } = useFetch<RegisterFieldsResponse>({
        url: '/api/register/get-register-fields',
        enabled: !!registerId,
        options: fetchOptions,
    });

    const fields = data?.error ? [] : data?.fields ?? [];

    return {
        fields,
        registerMnemonic: data?.register_mnemonic,
        loading,
        error: error ?? data?.error ?? null,
        refresh: execute,
    };
}
