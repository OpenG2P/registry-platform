import "server-only";
import { NextRequest, NextResponse } from "next/server";

import { applyBackendSetCookies, jsonResponseFromBackend } from "./auth-cookies";
import { getBackendConfig } from "./backend-config";
import { requireAuth } from "./requireAuth";

/** Wrap a payload in the G2P request envelope the Agent Portal API expects. */
function envelope(payload: unknown, origin: string) {
    return {
        request_header: {
            sender_app_mnemonic: getBackendConfig().applicationMnemonic,
            sender_app_url: origin,
            request_id: crypto.randomUUID(),
            request_timestamp: new Date().toISOString(),
        },
        request_body: { request_payload: payload },
    };
}

/**
 * Backend paths of the Agent Portal API. Kept in one place because two things
 * depend on them: the proxy routes below, and the capability probe, which reads
 * the backend's OpenAPI document to find out which of these routes it mounted.
 */
export const AGENT_API = {
    getVcTypes: "/vc-issuance/get_vc_types",
    lookupBeneficiary: "/vc-issuance/lookup_beneficiary",
    startAuthentication: "/vc-issuance/start_authentication",
    getAuthenticationStatus: "/vc-issuance/get_authentication_status",
    issueVc: "/vc-issuance/issue_vc",
    createWalletOffer: "/vc-issuance/create_wallet_offer",
    verifyVc: "/vc-verification/verify_vc",
} as const;

export type AgentApiPath = (typeof AGENT_API)[keyof typeof AGENT_API];

/**
 * Proxy one Agent Portal API call, exactly as the staff portal proxies its
 * backend: the browser never holds a token, and this route reads the httpOnly
 * cookies server-side to build the backend's Authorization/Cookie/CSRF headers.
 */
export async function proxyToAgentApi(req: NextRequest, path: AgentApiPath) {
    const auth = requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const backendConfig = getBackendConfig();
    let payload: unknown = {};
    try {
        payload = await req.json();
    } catch {
        payload = {};
    }

    const res = await fetch(`${backendConfig.backendApiUrl}${path}`, {
        method: "POST",
        headers: auth.backendHeaders,
        body: JSON.stringify(envelope(payload, req.nextUrl.origin)),
        cache: "no-store",
    });

    return jsonResponseFromBackend(res);
}

/**
 * Issuance is the exception: on success the API replies with the PDF itself
 * rather than the JSON envelope, so the bytes are streamed through untouched
 * and the issuance headers are preserved for the client.
 */
export async function proxyIssue(req: NextRequest) {
    const auth = requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const backendConfig = getBackendConfig();
    let payload: unknown = {};
    try {
        payload = await req.json();
    } catch {
        payload = {};
    }

    const res = await fetch(`${backendConfig.backendApiUrl}${AGENT_API.issueVc}`, {
        method: "POST",
        headers: auth.backendHeaders,
        body: JSON.stringify(envelope(payload, req.nextUrl.origin)),
        cache: "no-store",
    });

    if (!res.ok || !(res.headers.get("content-type") || "").includes("application/pdf")) {
        return jsonResponseFromBackend(res);
    }

    const target = new NextResponse(await res.arrayBuffer(), {
        status: res.status,
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": res.headers.get("Content-Disposition") ?? "attachment; filename=\"credential.pdf\"",
            "X-Issuance-Id": res.headers.get("X-Issuance-Id") ?? "",
            "X-Credential-Id": res.headers.get("X-Credential-Id") ?? "",
            "X-Vc-Type": res.headers.get("X-Vc-Type") ?? "",
        },
    });
    applyBackendSetCookies(res, target);
    return target;
}
