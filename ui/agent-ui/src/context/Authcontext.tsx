'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';

/** Permission an agent must hold to issue. Mirrors ISSUE_PERMISSION on the API. */
export const ISSUE_PERMISSION = 'register:issue_credential';

interface AuthContextType {
    isLoggedIn: boolean;
    user: any | null;
    canIssue: boolean;
    logout: () => void;
    handleUnauthorized: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [user, setUser] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const logout = useCallback(() => {
        setIsLoggedIn(false);
        setUser(null);
        window.location.href = '/api/logout';
    }, []);

    const handleUnauthorized = useCallback(() => {
        setIsLoggedIn(false);
        setUser(null);
        window.location.href = `/api/login?redirect_uri=${encodeURIComponent(window.location.href)}`;
    }, []);

    useEffect(() => {
        async function initAuth() {
            try {
                const res = await fetch('/api/me', { cache: 'no-store' });

                if (res.status === 401 || res.status === 403) {
                    // No session (or it expired): start the login transaction.
                    handleUnauthorized();
                    return;
                }

                if (!res.ok) {
                    setIsLoggedIn(false);
                    setIsLoading(false);
                    return;
                }

                const profile = await res.json();
                setUser(profile);
                setIsLoggedIn(true);
            } catch {
                setIsLoggedIn(false);
            } finally {
                setIsLoading(false);
            }
        }
        initAuth();
    }, [handleUnauthorized]);

    const roles: string[] = (() => {
        // The logged-in user carries its permissions/roles; accept either shape
        // rather than assuming one, since IAM enriches this server-side.
        const candidates = [user?.permissions, user?.roles, user?.client_roles];
        for (const c of candidates) {
            if (Array.isArray(c)) return c as string[];
        }
        return [];
    })();

    const canIssue = roles.includes(ISSUE_PERMISSION);

    if (isLoading) {
        return <p className="muted" style={{ padding: '2rem' }}>Signing in…</p>;
    }

    return (
        <AuthContext.Provider value={{ isLoggedIn, user, canIssue, logout, handleUnauthorized }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used inside AuthProvider');
    }
    return ctx;
}
