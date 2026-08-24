'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';

/** Permission an agent must hold to issue. Mirrors ISSUE_PERMISSION on the API. */
export const ISSUE_PERMISSION = 'register:issue_credential';

/** Shape IAM's /auth/get_logged_in_user returns. Only the fields this UI
 *  reads are named; IAM sends more and the extras are simply carried. */
export interface LoggedInUser {
    sub?: string;
    name?: string;
    email?: string;
}

interface AuthContextType {
    isLoggedIn: boolean;
    user: LoggedInUser | null;
    canIssue: boolean;
    logout: () => void;
    handleUnauthorized: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [user, setUser] = useState<LoggedInUser | null>(null);
    const [permissions, setPermissions] = useState<string[]>([]);
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

                // Permissions are NOT on the profile: IAM's LoggedInUserResponse
                // carries only identity fields. Staff's RbacContext fetches them
                // separately and so does this.
                const permRes = await fetch('/api/permissions', { cache: 'no-store' });
                if (permRes.ok) {
                    const data = await permRes.json();
                    setPermissions(
                        Array.isArray(data)
                            ? data.flatMap((app: { permissions?: string[] }) => app.permissions || [])
                            : []
                    );
                }
            } catch {
                setIsLoggedIn(false);
            } finally {
                setIsLoading(false);
            }
        }
        initAuth();
    }, [handleUnauthorized]);

    const canIssue = permissions.includes(ISSUE_PERMISSION);

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
