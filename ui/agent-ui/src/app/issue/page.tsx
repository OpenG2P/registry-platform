'use client';

import Link from 'next/link';

import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/Authcontext';

import IssueFlow from './IssueFlow';

export default function IssueRoute() {
    const { canIssue } = useAuth();

    return (
        <AppShell>
            <nav className="breadcrumb">
                <Link href="/">← All tasks</Link>
            </nav>
            {canIssue ? (
                <IssueFlow />
            ) : (
                <p className="error" role="alert">
                    This account is not permitted to issue credentials. It needs the
                    <code> register:issue_credential </code> permission in the agent realm.
                </p>
            )}
        </AppShell>
    );
}
