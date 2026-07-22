'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { GeoLocationSelection } from './geoLocationTypes';
import {
    formatGeoHierarchyRecord,
    toGeoPolicyFilterExpression,
} from './geoLocationSerialization';

type PreviewTab = 'summary' | 'json';

interface GeoPolicyPreviewProps {
    locations: GeoLocationSelection[];
}

export default function GeoPolicyPreview({ locations }: GeoPolicyPreviewProps) {
    const t = useTranslations();
    const [tab, setTab] = useState<PreviewTab>('summary');

    const jsonPreview = useMemo(() => {
        if (!locations.length) return '{}';
        return JSON.stringify(toGeoPolicyFilterExpression(locations), null, 2);
    }, [locations]);

    return (
        <div className="flex h-full min-h-[18rem] flex-col gap-3 rounded-[10px] border border-primary-second/40 bg-secondary-first/40 p-4">
            <h3 className="text-base font-semibold text-neutral-first">{t('filter_preview')}</h3>

            <div className="flex rounded-[10px] border border-primary-second/50 bg-neutral-second p-0.5">
                <button
                    type="button"
                    onClick={() => setTab('summary')}
                    className={`flex-1 rounded-[8px] px-3 py-2 text-sm font-semibold transition-colors ${
                        tab === 'summary'
                            ? 'bg-neutral-first text-neutral-second'
                            : 'text-neutral-first/60 hover:text-neutral-first'
                    }`}
                >
                    {t('filter_preview_summary')}
                </button>
                <button
                    type="button"
                    onClick={() => setTab('json')}
                    className={`flex-1 rounded-[8px] px-3 py-2 text-sm font-semibold transition-colors ${
                        tab === 'json'
                            ? 'bg-neutral-first text-neutral-second'
                            : 'text-neutral-first/60 hover:text-neutral-first'
                    }`}
                >
                    {t('filter_preview_json')}
                </button>
            </div>

            {tab === 'summary' ? (
                <div className="max-h-[32rem] min-h-[14rem] flex-1 overflow-y-auto">
                    {locations.length === 0 ? (
                        <p className="text-[16px] text-neutral-first/50">—</p>
                    ) : (
                        <ul className="space-y-2 text-[16px] text-neutral-first">
                            {locations.map((location) => (
                                <li
                                    key={location.displayName + location.displayPath}
                                    className="text-sm"
                                >
                                    {formatGeoHierarchyRecord(location.hierarchy)}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            ) : (
                <pre className="max-h-[32rem] min-h-[14rem] flex-1 overflow-auto rounded-[10px] border border-primary-second bg-neutral-second p-4 font-mono text-sm leading-relaxed text-neutral-first">
                    {jsonPreview}
                </pre>
            )}
        </div>
    );
}
