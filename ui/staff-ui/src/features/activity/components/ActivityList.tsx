"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { errorMessage, useActivityApi } from "../hooks/useActivityApi";
import type { Activity, ActivityType, PageInfo } from "../types";
import { formatEc } from "../utils/ethiopianCalendar";
import { displayValue, formatDateTime } from "../utils/labels";
import { activityLocationFallback, locationTooltip, lowestLocation } from "../utils/geo";
import ActivityDetail from "./ActivityDetail";
import { StatusBadge, VerificationBadge, WarningCount } from "./StatusBadges";

interface Props {
    registerMnemonic: string;
    types: ActivityType[];
    byType: Record<string, ActivityType>;
    /** Restrict to one context (the crop-season page) or one subject. */
    contextId?: string;
    subjectId?: string;
    /** Show superseded and voided activities too (timeline view). */
    timeline?: boolean;
    refreshKey?: number;
}

const PAGE_SIZE = 20;
const SUMMARY_FIELDS = ["farmer_id", "plot_id", "crop", "area_ha", "quantity_qt"];

/** Activities as a filterable, paged list; a row opens the detail panel. */
export default function ActivityList({ registerMnemonic, types, byType, contextId, subjectId, timeline, refreshKey }: Props) {
    const api = useActivityApi();
    const [rows, setRows] = useState<Activity[]>([]);
    const [page, setPage] = useState(1);
    const [info, setInfo] = useState<PageInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState("");
    const [verification, setVerification] = useState("");
    const [includeInactive, setIncludeInactive] = useState(!!timeline);
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<Activity | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            if (timeline && (contextId || subjectId)) {
                const { data } = await api<Activity[]>("get_timeline", {
                    register_mnemonic: registerMnemonic, context_id: contextId, subject_id: subjectId,
                    include_inactive: includeInactive,
                });
                setRows(data ?? []);
                setInfo(null);
            } else {
                const { data, pagination } = await api<Activity[]>(
                    "search_activities",
                    {
                        register_mnemonic: registerMnemonic,
                        activity_types: typeFilter ? [typeFilter] : undefined,
                        verification_statuses: verification ? [verification] : undefined,
                        statuses: includeInactive ? ["ACTIVE", "SUPERSEDED", "VOIDED"] : undefined,
                        context_id: contextId,
                        subject_id: subjectId,
                    },
                    { current_page: page, page_size: PAGE_SIZE, search_text: search || undefined },
                );
                setRows(data ?? []);
                setInfo(pagination);
            }
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setLoading(false);
        }
    }, [api, registerMnemonic, typeFilter, verification, includeInactive, contextId, subjectId, timeline, page, search]);

    useEffect(() => { load(); }, [load, refreshKey]);

    const selectClass = "border border-secondary-second rounded-md px-2 py-1.5 bg-neutral-second text-sm";

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
                {!timeline && (
                    <>
                        <input
                            aria-label="Search activities"
                            placeholder="Search farmer, plot, crop…"
                            className={`${selectClass} min-w-56`}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); load(); } }}
                        />
                        <select aria-label="Activity type" className={selectClass} value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
                            <option value="">All activity types</option>
                            {types.map((t) => <option key={t.activity_type} value={t.activity_type}>{t.display_name}</option>)}
                        </select>
                        <select aria-label="Verification" className={selectClass} value={verification} onChange={(e) => { setVerification(e.target.value); setPage(1); }}>
                            <option value="">Any verification state</option>
                            <option value="SUBMITTED">Awaiting verification</option>
                            <option value="VERIFIED">Verified</option>
                            <option value="REJECTED">Rejected</option>
                        </select>
                    </>
                )}
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
                    Show superseded and voided
                </label>
            </div>

            <div className="overflow-x-auto rounded-[10px] bg-neutral-second">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left border-b border-secondary-second">
                            <th className="px-4 py-3 font-medium">Activity</th>
                            <th className="px-4 py-3 font-medium">Happened</th>
                            <th className="px-4 py-3 font-medium">Location</th>
                            <th className="px-4 py-3 font-medium">Details</th>
                            <th className="px-4 py-3 font-medium">Recorded</th>
                            <th className="px-4 py-3 font-medium">State</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr><td colSpan={6} className="px-4 py-6 opacity-70">Loading…</td></tr>
                        )}
                        {!loading && rows.length === 0 && (
                            <tr><td colSpan={6} className="px-4 py-6 opacity-70">No activities match.</td></tr>
                        )}
                        {!loading && rows.map((a) => {
                            const type = byType[a.activity_type];
                            return (
                                <tr
                                    key={a.activity_id}
                                    className={`border-b border-secondary-second cursor-pointer hover:bg-secondary-first ${a.status !== "ACTIVE" ? "opacity-60" : ""}`}
                                    onClick={() => setSelected(a)}
                                >
                                    <td className="px-4 py-3 font-medium">{type?.display_name ?? a.activity_type}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <div>{formatEc(a.occurred_at)}</div>
                                        <div className="text-xs opacity-60">{a.occurred_at.slice(0, 10)}</div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap" title={locationTooltip(a.geo_dimensions)}>
                                        {lowestLocation(a.geo_dimensions, activityLocationFallback(type, a.payload, a.display))}
                                    </td>
                                    <td className="px-4 py-3">
                                        {SUMMARY_FIELDS.filter((f) => a.payload?.[f] !== undefined).map((f) => (
                                            <span key={f} className="mr-3 whitespace-nowrap">{displayValue(type, f, a.payload[f], a.display)}</span>
                                        ))}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <div>{a.recorded_by}</div>
                                        <div className="text-xs opacity-60">{formatDateTime(a.recorded_at)} · {a.channel.replace("_", " ").toLowerCase()}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            <StatusBadge status={a.status} />
                                            <VerificationBadge status={a.verification_status} />
                                            <WarningCount warnings={a.rule_warnings} />
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {info && info.number_of_pages > 1 && (
                <div className="flex items-center justify-end gap-3 text-sm">
                    <span>{info.number_of_items} activities · page {page} of {info.number_of_pages}</span>
                    <button type="button" className="px-3 py-1 rounded-md border border-secondary-second disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
                    <button type="button" className="px-3 py-1 rounded-md border border-secondary-second disabled:opacity-40" disabled={page >= info.number_of_pages} onClick={() => setPage(page + 1)}>Next</button>
                </div>
            )}

            {selected && (
                <ActivityDetail
                    registerMnemonic={registerMnemonic}
                    activity={selected}
                    type={byType[selected.activity_type]}
                    onClose={() => setSelected(null)}
                    onChanged={() => { setSelected(null); load(); }}
                />
            )}
        </div>
    );
}
