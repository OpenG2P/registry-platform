'use client';

import { useAuth } from '@/context/Authcontext';

import IssuePage from './IssuePage';

export default function Home() {
    const { user, canIssue, logout } = useAuth();

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

            <main>
                {canIssue ? (
                    <IssuePage />
                ) : (
                    <p className="error" role="alert">
                        This account is not permitted to issue credentials. It needs the
                        <code> register:issue_credential </code> permission in the agent realm.
                    </p>
                )}
            </main>
        </div>
    );
}
