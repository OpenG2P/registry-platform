import { NextRequest } from "next/server";
import { proxyToBackend } from "@/app/api/_lib/backend-proxy";

export async function POST(request: NextRequest) {
    return proxyToBackend({
        req: request,
        targetEndpoint: "/documents/get_documents",
        buildPayload: (body) => ({
            request_payload: {
                document_ids: body.document_ids ?? [],
            },
        }),
        transformResponse: (responseBody) => {
            const payload = responseBody.response_payload || {};
            return payload.documents || [];
        },
    });
}
