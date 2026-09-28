"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import Can from "@/components/shared/Can";
import { ACTIVITY_ACTIONS } from "@/features/shared/permissions";
import { useActivityTypes } from "../hooks/useActivityTypes";
import type { Activity, ActivityRegister, ActivityType, SubjectActivities } from "../types";
import { formatEc } from "../utils/ethiopianCalendar";
import { activityRegisterPath, displayValue, fieldLabel, humanize, registerLabel } from "../utils/labels";
import ActivityDetail from "./ActivityDetail";
import AggregateValues from "./AggregateValues";
import { StatusBadge, VerificationBadge } from "./StatusBadges";

/** The registry record whose profile this is. */
export interface ProfileSubject {
    internalRecordId: string;
    registerMnemonic?: string;
    label?: string;
}

interface Props {
    subject: ProfileSubject;
    groups: SubjectActivities[];
    registers: ActivityRegister[];
    loading: boolean;
    error: string | null;
    onChanged: () => void;
}

const MAX_SUMMARY_FIELDS = 4;

/** Where "Record activity" goes: the register's Record tab, bound to this record. */
function recordHref(mnemonic: string, subject: ProfileSubject): string {
    const params = new URLSearchParams({ tab: "record", subject_internal_record_id: subject.internalRecordId });
    if (subject.registerMnemonic) params.set("subject_register_mnemonic", subject.registerMnemonic);
    if (subject.label) params.set("subject_label", subject.label);
    return `${activityRegisterPath(mnemonic)}?${params.toString()}`;
}

function RecordButton({ mnemonic, subject, label = "Record activity" }: { mnemonic: string; subject: ProfileSubject; label?: string }) {
    return (
        <Can action={ACTIVITY_ACTIONS.create}>
            <Link href={recordHref(mnemonic, subject)} className="px-4 py-2 rounded-md bg-primary-first text-neutral-first text-sm font-medium whitespace-nowrap hover:opacity-90">
                {label}
            </Link>
        </Can>
    );
}

/**
 * A record profile's "Activities" tab: per activity register, the activities
 * about this record (and its child records) and the summaries kept for it.
 */
