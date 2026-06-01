'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
    ACTIVITY_THROTTLE_MS,
    AUTH_BROADCAST_CHANNEL,
    LAST_ACTIVITY_STORAGE_KEY,
    LOGOUT_EVENT_STORAGE_KEY,
    SESSION_CHECK_INTERVAL_MS,
} from '@/shared/constants/session';

type AuthBroadcastMessage =
    | { type: 'activity'; ts: number }
    | { type: 'logout'; ts: number };

function readLastActivity(): number {
    try {
        const raw = localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY);
        const ts = raw ? Number.parseInt(raw, 10) : NaN;
        return Number.isFinite(ts) ? ts : Date.now();
    } catch {
        return Date.now();
    }
}

function writeLastActivity(ts: number): void {
    try {
        localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(ts));
    } catch {
        // Private browsing or storage disabled — this tab still tracks activity locally.
    }
}

export function useInactivityLogout(
    onLogout: () => void,
    idleTimeoutMs: number,
    enabled = true,
): void {
    const onLogoutRef = useRef(onLogout);
    const lastRecordedActivityRef = useRef(0);
    const logoutTriggeredRef = useRef(false);

    useEffect(() => {
        onLogoutRef.current = onLogout;
    }, [onLogout]);

    const performLogout = useCallback(() => {
        if (logoutTriggeredRef.current) return;
        logoutTriggeredRef.current = true;
        onLogoutRef.current();
    }, []);

    const recordActivity = useCallback((ts: number = Date.now()) => {
        if (!enabled || idleTimeoutMs === 0) return;

        if (ts - lastRecordedActivityRef.current < ACTIVITY_THROTTLE_MS) {
            return;
        }
        lastRecordedActivityRef.current = ts;
        writeLastActivity(ts);

        try {
            const channel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
            channel.postMessage({ type: 'activity', ts } satisfies AuthBroadcastMessage);
            channel.close();
        } catch {
            // ignore
        }
    }, [enabled, idleTimeoutMs]);

    const checkIdle = useCallback(() => {
        if (!enabled || idleTimeoutMs === 0 || logoutTriggeredRef.current) return;

        const lastActivity = readLastActivity();
        if (Date.now() - lastActivity >= idleTimeoutMs) {
            performLogout();
        }
    }, [enabled, idleTimeoutMs, performLogout]);

    useEffect(() => {
        if (!enabled || idleTimeoutMs === 0) return;

        logoutTriggeredRef.current = false;
        recordActivity(Date.now());

        const activityEvents: (keyof WindowEventMap)[] = [
            'mousedown',
            'keydown',
            'scroll',
            'touchstart',
            'wheel',
        ];

        const onActivity = () => recordActivity();
        activityEvents.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkIdle();
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        const intervalId = window.setInterval(checkIdle, SESSION_CHECK_INTERVAL_MS);

        let channel: BroadcastChannel | null = null;
        try {
            channel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
            channel.onmessage = (event: MessageEvent<AuthBroadcastMessage>) => {
                const msg = event.data;
                if (!msg?.type) return;

                if (msg.type === 'activity') {
                    lastRecordedActivityRef.current = Math.max(
                        lastRecordedActivityRef.current,
                        msg.ts,
                    );
                    writeLastActivity(msg.ts);
                    return;
                }

                if (msg.type === 'logout') {
                    performLogout();
                }
            };
        } catch {
            // ignore
        }

        const onStorage = (event: StorageEvent) => {
            if (event.key === LAST_ACTIVITY_STORAGE_KEY && event.newValue) {
                const ts = Number.parseInt(event.newValue, 10);
                if (Number.isFinite(ts)) {
                    lastRecordedActivityRef.current = Math.max(
                        lastRecordedActivityRef.current,
                        ts,
                    );
                }
                return;
            }

            if (event.key === LOGOUT_EVENT_STORAGE_KEY && event.newValue) {
                performLogout();
            }
        };
        window.addEventListener('storage', onStorage);

        checkIdle();

        return () => {
            activityEvents.forEach((event) => window.removeEventListener(event, onActivity));
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.clearInterval(intervalId);
            window.removeEventListener('storage', onStorage);
            channel?.close();
        };
    }, [enabled, idleTimeoutMs, recordActivity, checkIdle, performLogout]);
}
