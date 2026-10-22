import { NextRequest } from "next/server";
import { proxyToBackend } from "@/app/api/_lib/backend-proxy";

export async function POST(req: NextRequest) {
    return proxyToBackend({
        req,
        targetEndpoint: "/outgestion-config/update_topic",
        buildPayload: (body) => {
            const isPartner = body.topic_type === 'PARTNER';
            return {
                request_payload: {
                    topic_id: body.topic_id,
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
