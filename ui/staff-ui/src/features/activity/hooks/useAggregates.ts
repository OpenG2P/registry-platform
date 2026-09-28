"use client";

import { useCallback, useState } from "react";
import { errorMessage, useActivityApi } from "./useActivityApi";
import type { ActivityAggregate } from "../types";

/** A register's summaries for one subject, and the history of one summary. */
export function useAggregates(registerMnemonic: string) {
    const api = useActivityApi();
    const [results, setResults] = useState<ActivityAggregate[] | null>(null);
    const [history, setHistory] = useState<ActivityAggregate[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const search = useCallback(async (subjectId: string) => {
        setLoading(true);
        setError(null);
        setHistory(null);
        try {
            const { data } = await api<ActivityAggregate[]>("search_aggregates", {
                register_mnemonic: registerMnemonic,
                subject_id: subjectId,
            });
            setResults(data ?? []);
        } catch (e) {
            setError(errorMessage(e));
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, [api, registerMnemonic]);

    const loadHistory = useCallback(async (aggregate: ActivityAggregate) => {
        setHistory(null);
        setError(null);
        try {
            const { data } = await api<ActivityAggregate[]>("get_aggregate_history", {
                register_mnemonic: registerMnemonic,
                subject_id: aggregate.subject_id,
                aggregate_type: aggregate.aggregate_type,
                period_key: aggregate.period_key,
            });
            setHistory(data ?? []);
        } catch (e) {
            setError(errorMessage(e));
        }
    }, [api, registerMnemonic]);

    return { results, history, loading, error, search, loadHistory };
}
