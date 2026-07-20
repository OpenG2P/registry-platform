import { useFetch } from '@/shared/hooks';
import type { GeoLevel } from '../types/geo';

export function useGeoLevels(parentLevelId?: string, page = 1, pageSize = 500) {
    const { data, loading, error, execute } = useFetch<GeoLevel[]>({
        url: '/api/master-data/geo-levels',
        options: {
            method: 'POST',
            body: JSON.stringify({
                current_page: page,
                page_size: pageSize,
                sort_by: '',
                search_text: '',
                parent_level_id: parentLevelId ?? '',
            }),
        },
    });

    return {
        geoLevels: Array.isArray(data) ? data : [],
        loading,
        error,
        refresh: execute,
    };
}
