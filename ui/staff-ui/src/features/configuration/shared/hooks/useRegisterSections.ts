import { useFetch } from '@/shared/hooks';

interface Section {
    section_id: string;
    section_mnemonic: string;
}

export function useRegisterSections(registerId: string) {
    const { data, loading, error, execute } = useFetch<{
        sections: Section[];
        pagination?: {
            number_of_items: number;
            number_of_pages: number;
        };
    }>({
        url: '/api/configuration/registers/section-metadata/get-all-sections',
        enabled: !!registerId,
        options: {
            method: 'POST',
            body: JSON.stringify({
                register_id: registerId,
                current_page: 1,
                page_size: 100,
            })
        }
    });

    return {
        sections: data?.sections || [],
        loading,
        error,
        refresh: execute
    };
}
