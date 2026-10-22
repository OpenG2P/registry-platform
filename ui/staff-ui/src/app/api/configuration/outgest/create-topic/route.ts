import { NextRequest } from "next/server";
import { proxyToBackend } from "@/app/api/_lib/backend-proxy";

export async function POST(req: NextRequest) {
    return proxyToBackend({
        req,
        targetEndpoint: "/outgestion-config/create_topic",
        buildPayload: (body) => {
            const isPartner = body.topic_type === 'PARTNER';
            return {
                pagination_request: {
                    current_page: body.current_page ?? 1,
                    page_size: body.page_size ?? 20,
                    sort_by: body.sort_by ?? "",
                    filter_by: body.filter_by ?? "",
                    search_text: body.search_text ?? "",
                },
                request_payload: {
                    topic_type: body.topic_type,
                    register_id: isPartner ? null : body.register_id,
                    data_model_id: isPartner ? null : body.data_model_id,
                    partner_id: isPartner ? body.partner_id : null,
                    websub_topic: body.websub_topic ?? "",
                    description: body.description ?? "",
                },
            };
        },
    });
}
