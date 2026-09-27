'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { BreadcrumbBar } from '@/components/shared';
import Can from '@/components/shared/Can';
import { ACTIVITY_ACTIONS } from '@/features/shared/permissions';
import { useActivityRegisters, findRegister } from '@/features/activity/hooks/useActivityRegisters';
import { useActivityTypes } from '@/features/activity/hooks/useActivityTypes';
import ActivityList from '@/features/activity/components/ActivityList';
import ContextList from '@/features/activity/components/ContextList';
import WorkList from '@/features/activity/components/WorkList';
import Indicators from '@/features/activity/components/Indicators';
import AdminPanel from '@/features/activity/components/AdminPanel';
import RecordActivity from '@/features/activity/components/RecordActivity';

type Tab = 'activities' | 'contexts' | 'work' | 'indicators' | 'record' | 'admin';

/** One activity register: its activities, contexts, work list, indicators and settings. */
export default function ActivityRegisterPage() {
    const { type } = useParams<{ type: string }>();
    const { registers, loading } = useActivityRegisters();
    const register = findRegister(registers, type);
    const mnemonic = register?.register_mnemonic ?? '';
    const { types, byType } = useActivityTypes(mnemonic);
    const [tab, setTab] = useState<Tab>('activities');
    const [refreshKey, setRefreshKey] = useState(0);

    if (loading) return <div className="p-8 text-sm opacity-70">Loading…</div>;
    if (!register) return <div className="p-8 text-sm">No activity register named “{type}”.</div>;

    const tabs: { id: Tab; label: string; action?: string }[] = [
        { id: 'activities', label: 'Activities' },
        { id: 'contexts', label: register.has_projection ? 'Current state' : 'Contexts' },
        { id: 'work', label: 'Work list' },
        { id: 'indicators', label: 'Indicators' },
        { id: 'record', label: 'Record', action: ACTIVITY_ACTIONS.create },
        { id: 'admin', label: 'Settings', action: ACTIVITY_ACTIONS.configure },
    ];

    return (
        <div className="min-h-screen bg-secondary-first pb-10">
            <div className="px-7.5 pt-5 flex flex-col gap-2">
                <BreadcrumbBar breadcrumb={[{ label: 'Activity registers', href: '/activity' }, { label: register.register_mnemonic }]} />
                {register.register_description && <p className="text-sm opacity-80">{register.register_description}</p>}
            </div>

            <nav className="mx-7.5 mt-4 flex flex-wrap gap-1 border-b border-secondary-second" aria-label="Sections">
                {tabs.map((t) => {
                    const button = (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setTab(t.id)}
                            className={`px-4 py-2 text-sm rounded-t-md ${tab === t.id ? 'bg-neutral-second font-semibold border border-b-0 border-secondary-second' : 'opacity-80 hover:opacity-100'}`}
                            aria-current={tab === t.id ? 'page' : undefined}
                        >
                            {t.label}
                        </button>
                    );
                    return t.action ? <Can key={t.id} action={t.action}>{button}</Can> : button;
                })}
            </nav>

            <main className="mx-7.5 mt-4">
                {tab === 'activities' && <ActivityList registerMnemonic={mnemonic} types={types} byType={byType} refreshKey={refreshKey} />}
                {tab === 'contexts' && <ContextList registerMnemonic={mnemonic} hasProjection={register.has_projection} />}
                {tab === 'work' && <WorkList registerMnemonic={mnemonic} types={types} byType={byType} />}
                {tab === 'indicators' && <Indicators registerMnemonic={mnemonic} />}
                {tab === 'record' && types.length > 0 && (
                    <RecordActivity
                        registerMnemonic={mnemonic}
                        types={types}
                        onRecorded={() => { setRefreshKey((k) => k + 1); setTab('activities'); }}
                    />
                )}
                {tab === 'admin' && <AdminPanel registerMnemonic={mnemonic} types={types} hasProjection={register.has_projection} />}
            </main>
        </div>
    );
}
