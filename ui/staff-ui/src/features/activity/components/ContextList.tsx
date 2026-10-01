"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useRouter } from "@/i18n/navigation";
import { errorMessage, useActivityApi } from "../hooks/useActivityApi";
import { useRegisterHints } from "../hooks/useActivityRegisters";
import type { ActivityContext, PageInfo, JsonValue } from "../types";
import { formatDate, humanize } from "../utils/labels";
import { asGeoDimensions, locationTooltip, lowestLocation } from "../utils/geo";

interface Props {
    registerMnemonic: string;
    hasProjection: boolean;
}

const PAGE_SIZE = 20;

const text = (value: JsonValue | undefined): string =>
    value === null || value === undefined || value === "" ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value);
const str = (value: JsonValue | undefined): string | undefined =>
    value === null || value === undefined ? undefined : String(value);
// Projection columns every register has; the rest are the register's own, shown after these.
const BASE = new Set([
    "context_id", "context_key", "subject_type", "context_status", "activity_count", "last_activity_id",
    "last_activity_type", "last_occurred_at", "last_recorded_at", "projected_at", "geo_code_hierarchy_json",
    "geo_lowest_level_value_id", "geo_dimensions", "replaces_context_id", "replaced_by_context_id",
]);

/**
 * The register's contexts (e.g. crop seasons). With a projection, each row is the
 * context's current state; without one, the contexts themselves.
 */
export default function ContextList({ registerMnemonic, hasProjection }: Props) {
    const api = useActivityApi();
    const { hints } = useRegisterHints(registerMnemonic);
    const router = useRouter();
    const [rows, setRows] = useState<Record<string, JsonValue>[]>([]);
    const [info, setInfo] = useState<PageInfo | null>(null);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const pagination = { current_page: page, page_size: PAGE_SIZE, search_text: search || undefined };
            const { data, pagination: p } = hasProjection
                ? await api<Record<string, JsonValue>[]>("search_projections", { register_mnemonic: registerMnemonic }, pagination)
                : await api<ActivityContext[]>("search_contexts", { register_mnemonic: registerMnemonic }, pagination);
            setRows((data ?? []) as unknown as Record<string, JsonValue>[]);
            setInfo(p);
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setLoading(false);
        }
    }, [api, registerMnemonic, hasProjection, page, search]);

    useEffect(() => { load(); }, [load]);

    const extraColumns = hasProjection && rows.length
        ? (hints.context_columns ?? Object.keys(rows[0]).filter((k) => !BASE.has(k) && !k.endsWith("_id"))).slice(0, 8)
        : [];
    // Where each context is, from the projection's geo dimensions (else its location code).
    const showLocation = hasProjection && rows.some((r) => asGeoDimensions(r.geo_dimensions) || r.geo_lowest_level_value_id);

    return (
        <div className="flex flex-col gap-3">
            <input
                aria-label="Search"
                placeholder={hints.context_search_placeholder ?? "Search by key…"}
                className="border border-secondary-second rounded-md px-2 py-1.5 bg-neutral-second text-sm max-w-md"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); load(); } }}
            />
            <div className="overflow-x-auto rounded-[10px] bg-neutral-second">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left border-b border-secondary-second">
                            {hasProjection ? (
                                <>
                                    {extraColumns.map((c) => <th key={c} className="px-4 py-3 font-medium">{humanize(c)}</th>)}
                                    {showLocation && <th className="px-4 py-3 font-medium">Location</th>}
                                    <th className="px-4 py-3 font-medium">Activities</th>
                                    <th className="px-4 py-3 font-medium">Last activity</th>
                                    <th className="px-4 py-3 font-medium">Status</th>
                                </>
                            ) : (
                                <>
                                    <th className="px-4 py-3 font-medium">Context</th>
                                    <th className="px-4 py-3 font-medium">Subject</th>
                                    <th className="px-4 py-3 font-medium">Opened</th>
                                    <th className="px-4 py-3 font-medium">Status</th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {loading && <tr><td className="px-4 py-6 opacity-70" colSpan={12}>Loading…</td></tr>}
                        {!loading && rows.length === 0 && <tr><td className="px-4 py-6 opacity-70" colSpan={12}>Nothing recorded yet.</td></tr>}
                        {!loading && rows.map((row) => (
                            <tr
                                key={String(row.context_id)}
                                className="border-b border-secondary-second cursor-pointer hover:bg-secondary-first"
                                onClick={() => router.push(`/activity/${registerMnemonic.toLowerCase()}/context/${row.context_id}`)}
                            >
                                {hasProjection ? (
                                    <>
                                        {extraColumns.map((c) => (
                                            <td key={c} className="px-4 py-3 whitespace-nowrap">
                                                {typeof row[c] === "boolean" ? (row[c] ? "Yes" : "No")
                                                    : c.endsWith("_date") ? formatDate(str(row[c]))
                                                    : c === "stage" ? humanize(str(row[c]))
                                                    : text(row[c])}
                                            </td>
                                        ))}
                                        {showLocation && (
                                            <td className="px-4 py-3 whitespace-nowrap" title={locationTooltip(asGeoDimensions(row.geo_dimensions))}>
                                                {lowestLocation(asGeoDimensions(row.geo_dimensions), str(row.geo_lowest_level_value_id))}
                                            </td>
                                        )}
                                        <td className="px-4 py-3">{text(row.activity_count)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">{humanize(str(row.last_activity_type))} · {formatDate(str(row.last_occurred_at))}</td>
                                        <td className="px-4 py-3">{humanize(str(row.context_status))}</td>
                                    </>
                                ) : (
                                    <>
                                        <td className="px-4 py-3">{text(row.context_key)}</td>
                                        <td className="px-4 py-3">{text(row.subject_id)}</td>
                                        <td className="px-4 py-3">{formatDate(str(row.opened_at))}</td>
                                        <td className="px-4 py-3">{humanize(str(row.status))}</td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {info && info.number_of_pages > 1 && (
                <div className="flex items-center justify-end gap-3 text-sm">
                    <span>{info.number_of_items} · page {page} of {info.number_of_pages}</span>
                    <button type="button" className="px-3 py-1 rounded-md border border-secondary-second disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
                    <button type="button" className="px-3 py-1 rounded-md border border-secondary-second disabled:opacity-40" disabled={page >= info.number_of_pages} onClick={() => setPage(page + 1)}>Next</button>
                </div>
            )}
        </div>
    );
}
