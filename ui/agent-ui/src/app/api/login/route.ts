import { NextRequest, NextResponse } from 'next/server';
import { getBackendConfig } from '../_lib/backend-config';

// Identical to the staff portal's /api/login: this BFF asks IAM to start an
// authentication transaction and forwards the browser to the provider. The
// browser never talks to Keycloak directly and never sees a client secret.
export async function GET(req: NextRequest) {
    const redirectUri = req.nextUrl.searchParams.get('redirect_uri') || '/';

    const backendConfig = getBackendConfig();
    const iamUrl = `${backendConfig.iamUrl}${'/auth/start_authentication_transaction'}`;

    const url = `${iamUrl}?id=${backendConfig.loginProviderId}&redirect_uri=${encodeURIComponent(redirectUri)}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { accept: 'application/json' },
        body: '',
    });

    const data = await res.json();

    if (!data.redirectUrl) {
        return NextResponse.json({ error: 'Failed to initiate auth' }, { status: 500 });
    }

    return NextResponse.redirect(data.redirectUrl);
}
