"use client";

import { useState } from "react";
import { useAggregates } from "../hooks/useAggregates";
import type { ActivityAggregate } from "../types";
import { formatDate, formatDateTime, humanize } from "../utils/labels";
import { asGeoDimensions, formatLocation, locationTooltip } from "../utils/geo";
import AggregateValues from "./AggregateValues";

const inputClass = "border border-secondary-second rounded-md px-3 py-2 bg-neutral-second text-sm min-w-64";

/**
 * The register's per-subject summaries (e.g. a farmer's season totals): search
 * by subject ID, then open one summary to see how its values changed over time.
 */
export default function Summaries({ registerMnemonic }: { registerMnemonic: string }) {
    const { results, history, loading, error, search, loadHistory } = useAggregates(registerMnemonic);
    const [subjectId, setSubjectId] = useState("");
    const [selected, setSelected] = useState<ActivityAggregate | null>(null);

    const submit = () => {
        if (!subjectId.trim()) return;
        setSelected(null);
        search(subjectId.trim());
    };

    return (
        <div className="flex flex-col gap-4">
            <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
                <label className="flex flex-col gap-1 text-sm font-medium">
                    Subject ID
                    <input className={inputClass} placeholder="e.g. Farmer ID" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} />
                </label>
                <button type="submit" disabled={!subjectId.trim() || loading}
                    className="px-5 py-2 rounded-md bg-primary-first text-neutral-second text-sm disabled:opacity-50">
                    {loading ? "Searching…" : "Show summaries"}
                </button>
            </form>
            {error && <p className="text-sm text-toast-failed">{error}</p>}
            {results && (
                <AggregateTable
                    rows={results}
                    empty="No summaries for this subject."
                    selectedId={selected?.aggregate_id}
                    onSelect={(a) => { setSelected(a); loadHistory(a); }}
                />
            )}
            {selected && (
                <section className="flex flex-col gap-2">
                    <h3 className="font-medium">
                        {humanize(selected.aggregate_type)} · {selected.period_key} — over time
                    </h3>
                    {history ? <AggregateTable rows={history} empty="No history." /> : <p className="text-sm opacity-70">Loading…</p>}
                </section>
            )}
        </div>
    );
}

interface TableProps {
    rows: ActivityAggregate[];
    empty: string;
    selectedId?: string;
    onSelect?: (aggregate: ActivityAggregate) => void;
}

function AggregateTable({ rows, empty, selectedId, onSelect }: TableProps) {
    const showLocation = rows.some((a) => asGeoDimensions(a.geo_dimensions));
    const columnCount = showLocation ? 5 : 4;
    return (
        <div className="overflow-x-auto rounded-[10px] bg-neutral-second">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left border-b border-secondary-second">
                        <th className="px-4 py-3 font-medium">Summary</th>
                        <th className="px-4 py-3 font-medium">Period</th>
                        {showLocation && <th className="px-4 py-3 font-medium">Location</th>}
                        <th className="px-4 py-3 font-medium">Values</th>
                        <th className="px-4 py-3 font-medium">Computed</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 && <tr><td colSpan={columnCount} className="px-4 py-6 opacity-70">{empty}</td></tr>}
                    {rows.map((a) => (
                        <tr
                            key={`${a.aggregate_id}:${a.computed_at}`}
                            className={`border-b border-secondary-second ${onSelect ? "cursor-pointer hover:bg-secondary-first" : ""} ${selectedId === a.aggregate_id ? "bg-secondary-first" : ""}`}
                            onClick={onSelect ? () => onSelect(a) : undefined}
                        >
                            <td className="px-4 py-3 font-medium">{humanize(a.aggregate_type)}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                                <div>{a.period_key}</div>
                                {(a.period_start || a.period_end) && (
                                    <div className="text-xs opacity-60">{formatDate(a.period_start)} – {formatDate(a.period_end)}</div>
                                )}
                            </td>
                            {showLocation && (
                                <td className="px-4 py-3" title={locationTooltip(a.geo_dimensions)}>{formatLocation(a.geo_dimensions)}</td>
                            )}
                            <td className="px-4 py-3"><AggregateValues value={a.aggregate_value} /></td>
                            <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(a.computed_at)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
