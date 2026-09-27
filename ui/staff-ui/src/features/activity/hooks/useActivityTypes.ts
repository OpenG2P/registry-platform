"use client";

import { useEffect, useMemo, useState } from "react";
import { useActivityApi } from "./useActivityApi";
import type { ActivityType } from "../types";

interface Loaded {
    mnemonic: string;
    types: ActivityType[];
    error: string | null;
}

/** The register's activity types (schemas, rules, code-list options), keyed by activity_type. */
export function useActivityTypes(registerMnemonic: string) {
    const api = useActivityApi();
    const [loaded, setLoaded] = useState<Loaded>({ mnemonic: "", types: [], error: null });

    useEffect(() => {
        if (!registerMnemonic) return;
        let cancelled = false;
        api<ActivityType[]>("get_activity_types", { register_mnemonic: registerMnemonic })
            .then(({ data }) => { if (!cancelled) setLoaded({ mnemonic: registerMnemonic, types: data ?? [], error: null }); })
            .catch((e: Error) => { if (!cancelled) setLoaded({ mnemonic: registerMnemonic, types: [], error: e.message }); });
        return () => { cancelled = true; };
    }, [api, registerMnemonic]);

    const types = useMemo(() => (loaded.mnemonic === registerMnemonic ? loaded.types : []), [loaded, registerMnemonic]);
    const byType = useMemo(() => Object.fromEntries(types.map((t) => [t.activity_type, t])), [types]);
    return { types, byType, loading: loaded.mnemonic !== registerMnemonic, error: loaded.error };
}
