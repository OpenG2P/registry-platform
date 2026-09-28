"use client";

import { useEffect, useState } from "react";
import { useActivityApi } from "./useActivityApi";
import type { Activity } from "../types";

export interface LatestActivityQuery {
    registerMnemonic: string;
    activityType: string;
    contextId?: string;
    subjectId?: string;
    subjectInternalRecordId?: string;
}

interface Loaded {
    key: string;
    activity: Activity | null;
}

/**
 * The most recent current activity of a type for the context or subject, used
 * to pre-fill a new entry. Null until one is found, or when there is nothing to look up by.
 */
export function useLatestActivity({ registerMnemonic, activityType, contextId, subjectId, subjectInternalRecordId }: LatestActivityQuery) {
    const api = useActivityApi();
    const [loaded, setLoaded] = useState<Loaded>({ key: "", activity: null });
    const hasSubject = !!(contextId || subjectId || subjectInternalRecordId);
    const key = registerMnemonic && activityType && hasSubject
        ? [registerMnemonic, activityType, contextId, subjectId, subjectInternalRecordId].join("|")
        : "";

    useEffect(() => {
        if (!key) return;
        let cancelled = false;
        const timer = setTimeout(() => {
            api<Activity | null>("get_latest_activity", {
                register_mnemonic: registerMnemonic,
                activity_type: activityType,
                context_id: contextId || undefined,
                subject_id: subjectId || undefined,
                subject_internal_record_id: subjectInternalRecordId || undefined,
            })
                .then(({ data }) => { if (!cancelled) setLoaded({ key, activity: data ?? null }); })
                .catch(() => { if (!cancelled) setLoaded({ key, activity: null }); });
        }, 300);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [api, key, registerMnemonic, activityType, contextId, subjectId, subjectInternalRecordId]);

    return key && loaded.key === key ? loaded.activity : null;
}
