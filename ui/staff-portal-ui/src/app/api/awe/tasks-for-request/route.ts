import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/app/api/_lib/backend-proxy';

export async function POST(request: NextRequest) {
    return proxyToBackend({
        req: request,
        targetEndpoint: '/awe/list_tasks_for_request',
        buildPayload: (body) => ({
            pagination_request: {
                current_page: body.current_page ?? 1,
                page_size: body.page_size ?? 100,
                sort_by: body.sort_by ?? '',
                filter_by: body.filter_by ?? '',
                search_text: body.search_text ?? '',
            },
            request_payload: {
                request_id: body.request_id,
            },
        }),
        transformResponse: (responseBody) => {
            const data = responseBody?.response_payload?.data;
            const items = data?.items ?? [];
            return {
                tasks: items,
                total: data?.total ?? items.length,
            };
        },
    });
}
