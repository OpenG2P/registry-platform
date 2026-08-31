'use client';

import Link from 'next/link';

import AppShell from '@/components/AppShell';
import { VERIFY_PERMISSION, useAuth } from '@/context/Authcontext';

import VerifyFlow from './VerifyFlow';

export default function VerifyRoute() {
    const { canVerify } = useAuth();

    return (
        <AppShell>
            <nav className="breadcrumb">
                <Link href="/">← All tasks</Link>
            </nav>
            {canVerify ? (
                <VerifyFlow />
            ) : (
                <p className="error" role="alert">
                    This account is not permitted to verify credentials. It needs the
                    <code> {VERIFY_PERMISSION} </code> permission in the agent realm.
                </p>
            )}
        </AppShell>
    );
}
