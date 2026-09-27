"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { errorMessage, useActivityApi } from "../hooks/useActivityApi";
import type { ActivityType, PeriodLock, TemporaryReference } from "../types";
import { formatDate, formatDateTime } from "../utils/labels";
import ReasonDialog from "./ReasonDialog";

interface Props {
    registerMnemonic: string;
    types: ActivityType[];
    hasProjection: boolean;
}

const inputClass = "border border-secondary-second rounded-md px-2 py-1.5 bg-neutral-second text-sm";

/** Period locks, offline temporary IDs awaiting resolution, and projection rebuild. */
export default function AdminPanel({ registerMnemonic, types, hasProjection }: Props) {
    const api = useActivityApi();
    const [locks, setLocks] = useState<PeriodLock[]>([]);
    const [temporary, setTemporary] = useState<TemporaryReference[]>([]);
    const [lockForm, setLockForm] = useState({ period_start: "", period_end: "", activity_type: "", reason: "" });
    const [unlocking, setUnlocking] = useState<PeriodLock | null>(null);
    const [resolutions, setResolutions] = useState<Record<string, string>>({});

    const [reloadKey, setReloadKey] = useState(0);
    const load = () => setReloadKey((k) => k + 1);

    useEffect(() => {
        let cancelled = false;
        Promise.all([
            api<PeriodLock[]>("get_period_locks", { register_mnemonic: registerMnemonic }),
            api<TemporaryReference[]>("get_temporary_references", { register_mnemonic: registerMnemonic }),
        ])
            .then(([{ data: l }, { data: t }]) => {
                if (cancelled) return;
                setLocks(l ?? []);
                setTemporary(t ?? []);
            })
            .catch((error) => toast.error(errorMessage(error)));
        return () => { cancelled = true; };
    }, [api, registerMnemonic, reloadKey]);

    const lock = async () => {
        try {
            await api("lock_period", {
                register_mnemonic: registerMnemonic,
                period_start: lockForm.period_start,
                period_end: lockForm.period_end,
                activity_type: lockForm.activity_type || undefined,
                reason: lockForm.reason || undefined,
            });
            toast.success("Period closed");
            setLockForm({ period_start: "", period_end: "", activity_type: "", reason: "" });
            load();
        } catch (error) {
            toast.error(errorMessage(error));
        }
    };

    const resolve = async (ref: TemporaryReference) => {
        try {
            await api("resolve_temporary_reference", {
                register_mnemonic: registerMnemonic,
                reference_field: ref.reference_field,
                temporary_id: ref.temporary_id,
                resolved_id: resolutions[ref.temporary_reference_id],
            });
            toast.success(`${ref.temporary_id} resolved`);
            load();
        } catch (error) {
            toast.error(errorMessage(error));
        }
    };

    const rebuild = async () => {
        try {
            const { data } = await api<{ contexts_rebuilt: number }>("rebuild_projections", { register_mnemonic: registerMnemonic });
            toast.success(`Rebuilt ${data.contexts_rebuilt} projections`);
        } catch (error) {
            toast.error(errorMessage(error));
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <section className="rounded-[10px] bg-neutral-second p-4 flex flex-col gap-3">
                <h3 className="font-medium">Closed periods</h3>
                <p className="text-sm opacity-70">No activity dated inside a closed period can be recorded or corrected until it is reopened.</p>
                <div className="flex flex-wrap items-end gap-3">
                    <label className="flex flex-col text-sm gap-1">From
                        <input type="date" className={inputClass} value={lockForm.period_start} onChange={(e) => setLockForm({ ...lockForm, period_start: e.target.value })} />
                    </label>
                    <label className="flex flex-col text-sm gap-1">To
                        <input type="date" className={inputClass} value={lockForm.period_end} onChange={(e) => setLockForm({ ...lockForm, period_end: e.target.value })} />
                    </label>
                    <label className="flex flex-col text-sm gap-1">Activity type
                        <select className={inputClass} value={lockForm.activity_type} onChange={(e) => setLockForm({ ...lockForm, activity_type: e.target.value })}>
                            <option value="">All types</option>
                            {types.map((t) => <option key={t.activity_type} value={t.activity_type}>{t.display_name}</option>)}
                        </select>
                    </label>
                    <label className="flex flex-col text-sm gap-1 flex-1 min-w-48">Reason
                        <input className={inputClass} value={lockForm.reason} onChange={(e) => setLockForm({ ...lockForm, reason: e.target.value })} />
                    </label>
                    <button type="button" className="px-4 py-2 rounded-md bg-primary-first text-neutral-second text-sm disabled:opacity-50"
                        disabled={!lockForm.period_start || !lockForm.period_end} onClick={lock}>Close period</button>
                </div>
                <table className="w-full text-sm">
                    <tbody>
                        {locks.map((l) => (
                            <tr key={l.lock_id} className={`border-t border-secondary-second ${l.is_active ? "" : "opacity-50"}`}>
                                <td className="py-2">{formatDate(l.period_start)} – {formatDate(l.period_end)}</td>
                                <td className="py-2">{l.activity_type ?? "All types"}</td>
                                <td className="py-2">{l.reason ?? ""}</td>
                                <td className="py-2">{l.is_active ? `Closed by ${l.locked_by}` : `Reopened by ${l.reopened_by}: ${l.reopen_reason}`}</td>
                                <td className="py-2 text-right">
                                    {l.is_active && <button type="button" className="underline" onClick={() => setUnlocking(l)}>Reopen</button>}
                                </td>
                            </tr>
                        ))}
                        {!locks.length && <tr><td className="py-2 opacity-70">No closed periods.</td></tr>}
                    </tbody>
                </table>
            </section>

            <section className="rounded-[10px] bg-neutral-second p-4 flex flex-col gap-3">
                <h3 className="font-medium">Temporary IDs awaiting resolution</h3>
                <p className="text-sm opacity-70">IDs created offline (e.g. a new plot, TMP-…). Once resolved, new activities using them get the real ID.</p>
                <table className="w-full text-sm">
                    <tbody>
                        {temporary.map((ref) => (
                            <tr key={ref.temporary_reference_id} className="border-t border-secondary-second">
                                <td className="py-2">{ref.reference_field}</td>
                                <td className="py-2 font-mono">{ref.temporary_id}</td>
                                <td className="py-2">{formatDateTime(ref.first_seen_at)}</td>
                                <td className="py-2">
                                    <input aria-label="Resolved ID" className={inputClass} placeholder="Real ID"
                                        value={resolutions[ref.temporary_reference_id] ?? ""}
                                        onChange={(e) => setResolutions({ ...resolutions, [ref.temporary_reference_id]: e.target.value })} />
                                </td>
                                <td className="py-2 text-right">
                                    <button type="button" className="underline disabled:opacity-40" disabled={!resolutions[ref.temporary_reference_id]} onClick={() => resolve(ref)}>Resolve</button>
                                </td>
                            </tr>
                        ))}
                        {!temporary.length && <tr><td className="py-2 opacity-70">None pending.</td></tr>}
                    </tbody>
                </table>
            </section>

            {hasProjection && (
                <section className="rounded-[10px] bg-neutral-second p-4 flex flex-col gap-3">
                    <h3 className="font-medium">Current-state projections</h3>
                    <p className="text-sm opacity-70">Recompute every context from its activities, e.g. after a projection fix. Activities are not changed.</p>
                    <button type="button" className="self-start px-4 py-2 rounded-md border border-secondary-second text-sm" onClick={rebuild}>Rebuild projections</button>
                </section>
            )}

            <ReasonDialog
                open={!!unlocking}
                title="Reopen this period?"
                confirmText="Reopen"
                onCancel={() => setUnlocking(null)}
                onConfirm={async (reason) => {
                    try {
                        await api("unlock_period", { register_mnemonic: registerMnemonic, lock_id: unlocking!.lock_id, reason });
                        toast.success("Period reopened");
                        setUnlocking(null);
                        load();
                    } catch (error) {
                        toast.error(errorMessage(error));
                    }
                }}
            />
        </div>
    );
}
