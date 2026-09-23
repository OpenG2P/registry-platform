import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../_lib/requireAuth';
import { getBackendConfig } from '../_lib/backend-config';

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
        const has = (suffix: string) => paths.some((p) => p.endsWith(suffix));

        return NextResponse.json({
            issuance: has('/vc/issue'),
            walletIssuance: has('/vc/wallet_offer'),
            verification: has('/vc/verify'),
        });
    } catch {
        // Never block the portal on this: an unreachable backend means the cards
        // render disabled, which is the same thing the agent would see anyway.
        return NextResponse.json(empty);
    }
}
