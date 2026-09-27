"use client";

import { useEffect, useState } from "react";
import { useActivityApi } from "./useActivityApi";
import type { ActivityRegister } from "../types";

/** Activity registers in this instance (empty when the user may not view activities). */
export function useActivityRegisters() {
    const api = useActivityApi();
    const [registers, setRegisters] = useState<ActivityRegister[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        api<ActivityRegister[]>("get_activity_registers", {})
            .then(({ data }) => { if (!cancelled) setRegisters(data ?? []); })
            .catch(() => { if (!cancelled) setRegisters([]); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [api]);

    return { registers, loading };
}

/** Register from the URL segment (lower-case mnemonic). */
export function findRegister(registers: ActivityRegister[], segment: string) {
    return registers.find((r) => r.register_mnemonic.toLowerCase() === segment.toLowerCase());
}
