/** Shared across tabs via localStorage / BroadcastChannel. */
export const LAST_ACTIVITY_STORAGE_KEY = 'openg2p-staff-portal-last-activity';
export const LOGOUT_EVENT_STORAGE_KEY = 'openg2p-staff-portal-logout-event';
export const AUTH_BROADCAST_CHANNEL = 'openg2p-staff-portal-auth';

/** Default: 30 minutes of no user activity. Set via SESSION_IDLE_TIMEOUT_MS in .env. */
export const DEFAULT_SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export const SESSION_CHECK_INTERVAL_MS = 30 * 1000;
export const ACTIVITY_THROTTLE_MS = 5 * 1000;

export function parseSessionIdleTimeoutMs(raw: string | undefined): number {
    if (raw === undefined || raw === '') {
        return DEFAULT_SESSION_IDLE_TIMEOUT_MS;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return DEFAULT_SESSION_IDLE_TIMEOUT_MS;
    }
    return parsed;
}
