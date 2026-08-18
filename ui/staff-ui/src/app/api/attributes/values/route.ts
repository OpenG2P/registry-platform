
import { NextRequest } from "next/server";
import { proxyToBackend } from "@/app/api/_lib/backend-proxy";

export async function POST(req: NextRequest) {
	return proxyToBackend({
		req,
		backend: "masterdata",
		targetEndpoint: "/attributes/get_attribute_values",
		buildPayload: (body) => ({
			pagination_request: {
				current_page: body.current_page ?? 1,
				// A dropdown asks for a whole code list, not a page of one. At 20
				// a longer list was silently truncated — the widget rendered 20
				// options with nothing to say the rest existed, so a value simply
				// could not be chosen. Callers that do want paging still pass
				// page_size explicitly.
				page_size: body.page_size ?? 1000,
				sort_by: body.sort_by ?? "",
				filter_by: body.filter_by ?? "",
				search_text: body.search_text ?? "",
			},
			request_payload: {
				attribute_id: body.attribute_id,
				domain: body.domain,
				include_domains: body.include_domains ?? true,
			}
		}),
		transformResponse: (responseBody) =>
			responseBody?.response_payload?.attribute_values ?? [],
	});
}
