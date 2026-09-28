'use client';

import { ClipboardList } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { activityRegisterPath } from '@/features/activity/utils/labels';

/** Shown on an activity register's configuration: tabs and sections do not apply to it. */
export default function ActivityRegisterNotice({ mnemonic }: { mnemonic: string }) {
    return (
        <div className="mx-7.5 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-primary-second bg-neutral-second px-5 py-3">
            <p className="flex items-center gap-2 text-[16px]">
                <ClipboardList className="h-5 w-5 shrink-0" aria-hidden />
                This is an activity register. Its forms come from its activity types.
            </p>
            <Link
                href={activityRegisterPath(mnemonic)}
                className="rounded-[10px] bg-primary-first px-4 py-2 text-[16px] font-medium text-neutral-first hover:opacity-90"
            >
                Open activity register
            </Link>
        </div>
    );
}
