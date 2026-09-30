"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import Can from "@/components/shared/Can";
import { ACTIVITY_ACTIONS } from "@/features/shared/permissions";
import { errorMessage, useActivityApi } from "../hooks/useActivityApi";
import type { Activity, ActivityType, JsonValue } from "../types";
import { displayValue, fieldLabel, formatDateTime, humanize } from "../utils/labels";
import { formatEc } from "../utils/ethiopianCalendar";
import { activityLocationFallback, formatLocation, locationTooltip } from "../utils/geo";
import ReasonDialog from "./ReasonDialog";
import SchemaForm from "./SchemaForm";
import { StatusBadge, VerificationBadge } from "./StatusBadges";

interface Props {
    registerMnemonic: string;
    activity: Activity;
    type?: ActivityType;
    onChanged: (activity: Activity) => void;
    onClose: () => void;
}

type Pending = "void" | "reject" | "verify" | null;

/** One activity: what was recorded, how it was checked, and the actions allowed on it. */
export default function ActivityDetail({ registerMnemonic, activity, type, onChanged, onClose }: Props) {
    const api = useActivityApi();
    const [pending, setPending] = useState<Pending>(null);
    const [correcting, setCorrecting] = useState(false);
    const [correction, setCorrection] = useState<Record<string, JsonValue>>(activity.payload);
    const [correctionReason, setCorrectionReason] = useState("");
    const [busy, setBusy] = useState(false);

    const run = async (action: string, payload: Record<string, unknown>, done: string) => {
        try {
            const { data } = await api<Activity>(action, { register_mnemonic: registerMnemonic, ...payload });
            toast.success(done);
            onChanged(data);
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setPending(null);
        }
    };

    const submitCorrection = async () => {
        setBusy(true);
        try {
            const { data } = await api<Activity>("supersede_activity", {
                register_mnemonic: registerMnemonic,
                activity_id: activity.activity_id,
                reason: correctionReason,
                payload: correction,
            });
            toast.success("Correction recorded; the original is kept as superseded");
            setCorrecting(false);
            onChanged(data);
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(false);
        }
    };

    const isActive = activity.status === "ACTIVE";
    const payloadFields = Object.keys(activity.payload ?? {});
    const location = formatLocation(activity.geo_dimensions, activityLocationFallback(type, activity.payload, activity.display));

    return (
        <aside className="fixed inset-y-0 right-0 w-full max-w-2xl bg-neutral-second shadow-2xl z-[90] flex flex-col" aria-label="Activity details">
            <header className="flex items-start justify-between gap-4 px-6 py-4 border-b border-secondary-second">
                <div className="flex flex-col gap-1">
                    <h2 className="text-lg font-semibold">{type?.display_name ?? activity.activity_type}</h2>
                    <p className="text-sm opacity-80">
                        {formatEc(activity.occurred_at)} · {activity.occurred_at.slice(0, 10)}
                    </p>
                    <p className="text-sm" title={locationTooltip(activity.geo_dimensions)}>
                        <span className="opacity-70">Location:</span> {location}
                    </p>
                    <div className="flex gap-2">
                        <StatusBadge status={activity.status} />
                        <VerificationBadge status={activity.verification_status} />
                    </div>
                </div>
                <button type="button" onClick={onClose} className="text-sm underline">Close</button>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-6">
                {!!activity.rule_warnings?.length && (
                    <section className="rounded-md bg-toast-warning/15 p-3 text-sm">
                        <h3 className="font-medium mb-1">Accepted with warnings</h3>
                        <ul className="list-disc pl-5">
                            {activity.rule_warnings.map((w) => <li key={w}>{w}</li>)}
                        </ul>
                    </section>
                )}

                {correcting ? (
                    <section className="flex flex-col gap-4">
                        <h3 className="font-medium">Correct this activity</h3>
                        <p className="text-sm opacity-80">
                            Saving records a new activity that supersedes this one. The original stays in the history.
                        </p>
                        {type && (
                            <SchemaForm
                                type={type}
                                value={correction}
                                onChange={setCorrection}
                                lockedFields={["farmer_id", "plot_id", "crop_year", "season", "crop"]}
                            />
                        )}
                        <label htmlFor="correction-reason" className="text-sm font-medium">Reason for the correction *</label>
                        <textarea
                            id="correction-reason"
                            rows={2}
                            className="border border-secondary-second rounded-md px-3 py-2 bg-neutral-second text-sm"
                            value={correctionReason}
                            onChange={(e) => setCorrectionReason(e.target.value)}
                        />
                        <div className="flex gap-3">
                            <button
                                type="button"
                                disabled={busy || !correctionReason.trim()}
                                onClick={submitCorrection}
                                className="px-4 py-2 rounded-md bg-primary-first text-neutral-second text-sm disabled:opacity-50"
                            >
                                {busy ? "Saving…" : "Save correction"}
                            </button>
                            <button type="button" onClick={() => setCorrecting(false)} className="px-4 py-2 rounded-md border border-secondary-second text-sm">
                                Cancel
                            </button>
                        </div>
                    </section>
                ) : (
                    <section>
                        <h3 className="font-medium mb-2">Recorded</h3>
                        <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-4 gap-y-2 text-sm">
                            {payloadFields.map((field) => (
                                <div key={field} className="contents">
                                    <dt className="opacity-70">{fieldLabel(type, field)}</dt>
                                    <dd>{displayValue(type, field, activity.payload[field], activity.display)}</dd>
                                </div>
                            ))}
                        </dl>
                    </section>
                )}

                {activity.enrichment && Object.keys(activity.enrichment).length > 0 && (
                    <section>
                        <h3 className="font-medium mb-1">Enrichment</h3>
                        <p className="text-xs opacity-70 mb-2">Derived or external data added after the activity was recorded.</p>
                        <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-4 gap-y-2 text-sm">
                            {Object.entries(activity.enrichment).map(([key, value]) => (
                                <div key={key} className="contents">
                                    <dt className="opacity-70">{humanize(key)}</dt>
                                    <dd className="break-words">{displayValue(undefined, key, value)}</dd>
                                </div>
                            ))}
                        </dl>
                    </section>
                )}

                <section>
                    <h3 className="font-medium mb-2">Checks</h3>
                    <ul className="text-sm flex flex-col gap-1">
                        {Object.entries(activity.reference_checks ?? {}).map(([field, check]) => (
                            <li key={field}>
                                <span className="opacity-70">{fieldLabel(type, field.split(".")[0])}:</span>{" "}
                                {check.status.toLowerCase().replace("_", " ")}
                                {check.message ? ` — ${check.message}` : ""}
                            </li>
                        ))}
                        {!Object.keys(activity.reference_checks ?? {}).length && <li className="opacity-70">No reference checks for this type.</li>}
                    </ul>
                </section>

                <section>
                    <h3 className="font-medium mb-2">History</h3>
                    <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-4 gap-y-2 text-sm">
                        <dt className="opacity-70">Recorded</dt>
                        <dd>{formatDateTime(activity.recorded_at)} by {activity.recorded_by} ({activity.channel.replace("_", " ").toLowerCase()})</dd>
                        {activity.schema_version != null && (<><dt className="opacity-70">Form</dt><dd>Form version {activity.schema_version}</dd></>)}
                        {activity.submission_id && (<><dt className="opacity-70">Submission</dt><dd className="break-all">{activity.submission_id}</dd></>)}
                        {activity.source_record_id && (<><dt className="opacity-70">Source record</dt><dd className="break-all">{activity.source_record_id}</dd></>)}
                        {activity.supersedes_activity_id && (<><dt className="opacity-70">Corrects</dt><dd className="break-all">{activity.supersedes_activity_id}</dd></>)}
                        {activity.status !== "ACTIVE" && (
                            <>
                                <dt className="opacity-70">{activity.status === "VOIDED" ? "Voided" : "Superseded"}</dt>
                                <dd>{formatDateTime(activity.status_changed_at)} by {activity.status_changed_by}: {activity.status_reason}</dd>
                            </>
                        )}
                        {activity.verified_at && (
                            <>
                                <dt className="opacity-70">{activity.verification_status === "REJECTED" ? "Rejected" : "Verified"}</dt>
                                <dd>{formatDateTime(activity.verified_at)} by {activity.verified_by}{activity.verification_remarks ? `: ${activity.verification_remarks}` : ""}</dd>
                            </>
                        )}
                    </dl>
                </section>
            </div>

            {isActive && !correcting && (
                <footer className="flex flex-wrap gap-3 px-6 py-4 border-t border-secondary-second">
                    {activity.verification_status === "SUBMITTED" && (
                        <Can action={ACTIVITY_ACTIONS.verify}>
                            <button type="button" className="px-4 py-2 rounded-md bg-primary-first text-neutral-second text-sm" onClick={() => setPending("verify")}>
                                Verify
                            </button>
                            <button type="button" className="px-4 py-2 rounded-md border border-toast-failed text-toast-failed text-sm" onClick={() => setPending("reject")}>
                                Reject
                            </button>
                        </Can>
                    )}
                    <Can action={ACTIVITY_ACTIONS.correct}>
                        <button type="button" className="px-4 py-2 rounded-md border border-secondary-second text-sm" onClick={() => setCorrecting(true)}>
                            Correct
                        </button>
                        <button type="button" className="px-4 py-2 rounded-md border border-toast-failed text-toast-failed text-sm" onClick={() => setPending("void")}>
                            Void
                        </button>
                    </Can>
                </footer>
            )}

            <ReasonDialog
                open={pending === "void"}
                title="Void this activity?"
                description="A voided activity stays in the history but no longer counts. Use this for entries made by mistake."
                confirmText="Void activity"
                danger
                onCancel={() => setPending(null)}
                onConfirm={(reason) => run("void_activity", { activity_id: activity.activity_id, reason }, "Activity voided")}
            />
            <ReasonDialog
                open={pending === "reject"}
                title="Reject this activity?"
                description="The recorder can submit a corrected activity."
                confirmText="Reject"
                danger
                onCancel={() => setPending(null)}
                onConfirm={(reason) => run("reject_activity", { activity_id: activity.activity_id, reason }, "Activity rejected")}
            />
            <ReasonDialog
                open={pending === "verify"}
                title="Verify this activity?"
                confirmText="Verify"
                required={false}
                onCancel={() => setPending(null)}
                onConfirm={(reason) => run("verify_activity", { activity_id: activity.activity_id, reason: reason || undefined }, "Activity verified")}
            />
        </aside>
    );
}
