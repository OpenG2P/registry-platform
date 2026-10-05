"use client";

import { useEffect, useState } from "react";
import { useActivityApi } from "./useActivityApi";
import type { ActivityRegister, RegisterUiHints } from "../types";

const NONE: ActivityRegister[] = [];

/**
 * Activity registers in this instance (empty when the user may not view
 * activities). Pass enabled=false to skip the call, e.g. without activity:view.
 */
export function useActivityRegisters(enabled = true) {
    const api = useActivityApi();
    const [registers, setRegisters] = useState<ActivityRegister[]>(NONE);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        api<ActivityRegister[]>("get_activity_registers", {})
            .then(({ data }) => { if (!cancelled) setRegisters(data ?? []); })
            .catch(() => { if (!cancelled) setRegisters([]); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [api, enabled]);

    return { registers: enabled ? registers : NONE, loading: enabled && loading };
}

/** A register's presentation hints (empty until loaded, or when it sets none). */
export function useRegisterHints(registerMnemonic: string): { hints: RegisterUiHints; contextFields: string[] } {
    const { registers } = useActivityRegisters(!!registerMnemonic);
    const register = findRegister(registers, registerMnemonic);
    return { hints: register?.ui_hints ?? {}, contextFields: register?.context_fields ?? [] };
}

/** Register from the URL segment (lower-case mnemonic). */
export function findRegister(registers: ActivityRegister[], segment: string) {
    return registers.find((r) => r.register_mnemonic.toLowerCase() === segment.toLowerCase());
}
