import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/app/api/_lib/backend-proxy';

export async function POST(request: NextRequest) {
    return proxyToBackend({
        req: request,
        targetEndpoint: '/awe/list_my_tasks',
        buildPayload: (body) => ({
            pagination_request: {
                current_page: body.page ?? body.current_page ?? 1,
                page_size: body.page_size ?? 25,
                sort_by: body.sort_by ?? '',
                filter_by: body.filter_by ?? '',
                search_text: body.search_text ?? '',
            },
            request_payload: {
                artifact_type: body.artifact_type ?? undefined,
                status: body.status ?? undefined,
            },
        }),
        transformResponse: (responseBody) => {
            const data = responseBody?.response_payload?.data;
            return {
                items: data?.items ?? [],
                total: data?.total ?? 0,
                page: data?.page ?? 1,
                page_size: data?.page_size ?? 25,
                pages: data?.pages ?? 1,
            };
        },
    });
}
