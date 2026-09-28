"use client";

import { useCallback, useEffect, useState } from "react";
import { useActivityApi } from "./useActivityApi";
import type { SubjectActivities } from "../types";

interface Loaded {
    key: string;
    groups: SubjectActivities[];
    error: string | null;
}

const NONE: SubjectActivities[] = [];

/**
 * Activities (and summaries) about one record of this registry, grouped by
 * activity register — including those about its child records (a farmer's plots).
 */
export function useSubjectActivities(internalRecordId: string | undefined, enabled = true) {
    const api = useActivityApi();
    const [version, setVersion] = useState(0);
    const [loaded, setLoaded] = useState<Loaded>({ key: "", groups: NONE, error: null });
    const key = enabled && internalRecordId ? `${internalRecordId}:${version}` : "";

    useEffect(() => {
        if (!key || !internalRecordId) return;
        let cancelled = false;
        api<SubjectActivities[]>("get_subject_activities", {
            subject_internal_record_id: internalRecordId,
            include_descendants: true,
        })
            .then(({ data }) => { if (!cancelled) setLoaded({ key, groups: data ?? [], error: null }); })
            .catch((e: Error) => { if (!cancelled) setLoaded({ key, groups: [], error: e.message }); });
        return () => { cancelled = true; };
    }, [api, key, internalRecordId]);

    const reload = useCallback(() => setVersion((v) => v + 1), []);
    const current = key !== "" && loaded.key === key;
    return {
        groups: current ? loaded.groups : NONE,
        error: current ? loaded.error : null,
        loading: key !== "" && !current,
        reload,
    };
}
