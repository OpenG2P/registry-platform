'use client';

import { useAuth } from '@/context/Authcontext';

/** Header + page frame, shared by every route so the chrome stays identical. */
export default function AppShell({ children }: { children: React.ReactNode }) {
    const { user, logout } = useAuth();

    return (
        <div className="app">
            <header className="app-header">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/openg2p-logo-horizontal.svg" alt="OpenG2P" height={28} />
                <span className="app-title">Agent Portal</span>
                <span className="spacer" />
                <span className="muted">{user?.name ?? user?.email ?? user?.sub}</span>
                <button className="link" onClick={logout}>
                    Sign out
                </button>
            </header>

            <main>{children}</main>
        </div>
    );
}
