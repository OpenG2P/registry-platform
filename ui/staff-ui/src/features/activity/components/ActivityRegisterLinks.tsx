"use client";

import { Link } from "@/i18n/navigation";
import Can from "@/components/shared/Can";
import { ACTIVITY_ACTIONS } from "@/features/shared/permissions";
import { useActivityRegisters } from "../hooks/useActivityRegisters";

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
        <div className="w-full flex flex-wrap justify-center gap-3" aria-label="Activity registers">
            {registers.map((r) => (
                <Link
                    key={r.register_id}
                    href={`/activity/${r.register_mnemonic.toLowerCase()}`}
                    className="rounded-full bg-neutral-second px-5 py-2 text-sm font-medium shadow hover:shadow-md"
                >
                    {r.register_description || r.register_mnemonic}
                </Link>
            ))}
        </div>
    );
}
