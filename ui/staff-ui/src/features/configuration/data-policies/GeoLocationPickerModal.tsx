'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight, Search, X } from 'lucide-react';
import type { GeoLevel, GeoLevelValue } from '@/features/configuration/shared/types/geo';
import { useGeoLevelValues } from '@/features/configuration/shared/hooks/useGeoLevelValues';
import { orderGeoLevelsByHierarchy } from './geoLevelUtils';
import { geoHierarchyKey, selectionFromHierarchy } from './geoLocationSerialization';
import type { GeoHierarchyRecord, GeoLocationSelection } from './geoLocationTypes';

type BreadcrumbItem = {
    levelId: string;
    levelMnemonic: string;
    levelValueId: string;
    levelValueMnemonic: string;
    label: string;
};

interface GeoLocationPickerModalProps {
    geoLevels: GeoLevel[];
    onClose: () => void;
    onConfirm: (selections: GeoLocationSelection[]) => void;
}

function GeoChildCountBadge({
    childLevelId,
    parentLevelValueId,
}: {
    childLevelId: string;
    parentLevelValueId: string;
}) {
    const t = useTranslations();
    const { allGeoLevelValues, loading } = useGeoLevelValues(
        childLevelId,
        parentLevelValueId,
        1,
        500,
    );

    if (loading || !allGeoLevelValues.length) {
        return null;
    }

    return (
        <span className="shrink-0 text-xs text-neutral-first/50">
            {t('geo_sub_locations_count', { count: allGeoLevelValues.length })}
        </span>
    );
}

function GeoLocationListRow({
    value,
    nextLevel,
    hasChildLevel,
    isChecked,
    onDrillDown,
    onToggle,
}: {
    value: GeoLevelValue;
    nextLevel?: GeoLevel;
    hasChildLevel: boolean;
    isChecked: boolean;
    onDrillDown: () => void;
    onToggle: (checked: boolean) => void;
}) {
    const label = value.level_value_mnemonic || value.level_value_id;

    return (
        <div className="flex items-center border-b border-primary-second/10 px-5 hover:bg-secondary-first/30">
            <button
                type="button"
                onClick={() => {
                    if (hasChildLevel) onDrillDown();
                }}
                className={`flex min-w-0 flex-1 items-center gap-2 py-3 text-left text-sm ${
                    hasChildLevel
                        ? 'font-medium text-neutral-first hover:text-primary-second'
                        : 'text-neutral-first'
                }`}
            >
                <ChevronRight
                    size={14}
                    className={`shrink-0 text-neutral-first/40 ${hasChildLevel ? '' : 'invisible'}`}
                />
                <span className="truncate">{label}</span>
                {hasChildLevel && nextLevel ? (
                    <GeoChildCountBadge
                        childLevelId={nextLevel.level_id}
                        parentLevelValueId={value.level_value_id}
                    />
                ) : null}
            </button>
            <label className="flex shrink-0 cursor-pointer items-center py-3 pl-3">
                <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(event) => onToggle(event.target.checked)}
                    className="h-4 w-4 accent-primary-second"
                />
            </label>
        </div>
    );
}

function buildHierarchyRecord(
    navigationStack: BreadcrumbItem[],
    currentLevel: GeoLevel,
    value: GeoLevelValue,
): GeoHierarchyRecord {
    const record: GeoHierarchyRecord = navigationStack.map((item) => ({
        level: item.levelMnemonic,
        level_value_id: item.levelValueId,
        level_value_mnemonic: item.levelValueMnemonic,
    }));

    record.push({
        level: currentLevel.level_mnemonic,
        level_value_id: value.level_value_id,
        level_value_mnemonic: value.level_value_mnemonic || value.level_value_id,
    });

    return record;
}