export default function RecordActivities({ subject, groups, registers, loading, error, onChanged }: Props) {
    if (loading) return <p className="px-6 py-5 text-sm opacity-70">Loading activities…</p>;
    if (error) return <p className="px-6 py-5 text-sm text-toast-failed">{error}</p>;

    const byMnemonic = Object.fromEntries(registers.map((r) => [r.register_mnemonic, r]));
    const nonEmpty = groups.filter((g) => g.activities.length || g.aggregates.length);

    if (!nonEmpty.length) {
        return (
            <div className="rounded-[10px] bg-neutral-second px-6 py-8 flex flex-col items-center gap-4 text-center">
                <p className="text-[16px] text-neutral-first/60 font-medium">No activities have been recorded for this record yet.</p>
                <div className="flex flex-wrap justify-center gap-3">
                    {registers.map((r) => (
                        <RecordButton key={r.register_id} mnemonic={r.register_mnemonic} subject={subject} label={`Record ${registerLabel(r).toLowerCase()}`} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {nonEmpty.map((group) => (
                <RegisterGroup
                    key={group.register_mnemonic}
                    group={group}
                    register={byMnemonic[group.register_mnemonic]}
                    subject={subject}
                    onChanged={onChanged}
                />
            ))}
        </div>
    );
}

interface GroupProps {
    group: SubjectActivities;
    register?: ActivityRegister;
    subject: ProfileSubject;
    onChanged: () => void;
}

function RegisterGroup({ group, register, subject, onChanged }: GroupProps) {
    const { byType } = useActivityTypes(group.register_mnemonic);
    const [selected, setSelected] = useState<Activity | null>(null);
    const title = registerLabel(register ?? group);
    const description = register?.register_description ?? group.register_description;

    return (
        <section className="rounded-[10px] bg-neutral-second p-5 flex flex-col gap-4">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <Link href={activityRegisterPath(group.register_mnemonic)} className="text-[18px] font-semibold hover:underline">{title}</Link>
                    {description && <p className="text-sm opacity-70">{description}</p>}
                </div>
                <RecordButton mnemonic={group.register_mnemonic} subject={subject} />
            </header>

            {group.activities.length > 0 && (
                <ActivityTimeline activities={group.activities} byType={byType} subject={subject} onSelect={setSelected} />
            )}

            {group.aggregates.length > 0 && (
                <div className="flex flex-col gap-2">
                    <h4 className="font-medium">Summaries</h4>
                    <ul className="flex flex-col gap-2 text-sm">
                        {group.aggregates.map((a) => (
                            <li key={a.aggregate_id} className="rounded-md bg-secondary-first px-3 py-2 flex flex-wrap gap-x-4 gap-y-1">
                                <span className="font-medium">{humanize(a.aggregate_type)}</span>
                                <span className="opacity-70">{a.period_key}</span>
                                {a.subject_internal_record_id && a.subject_internal_record_id !== subject.internalRecordId && (
                                    <span className="opacity-70">{a.subject_id}</span>
                                )}
                                <AggregateValues value={a.aggregate_value} />
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {selected && (
                <ActivityDetail
                    registerMnemonic={group.register_mnemonic}
                    activity={selected}
                    type={byType[selected.activity_type]}
                    onClose={() => setSelected(null)}
                    onChanged={() => { setSelected(null); onChanged(); }}
                />
            )}
        </section>
    );
}

interface TimelineProps {
    activities: Activity[];
    byType: Record<string, ActivityType>;
    subject: ProfileSubject;
    onSelect: (activity: Activity) => void;
}

/** Key payload values: the first few filled fields, in the form's order. */
function summaryFields(activity: Activity, type?: ActivityType): string[] {
    const order = Object.keys(type?.payload_schema?.properties ?? activity.payload ?? {});
    return order
        .filter((f) => {
            const v = activity.payload?.[f];
            return v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
        })
        .slice(0, MAX_SUMMARY_FIELDS);
}

function ActivityTimeline({ activities, byType, subject, onSelect }: TimelineProps) {
    const showAbout = activities.some((a) => a.subject_internal_record_id && a.subject_internal_record_id !== subject.internalRecordId);
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left border-b border-secondary-second">
                        <th className="py-2 pr-4 font-medium">Activity</th>
                        <th className="py-2 pr-4 font-medium">Date</th>
                        {showAbout && <th className="py-2 pr-4 font-medium">About</th>}
                        <th className="py-2 pr-4 font-medium">Details</th>
                        <th className="py-2 font-medium">State</th>
                    </tr>
                </thead>
                <tbody>
                    {activities.map((a) => {
                        const type = byType[a.activity_type];
                        return (
                            <tr
                                key={a.activity_id}
                                className={`border-b border-secondary-second cursor-pointer hover:bg-secondary-first ${a.status !== "ACTIVE" ? "opacity-60" : ""}`}
                                onClick={() => onSelect(a)}
                            >
                                <td className="py-2 pr-4 font-medium">{type?.display_name ?? humanize(a.activity_type)}</td>
                                <td className="py-2 pr-4 whitespace-nowrap" title={`Gregorian: ${a.occurred_at.slice(0, 10)}`}>
                                    {formatEc(a.occurred_at) || a.occurred_on_ec}
                                </td>
                                {showAbout && (
                                    <td className="py-2 pr-4 whitespace-nowrap">
                                        {a.subject_internal_record_id === subject.internalRecordId ? "This record" : a.subject_id ?? "—"}
                                    </td>
                                )}
                                <td className="py-2 pr-4">
                                    {summaryFields(a, type).map((f) => (
                                        <span key={f} className="mr-3 whitespace-nowrap">
                                            <span className="opacity-60">{fieldLabel(type, f)}:</span> {displayValue(type, f, a.payload[f], a.display)}
                                        </span>
                                    ))}
                                </td>
                                <td className="py-2">
                                    <div className="flex flex-wrap gap-1">
                                        <StatusBadge status={a.status} />
                                        <VerificationBadge status={a.verification_status} />
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
