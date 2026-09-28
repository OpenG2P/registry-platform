"use client";

import { ClipboardList } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useActivityRegisters } from "@/features/activity/hooks/useActivityRegisters";

/** Header entry to the activity registers; rendered only when the instance has at least one. */
export default function ActivityRegistersButton() {
    const { registers } = useActivityRegisters();
    if (!registers.length) return null;
    return (
        <Link href="/activity" className="flex items-center gap-2 hover:opacity-80">
            <ClipboardList className="h-6 w-6 text-neutral-first" aria-hidden />
            <span className="text-[16px] text-neutral-first">Activity registers</span>
        </Link>
    );
}
