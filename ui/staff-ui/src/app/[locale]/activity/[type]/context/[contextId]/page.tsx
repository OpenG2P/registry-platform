'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'react-toastify';
import { BreadcrumbBar } from '@/components/shared';
import { Link } from '@/i18n/navigation';
import Can from '@/components/shared/Can';
import { ACTIVITY_ACTIONS } from '@/features/shared/permissions';
import { errorMessage, useActivityApi } from '@/features/activity/hooks/useActivityApi';
import { useActivityRegisters, findRegister } from '@/features/activity/hooks/useActivityRegisters';
import { useActivityTypes } from '@/features/activity/hooks/useActivityTypes';
import ActivityList from '@/features/activity/components/ActivityList';
import RecordActivity from '@/features/activity/components/RecordActivity';
import ReasonDialog from '@/features/activity/components/ReasonDialog';
import type { ActivityContext, JsonValue } from '@/features/activity/types';
import { formatDate, humanize } from '@/features/activity/utils/labels';
import { asGeoDimensions, formatLocation, locationTooltip } from '@/features/activity/utils/geo';

const HIDDEN = new Set([
    'context_id', 'context_key', 'subject_type', 'projected_at', 'geo_code_hierarchy_json', 'last_activity_id',
    'geo_dimensions', 'geo_lowest_level_value_id', 'replaces_context_id', 'replaced_by_context_id',
]);

