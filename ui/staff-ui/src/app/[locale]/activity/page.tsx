'use client';

import { Link } from '@/i18n/navigation';
import { BreadcrumbBar } from '@/components/shared';
import { useActivityRegisters } from '@/features/activity/hooks/useActivityRegisters';

/** Every activity register in this registry instance. */
export default function ActivityRegistersPage() {
    const { registers, loading } = useActivityRegisters();
    return (
        <div className="min-h-screen bg-secondary-first">
            <div className="px-7.5 pt-5">
                <BreadcrumbBar breadcrumb={[{ label: 'Activity registers' }]} />
            </div>
            <div className="mx-7.5 mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {loading && <p className="text-sm opacity-70">Loading…</p>}
                {!loading && registers.length === 0 && <p className="text-sm opacity-70">This registry has no activity registers.</p>}
                {registers.map((r) => (
                    <Link key={r.register_id} href={`/activity/${r.register_mnemonic.toLowerCase()}`}
                        className="rounded-[10px] bg-neutral-second p-5 flex flex-col gap-1 hover:shadow-md">
                        <span className="font-semibold">{r.register_mnemonic}</span>
                        {r.register_description && <span className="text-sm opacity-80">{r.register_description}</span>}
                    </Link>
                ))}
            </div>
        </div>
    );
}
