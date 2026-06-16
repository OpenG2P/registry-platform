import createMiddleware from 'next-intl/middleware';
import { NextRequest } from 'next/server';

import { getServerEnv } from '@/app/api/_lib/env-config';
import { buildCspHeader } from '@/shared/utils/csp';
import { routing } from './i18n/routing';

export default function middleware(request: NextRequest) {
    const env = getServerEnv();
    const defaultLocale = env.defaultLocale || routing.defaultLocale;
    const handleRequest = createMiddleware({
        ...routing,
        defaultLocale: defaultLocale as any
    });

    const response = handleRequest(request);

    if (process.env.NODE_ENV !== 'development') {
        response.headers.set('Content-Security-Policy', buildCspHeader(env));
    }

    return response;
}

export const config = {
    matcher: ['/((?!api|_next|.*\\..*).*)']
};