/** One context (e.g. a crop season): current state, full timeline, and recording the next activity. */
export default function ActivityContextPage() {
    const { type, contextId } = useParams<{ type: string; contextId: string }>();
    const api = useActivityApi();
    const { registers } = useActivityRegisters();
    const register = findRegister(registers, type);
    const mnemonic = register?.register_mnemonic ?? '';
    const { types, byType } = useActivityTypes(mnemonic);
    const [context, setContext] = useState<ActivityContext | null>(null);
    const [projection, setProjection] = useState<Record<string, JsonValue> | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [recording, setRecording] = useState(false);
    const [statusDialog, setStatusDialog] = useState<'close' | 'reopen' | null>(null);

    const hasProjection = register?.has_projection ?? false;

    useEffect(() => {
        if (!mnemonic) return;
        let cancelled = false;
        api<ActivityContext[]>('search_contexts', { register_mnemonic: mnemonic, context_id: contextId })
            .then(({ data }) => { if (!cancelled) setContext(data?.[0] ?? null); })
            .catch((error) => toast.error(errorMessage(error)));
        if (hasProjection) {
            api<Record<string, JsonValue>>('get_projection', { register_mnemonic: mnemonic, context_id: contextId })
                .then(({ data }) => { if (!cancelled) setProjection(data); })
                .catch(() => { if (!cancelled) setProjection(null); });
        }
        return () => { cancelled = true; };
    }, [api, mnemonic, hasProjection, contextId, refreshKey]);

    const geo = asGeoDimensions(projection?.geo_dimensions);
    const locationCode = projection?.geo_lowest_level_value_id;
    const location = geo || locationCode ? formatLocation(geo, locationCode ? String(locationCode) : undefined) : null;

    const fixed = Object.fromEntries(
        Object.entries(context?.attributes ?? {}).filter(([, v]) => v !== null && v !== undefined && v !== ''),
    );

    return (
        <div className="min-h-screen bg-secondary-first pb-10">
            <div className="px-7.5 pt-5 flex flex-col gap-2">
                <BreadcrumbBar breadcrumb={[
                    { label: 'Activity registers', href: '/activity' },
                    { label: mnemonic || type, href: `/activity/${type}` },
                    { label: context?.context_key ?? contextId },
                ]} />
            </div>

            <div className="mx-7.5 mt-4 grid grid-cols-1 xl:grid-cols-3 gap-4">
                <section className="rounded-[10px] bg-neutral-second p-5 flex flex-col gap-3 xl:col-span-1">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h1 className="text-lg font-semibold">{context?.context_key ?? '…'}</h1>
                            <p className="text-sm opacity-70">{humanize(context?.context_type)} · {context?.status === 'CLOSED' ? 'Closed' : 'Open'}</p>
                        </div>
                        <Can action={ACTIVITY_ACTIONS.correct}>
                            {context && (
                                <button type="button" className="text-sm underline" onClick={() => setStatusDialog(context.status === 'CLOSED' ? 'reopen' : 'close')}>
                                    {context.status === 'CLOSED' ? 'Reopen' : 'Close'}
                                </button>
                            )}
                        </Can>
                    </div>
                    {context?.status === 'CLOSED' && (
                        <p className="text-sm rounded-md bg-secondary-first p-2">Closed {formatDate(context.closed_at)} by {context.closed_by}: {context.close_reason}</p>
                    )}
                    {(context?.replaces_context_id || context?.replaced_by_context_id) && (
                        <p className="text-sm rounded-md bg-secondary-first p-2 flex flex-col gap-1">
                            {context.replaced_by_context_id && (
                                <span>Replaced by <Link className="underline" href={`/activity/${type}/context/${context.replaced_by_context_id}`}>a later context</Link> (e.g. the crop was changed).</span>
                            )}
                            {context.replaces_context_id && (
                                <span>Replaces <Link className="underline" href={`/activity/${type}/context/${context.replaces_context_id}`}>an earlier context</Link>.</span>
                            )}
                        </p>
                    )}
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                        {location && (
                            <>
                                <dt className="opacity-70">Location</dt>
                                <dd title={locationTooltip(geo)}>{location}</dd>
                            </>
                        )}
                        {Object.entries(projection ?? context?.attributes ?? {})
                            .filter(([k, v]) => !HIDDEN.has(k) && v !== null && v !== undefined && v !== '')
                            .map(([k, v]) => (
                                <div key={k} className="contents">
                                    <dt className="opacity-70">{humanize(k)}</dt>
                                    <dd>{typeof v === 'boolean' ? (v ? 'Yes' : 'No') : k.endsWith('_date') || k.endsWith('_at') ? formatDate(String(v)) : String(v)}</dd>
                                </div>
                            ))}
                    </dl>
                </section>

                <section className="xl:col-span-2 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h2 className="font-semibold">Timeline</h2>
                        <Can action={ACTIVITY_ACTIONS.create}>
                            {context?.status !== 'CLOSED' && (
                                <button type="button" className="px-4 py-2 rounded-md bg-primary-first text-neutral-second text-sm" onClick={() => setRecording(!recording)}>
                                    {recording ? 'Cancel' : 'Record next activity'}
                                </button>
                            )}
                        </Can>
                    </div>
                    {recording && types.length > 0 && (
                        <RecordActivity
                            registerMnemonic={mnemonic}
                            types={types}
                            fixed={fixed}
                            contextId={contextId}
                            onRecorded={() => { setRecording(false); setRefreshKey((k) => k + 1); }}
                        />
                    )}
                    {mnemonic && (
                        <ActivityList registerMnemonic={mnemonic} types={types} byType={byType} contextId={contextId} timeline refreshKey={refreshKey} />
                    )}
                </section>
            </div>

            <ReasonDialog
                open={!!statusDialog}
                title={statusDialog === 'close' ? 'Close this context?' : 'Reopen this context?'}
                description={statusDialog === 'close' ? 'No further activities can be recorded until it is reopened.' : undefined}
                confirmText={statusDialog === 'close' ? 'Close' : 'Reopen'}
                required={statusDialog === 'close'}
                onCancel={() => setStatusDialog(null)}
                onConfirm={async (reason) => {
                    try {
                        await api(statusDialog === 'close' ? 'close_context' : 'reopen_context',
                            { register_mnemonic: mnemonic, context_id: contextId, reason: reason || undefined });
                        toast.success(statusDialog === 'close' ? 'Closed' : 'Reopened');
                        setStatusDialog(null);
                        setRefreshKey((k) => k + 1);
                    } catch (error) {
                        toast.error(errorMessage(error));
                    }
                }}
            />
        </div>
    );
}