export default function GeoLocationPickerModal({
    geoLevels,
    onClose,
    onConfirm,
}: GeoLocationPickerModalProps) {
    const t = useTranslations();
    const orderedLevels = useMemo(() => orderGeoLevelsByHierarchy(geoLevels), [geoLevels]);

    const [navigationStack, setNavigationStack] = useState<BreadcrumbItem[]>([]);
    const [filterText, setFilterText] = useState('');
    const [pendingSelections, setPendingSelections] = useState<Map<string, GeoLocationSelection>>(
        () => new Map(),
    );

    const currentLevelIndex = navigationStack.length;
    const currentLevel = orderedLevels[currentLevelIndex];
    const nextLevel = orderedLevels[currentLevelIndex + 1];
    const parentLevelValueId = navigationStack[navigationStack.length - 1]?.levelValueId ?? '';

    const { allGeoLevelValues, loading } = useGeoLevelValues(
        currentLevel?.level_id,
        parentLevelValueId,
        1,
        500,
    );

    const filteredValues = useMemo(() => {
        const query = filterText.trim().toLowerCase();
        if (!query) return allGeoLevelValues;
        return allGeoLevelValues.filter((value) => {
            const label = value.level_value_mnemonic || value.level_value_id;
            return label.toLowerCase().includes(query);
        });
    }, [allGeoLevelValues, filterText]);

    const rootLabel = orderedLevels[0]?.level_mnemonic || t('geo_location_root');

    const toggleSelection = (value: GeoLevelValue, checked: boolean) => {
        if (!currentLevel) return;

        const hierarchy = buildHierarchyRecord(navigationStack, currentLevel, value);
        const selection = selectionFromHierarchy(hierarchy);
        const key = geoHierarchyKey(hierarchy);

        setPendingSelections((prev) => {
            const next = new Map(prev);
            if (checked) {
                next.set(key, selection);
            } else {
                next.delete(key);
            }
            return next;
        });
    };

    const drillDown = (value: GeoLevelValue) => {
        if (!currentLevel || currentLevelIndex >= orderedLevels.length - 1) return;

        const label = value.level_value_mnemonic || value.level_value_id;
        setNavigationStack((prev) => [
            ...prev,
            {
                levelId: currentLevel.level_id,
                levelMnemonic: currentLevel.level_mnemonic,
                levelValueId: value.level_value_id,
                levelValueMnemonic: value.level_value_mnemonic || value.level_value_id,
                label,
            },
        ]);
        setFilterText('');
    };

    const navigateTo = (index: number) => {
        setNavigationStack((prev) => (index < 0 ? [] : prev.slice(0, index + 1)));
        setFilterText('');
    };

    const handleConfirm = () => {
        onConfirm(Array.from(pendingSelections.values()));
        onClose();
    };

    if (!orderedLevels.length) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-first/80 p-6">
                <div className="w-full max-w-lg rounded-[10px] bg-neutral-second p-6">
                    <p className="text-neutral-first/70">{t('no_geo_levels_for_filter_fields')}</p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="mt-4 rounded-[10px] bg-secondary-second px-4 py-2 text-sm font-semibold"
                    >
                        {t('close')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-first/80 p-6">
            <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-[10px] border border-primary-second/30 bg-neutral-second shadow-lg">
                <div className="flex items-center justify-between border-b border-primary-second/20 px-5 py-4">
                    <h3 className="text-lg font-semibold text-neutral-first">
                        {t('select_administrative_location')}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-[8px] p-1 text-neutral-first/60 hover:bg-secondary-first hover:text-neutral-first"
                        aria-label={t('close')}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex min-h-[40px] flex-wrap items-center gap-1 border-b border-primary-second/20 bg-secondary-first/40 px-5 py-2 text-sm">
                    <button
                        type="button"
                        onClick={() => navigateTo(-1)}
                        className={`rounded px-1.5 py-0.5 ${
                            navigationStack.length === 0
                                ? 'font-medium text-neutral-first'
                                : 'text-primary-second hover:bg-primary-second/10'
                        }`}
                    >
                        {rootLabel}
                    </button>
                    {navigationStack.map((item, index) => (
                        <span key={`${item.levelValueId}-${index}`} className="flex items-center gap-1">
                            <ChevronRight size={14} className="text-neutral-first/40" />
                            <button
                                type="button"
                                onClick={() => navigateTo(index)}
                                className={`rounded px-1.5 py-0.5 ${
                                    index === navigationStack.length - 1
                                        ? 'font-medium text-neutral-first'
                                        : 'text-primary-second hover:bg-primary-second/10'
                                }`}
                            >
                                {item.label}
                            </button>
                        </span>
                    ))}
                </div>

                <div className="border-b border-amber-200/80 bg-amber-50 px-5 py-2 text-xs text-amber-900">
                    {t('geo_location_picker_hint')}
                </div>

                <div className="border-b border-primary-second/20 px-5 py-3">
                    <div className="relative">
                        <Search
                            size={16}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-first/40"
                        />
                        <input
                            type="text"
                            value={filterText}
                            onChange={(event) => setFilterText(event.target.value)}
                            placeholder={t('filter_geo_locations')}
                            className="w-full rounded-[10px] border border-primary-second bg-neutral-second py-2 pl-9 pr-3 text-sm outline-none focus:border-primary-second"
                        />
                    </div>
                </div>

                <div className="min-h-[220px] max-h-[360px] flex-1 overflow-y-auto">
                    {loading ? (
                        <p className="px-5 py-8 text-center text-sm text-neutral-first/50">
                            {t('filter_loading')}
                        </p>
                    ) : filteredValues.length === 0 ? (
                        <p className="px-5 py-8 text-center text-sm text-neutral-first/50">
                            {t('no_geo_locations_found')}
                        </p>
                    ) : (
                        filteredValues.map((value) => {
                            if (!currentLevel) return null;

                            const hierarchy = buildHierarchyRecord(
                                navigationStack,
                                currentLevel,
                                value,
                            );
                            const key = geoHierarchyKey(hierarchy);
                            const hasChildLevel = currentLevelIndex < orderedLevels.length - 1;

                            return (
                                <GeoLocationListRow
                                    key={value.level_value_id}
                                    value={value}
                                    nextLevel={nextLevel}
                                    hasChildLevel={hasChildLevel}
                                    isChecked={pendingSelections.has(key)}
                                    onDrillDown={() => drillDown(value)}
                                    onToggle={(checked) => toggleSelection(value, checked)}
                                />
                            );
                        })
                    )}
                </div>

                <div className="flex items-center justify-between border-t border-primary-second/20 px-5 py-3">
                    <span className="text-sm font-medium text-primary-second">
                        {t('geo_locations_selected_count', { count: pendingSelections.size })}
                    </span>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-[10px] border border-primary-second/40 bg-neutral-second px-4 py-2 text-sm font-semibold text-neutral-first/70"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={pendingSelections.size === 0}
                            className="rounded-[10px] bg-neutral-first px-4 py-2 text-sm font-semibold text-neutral-second disabled:opacity-50"
                        >
                            {t('select')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export type { GeoLocationSelection } from './geoLocationTypes';
