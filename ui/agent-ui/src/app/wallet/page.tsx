'use client';

import Link from 'next/link';

import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/Authcontext';

import IssueFlow from '../issue/IssueFlow';

/**
 * Same flow as printing, delivered differently.
 *
 * Reuses IssueFlow rather than copying it: finding the beneficiary and having
 * them authenticate are identical, and two copies would drift. Only the last
 * step differs, which the mode selects.
 */
export default function WalletRoute() {
    const { canIssue, canWallet } = useAuth();

    return (
        <AppShell>
            <nav className="breadcrumb">
                <Link href="/">← All tasks</Link>
            </nav>
            {!canIssue ? (
                <p className="error" role="alert">
                    This account is not permitted to issue credentials. It needs the
                    <code> register:issue_credential </code> permission in the agent realm.
                </p>
            ) : !canWallet ? (
                <p className="error" role="alert">
                    Wallet handover is not enabled on this deployment
                    (<code>agentPortalApi.walletIssuance.enabled</code>). Credentials can still
                    be printed.
                </p>
            ) : (
                <IssueFlow mode="wallet" />
            )}
        </AppShell>
    );
}
