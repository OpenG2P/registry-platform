'use client';

import Link from 'next/link';

import AppShell from '@/components/AppShell';
import { ISSUE_PERMISSION, useAuth } from '@/context/Authcontext';

/**
 * Landing page.
 *
 * The agent portal is a generic surface, not a single-purpose screen: issuance
 * is the first task it carries, and others will follow. So the entry point is a
 * list of tasks rather than the issuance form itself, and adding a capability
 * means adding a card here rather than restructuring the app.
 *
 * A task the agent cannot perform is shown disabled with the reason, rather
 * than hidden — an agent who was told they can issue needs to see WHY they
 * cannot, not an empty page.
 */
export default function Home() {
    const { canIssue } = useAuth();

    return (
        <AppShell>
            <h1 className="page-title">What would you like to do?</h1>

            <div className="task-grid">
                {canIssue ? (
                    <Link href="/issue" className="task-card">
                        <span className="task-card-icon" aria-hidden="true">🪪</span>
                        <span className="task-card-title">Issue Verifiable Credentials</span>
                        <span className="task-card-desc">
                            Look up a beneficiary, have them authenticate, and print their
                            credential.
                        </span>
                    </Link>
                ) : (
                    <div className="task-card task-card-disabled" aria-disabled="true">
                        <span className="task-card-icon" aria-hidden="true">🪪</span>
                        <span className="task-card-title">Issue Verifiable Credentials</span>
                        <span className="task-card-desc">
                            Not available for this account — it needs the
                            <code> {ISSUE_PERMISSION} </code> permission in the agent realm.
                        </span>
                    </div>
                )}
            </div>
        </AppShell>
    );
}
