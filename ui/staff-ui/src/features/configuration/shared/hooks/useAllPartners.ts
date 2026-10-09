import { useFetch } from '@/shared/hooks';

export interface Partner {
    id: string;
    partner_id: string;
    name: string;
    org_name: string;
    description: string;
    status: string;
}

export function useAllPartners() {
    const { data, loading, error, execute } = useFetch<{
        count: number;
        partners: Partner[];
    }>({
        url: '/api/partners?status=active',
        options: { method: 'GET' },
    });

    return {
        partners: data?.partners || [],
        loading,
        error,
        refresh: execute,
    };
}
