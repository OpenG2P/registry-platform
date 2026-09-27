"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useRouter } from "@/i18n/navigation";
import { errorMessage, useActivityApi } from "../hooks/useActivityApi";
import type { ActivityType, PageInfo, WorkItem } from "../types";
import { formatEc } from "../utils/ethiopianCalendar";
import { formatDate } from "../utils/labels";
import { DueBadge } from "./StatusBadges";

interface Props {
    registerMnemonic: string;
    types: ActivityType[];
    byType: Record<string, ActivityType>;
}

/** What is due or overdue, from the activity types' due rules (e.g. harvest 90–180 days after sowing). */
export default function WorkList({ registerMnemonic, types, byType }: Props) {
    const api = useActivityApi();
    const router = useRouter();
    const [items, setItems] = useState<WorkItem[]>([]);
    const [info, setInfo] = useState<PageInfo | null>(null);
    const [page, setPage] = useState(1);
    const [activityType, setActivityType] = useState("");
    const [dueStatus, setDueStatus] = useState("");
    const [loading, setLoading] = useState(true);
    const withRules = types.filter((t) => t.due_rule?.after_type);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data, pagination } = await api<WorkItem[]>(
                "get_work_list",
                { register_mnemonic: registerMnemonic, activity_type: activityType || undefined, due_status: dueStatus || undefined },
                { current_page: page, page_size: 25 },
            );
            setItems(data ?? []);
            setInfo(pagination);
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setLoading(false);
        }
    }, [api, registerMnemonic, activityType, dueStatus, page]);

    useEffect(() => { load(); }, [load]);

    const selectClass = "border border-secondary-second rounded-md px-2 py-1.5 bg-neutral-second text-sm";

    if (!withRules.length) {
        return <p className="text-sm opacity-70">No activity type in this register has a due rule, so there is no work list.</p>;
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
                <select aria-label="Activity due" className={selectClass} value={activityType} onChange={(e) => { setActivityType(e.target.value); setPage(1); }}>
                    <option value="">Everything due</option>
                    {withRules.map((t) => <option key={t.activity_type} value={t.activity_type}>{t.display_name}</option>)}
                </select>
                <select aria-label="Due status" className={selectClass} value={dueStatus} onChange={(e) => { setDueStatus(e.target.value); setPage(1); }}>
                    <option value="">Due and overdue</option>
                    <option value="OVERDUE">Overdue only</option>
                    <option value="DUE">Due only</option>
                    <option value="NOT_YET_DUE">Coming up</option>
                </select>
            </div>
            <div className="overflow-x-auto rounded-[10px] bg-neutral-second">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left border-b border-secondary-second">
                            <th className="px-4 py-3 font-medium">Due</th>
                            <th className="px-4 py-3 font-medium">For</th>
                            <th className="px-4 py-3 font-medium">Subject</th>
                            <th className="px-4 py-3 font-medium">Because of</th>
                            <th className="px-4 py-3 font-medium">Window</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && <tr><td className="px-4 py-6 opacity-70" colSpan={6}>Loading…</td></tr>}
                        {!loading && items.length === 0 && <tr><td className="px-4 py-6 opacity-70" colSpan={6}>Nothing is due.</td></tr>}
                        {!loading && items.map((item) => (
                            <tr
                                key={`${item.context_id}-${item.activity_type}`}
                                className="border-b border-secondary-second cursor-pointer hover:bg-secondary-first"
                                onClick={() => router.push(`/activity/${registerMnemonic.toLowerCase()}/context/${item.context_id}`)}
                            >
                                <td className="px-4 py-3 font-medium">{byType[item.activity_type]?.display_name ?? item.activity_type}</td>
                                <td className="px-4 py-3">{item.context_key}</td>
                                <td className="px-4 py-3">{item.subject_id ?? "—"}</td>
                                <td className="px-4 py-3 whitespace-nowrap">{byType[item.after_activity_type]?.display_name ?? item.after_activity_type} on {formatEc(item.after_occurred_at)}</td>
                                <td className="px-4 py-3 whitespace-nowrap">{formatDate(item.due_from)} – {item.due_by ? formatDate(item.due_by) : "open"}</td>
                                <td className="px-4 py-3"><DueBadge status={item.due_status} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {info && info.number_of_pages > 1 && (
                <div className="flex items-center justify-end gap-3 text-sm">
                    <span>{info.number_of_items} items · page {page} of {info.number_of_pages}</span>
                    <button type="button" className="px-3 py-1 rounded-md border border-secondary-second disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
                    <button type="button" className="px-3 py-1 rounded-md border border-secondary-second disabled:opacity-40" disabled={page >= info.number_of_pages} onClick={() => setPage(page + 1)}>Next</button>
                </div>
            )}
        </div>
    );
}
