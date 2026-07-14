import { NextRequest } from "next/server";
import { proxyToBackend } from "@/app/api/_lib/backend-proxy";

export async function POST(request: NextRequest) {
    return proxyToBackend({
        req: request,
        targetEndpoint: "/documents/upload_documents",
        transformResponse: (responseBody) => {
            const payload = responseBody.response_payload || {};
            // Backend may return uploaded_documents (change-request shape)
            // or documents (configuration shape) depending on the request context
            return payload.uploaded_documents ?? payload.documents ?? [];
        },
    });
}
