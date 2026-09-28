import { NextRequest, NextResponse } from "next/server";
import { proxyToBackend } from "@/app/api/_lib/backend-proxy";

/**
 * One proxy for the staff-api /activity endpoints. Only the listed actions are
 * forwarded; the client sends { payload, pagination? } and gets back
 * { data, pagination }.
 */
const ACTIONS = new Set([
    "get_activity_registers",
    "get_activity_types",
    "append_activity",
    "append_activities",
    "supersede_activity",
    "void_activity",
    "verify_activity",
    "reject_activity",
    "get_activity",
    "search_activities",
    "get_timeline",
    "search_contexts",
    "open_context",
    "close_context",
    "reopen_context",
    "get_work_list",
    "get_projection",
    "search_projections",
    "get_indicators",
    "compute_indicator",
    "lock_period",
    "unlock_period",
    "get_period_locks",
    "get_temporary_references",
    "resolve_temporary_reference",
    "rebuild_projections",
    "get_subject_activities",
    "get_latest_activity",
    "search_aggregates",
    "get_aggregate_history",
    "get_activity_type_schemas",
]);

export async function POST(req: NextRequest, context: { params: Promise<{ action: string }> }) {
    const { action } = await context.params;
    if (!ACTIONS.has(action)) {
        return NextResponse.json({ statusText: "Unknown activity action", code: 404 }, { status: 404 });
    }
    return proxyToBackend({
        req,
        targetEndpoint: `/activity/${action}`,
        buildPayload: (body) => ({
            pagination_request: body?.pagination ?? undefined,
            request_payload: body?.payload ?? {},
        }),
        transformResponse: (responseBody) => ({
            data: responseBody?.response_payload ?? null,
            pagination: responseBody?.pagination_response ?? null,
        }),
    });
}
