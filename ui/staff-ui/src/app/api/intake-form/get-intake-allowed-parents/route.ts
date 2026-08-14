import { NextRequest } from "next/server";
import { proxyToBackend } from "@/app/api/_lib/backend-proxy";

export async function POST(request: NextRequest) {
	return proxyToBackend({
		req: request,
		targetEndpoint: "/intake-form-data/get_intake_allowed_parents",
		buildPayload: (body) => ({
			pagination_request: {
				current_page: body.current_page ?? 1,
				page_size: body.page_size ?? 20,
				sort_by: body.sort_by ?? "",
				filter_by: body.filter_by ?? "",
				search_text: body.search_text ?? "",
			},
			request_payload: {
				submission_id: body.submission_id,
				section_register_id: body.section_register_id,
				form_register_id: body.form_register_id,
			},
		}),
		transformResponse: (responseBody) => ({
			records: responseBody?.response_payload?.allowed_parents ?? [],
			meta: responseBody?.response_payload ?? {},
			pagination: responseBody?.pagination_response,
		}),
	});
}
