import { NextRequest } from "next/server";
import { proxyToBackend } from "@/app/api/_lib/backend-proxy";

export async function POST(request: NextRequest) {
    return proxyToBackend({
        req: request,
        targetEndpoint: "/documents/upload_documents",
        transformResponse: (responseBody) => {
            const payload = responseBody.response_payload || {};
            return payload.documents || [];
        },
    });
}
