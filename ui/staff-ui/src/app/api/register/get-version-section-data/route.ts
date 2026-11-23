import { NextRequest } from "next/server";
import { proxyToBackend } from "@/app/api/_lib/backend-proxy";

export async function POST(req: NextRequest) {
    return proxyToBackend({
        req,
        targetEndpoint: "/register-data/get_version_section_data",
        buildPayload: (body) => ({
            request_payload: {
                register_id: body.register_id,
                internal_record_id: body.internal_record_id,
                tab_id: body.tab_id,
                section_id: body.section_id,
                truncated_created_date: body.truncated_created_date,
                change_request_id: body.change_request_id,
                submission_id: body.submission_id,
            },
        }),
    });
}
