import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../_lib/requireAuth';
import { getBackendConfig } from '../_lib/backend-config';
import { jsonResponseFromBackend } from '../_lib/auth-cookies';

// Same as the staff portal's /api/permissions, with one difference that is
// forced: user-access lives ONLY on iam-staff-portal-api, so this asks the
// staff IAM even though login went through the agent IAM. The registry's Agent
// Portal API resolves permissions the same way (auth_provider_api_url).
//
// The mnemonic must equal the Keycloak client id the roles sit under: IAM reads
// the user's roles as resource_access[application_mnemonic], then looks up the
// IAM application registered under that same mnemonic. Both halves must exist,
// or it returns [] with a 200 and the portal silently refuses to issue.
export async function GET(req: NextRequest) {
    const auth = requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const backendConfig = getBackendConfig();
    const url =
        `${backendConfig.authProviderApiUrl}/user-access/get_application_permissions_for_user` +
        `?application_mnemonic=${encodeURIComponent(backendConfig.applicationMnemonic)}`;

    const res = await fetch(url, {
        method: 'GET',
        headers: auth.backendHeaders,
        cache: 'no-store',
    });

    return jsonResponseFromBackend(res);
}
