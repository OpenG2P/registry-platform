"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import type { Activity, ActivityInput, ActivityType, AppendResult, JsonValue } from "../types";
import { errorMessage, useActivityApi } from "../hooks/useActivityApi";
import { useLatestActivity } from "../hooks/useLatestActivity";
import { formatEc } from "../utils/ethiopianCalendar";
import { prefillPayload } from "../utils/prefill";
import EthiopianDateInput from "./EthiopianDateInput";
import SchemaForm from "./SchemaForm";

/** The registry record an activity is about, when recording from its profile. */
export interface RecordSubject {
    internalRecordId: string;
    registerMnemonic?: string;
    label?: string;
}

interface Props {
    registerMnemonic: string;
    types: ActivityType[];
    /** Prefill (e.g. from a crop-season page); these fields are shown read-only. */
    fixed?: Record<string, JsonValue>;
    contextId?: string;
    subject?: RecordSubject;
    initialType?: string;
    onRecorded?: (activity: Activity) => void;
}

/**
 * Record one activity, or several at once (batch): each batch row shares the
 * type and date and differs only in its own fields — e.g. the same sowing
 * survey across many plots. A single entry is pre-filled from the last
 * activity of the same type for the context or subject.
 */
export default function RecordActivity({ registerMnemonic, types, fixed = {}, contextId, subject, initialType, onRecorded }: Props) {
    const api = useActivityApi();
    const [activityType, setActivityType] = useState(initialType ?? types[0]?.activity_type ?? "");
    const [occurredOn, setOccurredOn] = useState<string | undefined>(new Date().toISOString().slice(0, 10));
    const [rows, setRows] = useState<Record<string, JsonValue>[]>([{ ...fixed }]);
    const [results, setResults] = useState<AppendResult[] | null>(null);
    const [busy, setBusy] = useState(false);
    const type = types.find((t) => t.activity_type === activityType);

    // Form defaults from the last activity of this type (dates, photos and documents excluded).
    const typedSubjectId = rows.length === 1 && typeof rows[0]?.subject_id === "string" ? rows[0].subject_id : undefined;
    const latest = useLatestActivity({
        registerMnemonic,
        activityType,
        contextId,
        subjectId: typedSubjectId,
        subjectInternalRecordId: subject?.internalRecordId,
    });
    const [appliedId, setAppliedId] = useState<string | null>(null);
    const [filledFrom, setFilledFrom] = useState<Activity | null>(null);
    if (latest && type && rows.length === 1 && latest.activity_id !== appliedId) {
        setAppliedId(latest.activity_id);
        setRows([{ ...prefillPayload(type, latest.payload), ...rows[0], ...fixed }]);
        setFilledFrom(latest);
    }
    const clearPrefill = () => {
        setRows([{ ...fixed }]);
        setFilledFrom(null);
    };

    const submit = async () => {
        if (!occurredOn) return;
        setBusy(true);
        setResults(null);
        try {
            const activities: ActivityInput[] = rows.map((payload) => ({
                register_mnemonic: registerMnemonic,
                activity_type: activityType,
                occurred_at: `${occurredOn}T00:00:00Z`,
                context_id: contextId,
                subject_internal_record_id: subject?.internalRecordId,
                subject_register_mnemonic: subject?.internalRecordId ? subject.registerMnemonic : undefined,
                payload,
                idempotency_key: `ui:${crypto.randomUUID()}`,
            }));
            if (activities.length === 1) {
                const { data } = await api<{ outcome: string; activity: Activity }>("append_activity", { ...activities[0] });
                toast.success(data.activity.rule_warnings?.length ? "Recorded, with warnings" : "Recorded");
                setRows([{ ...fixed }]);
                setFilledFrom(null);
                onRecorded?.(data.activity);
            } else {
                const submissionId = crypto.randomUUID();
                const { data } = await api<AppendResult[]>("append_activities", {
                    activities: activities.map((a) => ({ ...a, submission_id: submissionId })),
                    atomic: false,
                    submission_id: submissionId,
                });
                setResults(data);
                const failed = data.filter((r) => r.outcome === "FAILED").length;
                if (failed) toast.warning(`${data.length - failed} recorded, ${failed} failed`);
                else toast.success(`${data.length} activities recorded`);
                setRows(rows.filter((_, i) => data[i]?.outcome === "FAILED"));
                const first = data.find((r) => r.activity)?.activity;
                if (first) onRecorded?.(first);
            }
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex flex-col gap-5">
            {subject?.internalRecordId && (
                <p className="rounded-md bg-primary-first/20 px-3 py-2 text-sm">
                    Recording for <span className="font-medium">{subject.label || subject.internalRecordId}</span>
                    {subject.registerMnemonic ? <span className="opacity-70"> ({subject.registerMnemonic})</span> : null}
                </p>
            )}
            <div className="flex flex-wrap items-end gap-6">
                <label className="flex flex-col gap-1 text-sm font-medium">
                    Activity
                    <select className="border border-secondary-second rounded-md px-3 py-2 bg-neutral-second text-sm min-w-60"
                        value={activityType} onChange={(e) => setActivityType(e.target.value)}>
                        {types.map((t) => <option key={t.activity_type} value={t.activity_type}>{t.display_name}</option>)}
                    </select>
                </label>
                <div className="flex flex-col gap-1 text-sm font-medium">
                    When it happened
                    <EthiopianDateInput id="occurred-on" value={occurredOn} onChange={setOccurredOn} />
                </div>
            </div>
            {type?.description && <p className="text-sm opacity-80">{type.description}</p>}
            {type?.requires_prior_types?.length ? (
                <p className="text-xs opacity-70">
                    Expected after: {type.requires_prior_types.join(", ")}
                    {type.sequence_enforcement === "BLOCK" ? " (required)" : " (a warning otherwise)"}
                    {type.requires_verification ? " · A supervisor verifies it" : ""}
                </p>
            ) : null}

            {filledFrom && rows.length === 1 && (
                <p className="flex flex-wrap items-center gap-2 text-xs rounded-md bg-secondary-first px-3 py-2">
                    Filled from the last {type?.display_name ?? filledFrom.activity_type} on {formatEc(filledFrom.occurred_at) || filledFrom.occurred_on_ec}
                    <span className="opacity-60">({filledFrom.occurred_at.slice(0, 10)})</span>
                    <button type="button" className="underline" onClick={clearPrefill}>Clear</button>
                </p>
            )}

            {type && rows.map((row, index) => (
                <div key={index} className="rounded-[10px] bg-neutral-second p-4 flex flex-col gap-3">
                    {rows.length > 1 && (
                        <div className="flex justify-between text-sm">
                            <span className="font-medium">Entry {index + 1}</span>
                            <button type="button" className="text-toast-failed" onClick={() => setRows(rows.filter((_, i) => i !== index))}>Remove</button>
                        </div>
                    )}
                    <SchemaForm
                        type={type}
                        value={row}
                        lockedFields={Object.keys(fixed)}
                        onChange={(value) => setRows(rows.map((r, i) => (i === index ? value : r)))}
                    />
                    {results?.[index]?.outcome === "FAILED" && (
                        <p className="text-sm text-toast-failed">{results[index].error_message}</p>
                    )}
                </div>
            ))}

            <div className="flex flex-wrap gap-3">
                <button type="button" disabled={busy || !type || !occurredOn} onClick={submit}
                    className="px-5 py-2 rounded-md bg-primary-first text-neutral-second text-sm disabled:opacity-50">
                    {busy ? "Saving…" : rows.length > 1 ? `Record ${rows.length} activities` : "Record activity"}
                </button>
                {!contextId && (
                    <button type="button" className="px-4 py-2 rounded-md border border-secondary-second text-sm"
                        onClick={() => setRows([...rows, { ...fixed, ...Object.fromEntries(Object.entries(rows[rows.length - 1] ?? {}).filter(([k]) => ["crop_year", "season", "da_id"].includes(k))) }])}>
                        + Add another entry
                    </button>
                )}
                {occurredOn && <span className="self-center text-xs opacity-70">{formatEc(occurredOn)}</span>}
            </div>
        </div>
    );
}
