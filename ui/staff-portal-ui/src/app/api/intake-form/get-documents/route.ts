import { NextRequest } from "next/server";
import { proxyToBackend } from "@/app/api/_lib/backend-proxy";

export async function POST(request: NextRequest) {
    return proxyToBackend({
        req: request,
        targetEndpoint: "/documents/get_intake_form_documents",
        buildPayload: (body) => ({
            request_payload: {
                submission_id: body.submission_id,
            },
        }),
        transformResponse: (responseBody) => {
            const payload = responseBody.response_payload || {};
            return (payload.documents || []).map((doc: any) => ({
                ...doc,
                document_url: doc.presigned_url,
            }));
        },
    });
}
