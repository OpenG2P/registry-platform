"use client";

import { ClipboardList, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import Can from "@/components/shared/Can";
import { ACTIVITY_ACTIONS } from "@/features/shared/permissions";
import { useActivityRegisters } from "../hooks/useActivityRegisters";
import { activityRegisterPath, registerLabel } from "../utils/labels";

/** Home-page entry points to the instance's activity registers (hidden when there are none). */
export default function ActivityRegisterLinks() {
    return (
        <Can action={ACTIVITY_ACTIONS.view}>
            <Links />
        </Can>
    );
}

function Links() {
    const { registers } = useActivityRegisters();
    if (!registers.length) return null;
    return (
        <nav className="w-full flex flex-wrap justify-center gap-4" aria-label="Activity registers">
            {registers.map((r) => (
                <Link
                    key={r.register_id}
                    href={activityRegisterPath(r.register_mnemonic)}
                    title={r.register_description ?? undefined}
                    className="group flex items-center gap-4 min-w-64 max-w-sm rounded-[10px] bg-neutral-second px-5 py-4 shadow hover:shadow-lg transition-shadow"
                >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-primary-first/25">
                        <ClipboardList className="h-6 w-6 text-neutral-first" aria-hidden />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col text-left">
                        <span className="text-xs uppercase tracking-wide opacity-60">Activity register</span>
                        <span className="font-roboto text-[18px] font-bold leading-6 truncate">{registerLabel(r)}</span>
                        {r.register_description && (
                            <span className="text-xs opacity-70 line-clamp-1">{r.register_description}</span>
                        )}
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 opacity-50 group-hover:opacity-100" aria-hidden />
                </Link>
            ))}
        </nav>
    );
}
