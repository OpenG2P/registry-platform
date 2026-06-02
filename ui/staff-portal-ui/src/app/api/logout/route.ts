import { NextResponse } from 'next/server';
import { getBackendConfig } from '../_lib/backend-config';

export async function GET() {
    const backendConfig = getBackendConfig();

    return NextResponse.redirect(`${backendConfig.iamUrl}/auth/logout`);
}
