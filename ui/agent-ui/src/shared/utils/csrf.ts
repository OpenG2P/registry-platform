// The agent portal's cookies carry the `agent-` prefix set by
// IAM_AGENT_AUTH_COOKIE_PREFIX. Staff keeps the unprefixed names; the two
// portals share a parent cookie domain, so identical names would mean the
// browser sends each portal the other's session.
export const CSRF_COOKIE_NAME = 'agent-X-CSRF-Token';
// The HEADER name is fixed in iam_core's CsrfMiddleware and is NOT prefixed.
export const CSRF_HEADER_NAME = 'X-CSRF-Token';

export function getCsrfTokenFromDocument(): string | undefined {
    if (typeof document === 'undefined') {
        return undefined;
    }
    const escaped = CSRF_COOKIE_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : undefined;
}

export function csrfHeaders(): Record<string, string> {
    const token = getCsrfTokenFromDocument();
    return token ? { [CSRF_HEADER_NAME]: token } : {};
}
