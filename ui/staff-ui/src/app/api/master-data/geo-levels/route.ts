import { NextRequest } from "next/server";
import { proxyToBackend } from "@/app/api/_lib/backend-proxy";

interface CatalogueGeoLevel {
	level_id?: unknown;
	level_mnemonic?: unknown;
	parent_level_id?: unknown;
	display?: unknown;
	display_i18n?: unknown;
}

/**
 * The geography's levels from Master Data's catalogue (POST /catalogue/get_geo_levels),
 * at the version in effect — the levels a register form's location widget offers.
 * Registers do not pin level names or depth in their metadata; they read them here.
 *
 * Returned as a flat list of {level_id, level_mnemonic, parent_level_id, display,
 * display_i18n}. A parent that is not itself in the list is returned as null, so the
 * top level reads as the root.
 */
export async function POST(req: NextRequest) {
	return proxyToBackend({
		req,
		backend: "masterdata",
		targetEndpoint: "/catalogue/get_geo_levels",
		buildPayload: (body) => ({
			pagination_request: undefined,
			request_payload: body?.release
				? { release: body.release }
				: body?.as_of
					? { as_of: body.as_of }
					: { version: body?.version ?? "latest" },
		}),
		transformResponse: (responseBody) => {
			const levels: CatalogueGeoLevel[] = Array.isArray(responseBody?.response_payload?.levels)
				? responseBody.response_payload.levels
				: [];
			const ids = new Set(levels.map((level) => String(level.level_id ?? "")));
			return levels
				.filter((level) => typeof level.level_id === "string" && level.level_id !== "")
				.map((level) => {
					const parent = typeof level.parent_level_id === "string" ? level.parent_level_id : "";
					return {
						level_id: String(level.level_id),
						level_mnemonic: String(level.level_mnemonic ?? level.level_id),
						parent_level_id: parent && ids.has(parent) ? parent : null,
						display: typeof level.display === "string" ? level.display : null,
						display_i18n: level.display_i18n ?? null,
					};
				});
		},
	});
}
