import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../_lib/requireAuth';
import { getBackendConfig } from '../_lib/backend-config';
import { AGENT_API } from '../_lib/agent-proxy';

/**
 * Which credential features this deployment actually has.
 *
 * Permissions alone cannot answer this. Wallet handover shares
 * `register:issue_credential` with paper issuance — deliberately, since it is the
 * same act — so an agent authorised to issue would always be shown a "hand to
 * wallet" card, even where the server has `walletIssuance` switched off. They
 * would click it and get a 404.
 *
 * The server already states the truth in its OpenAPI document: a route it did not
 * mount is not there. So this asks it, rather than inferring the answer from
 * configuration the browser cannot see.
 */
export async function GET(req: NextRequest) {
    const auth = requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const backendConfig = getBackendConfig();
    const empty = { issuance: false, walletIssuance: false, verification: false };

    try {
        const res = await fetch(`${backendConfig.backendApiUrl}/openapi.json`, {
            headers: auth.backendHeaders,
            cache: 'no-store',
        });
        if (!res.ok) return NextResponse.json(empty);

        const paths = Object.keys(((await res.json())?.paths ?? {}) as Record<string, unknown>);
        // Suffix match so a root_path the server may be mounted under still matches.
        const has = (path: string) => paths.some((p) => p.endsWith(path));

        return NextResponse.json({
            issuance: has(AGENT_API.issueVc),
            walletIssuance: has(AGENT_API.createWalletOffer),
            verification: has(AGENT_API.verifyVc),
        });
    } catch {
        // Never block the portal on this: an unreachable backend means the cards
        // render disabled, which is the same thing the agent would see anyway.
        return NextResponse.json(empty);
    }
}
