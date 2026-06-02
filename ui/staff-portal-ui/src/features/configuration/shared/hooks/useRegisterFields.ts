import { useFetch } from '@/shared/hooks';

export interface RegisterField {
    field_name: string;
    data_type: string;
    required: boolean;
    nullable: boolean;
}

export function useRegisterFields(registerId: string) {
    const { data, loading, error, execute } = useFetch<{
        register_id: string;
        register_mnemonic: string;
        fields: RegisterField[];
        pagination?: {
            number_of_items: number;
            number_of_pages: number;
        };
    }>({
        url: '/api/register/get-register-fields',
        enabled: !!registerId,
        options: {
            method: 'POST',
            body: JSON.stringify({
                register_id: registerId,
                current_page: 1,
                page_size: 100,
            }),
        },
    });

    return {
        fields: data?.fields || [],
        registerMnemonic: data?.register_mnemonic,
        loading,
        error,
        refresh: execute,
    };
}
