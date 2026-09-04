'use client';

import { useParams } from 'next/navigation';
import {
    createWidgetStore,
    SectionRenderer,
} from '@openg2p/registry-widgets';
import { CapsuleDropdown, TabsLayout } from '@/components/shared';
import { ApprovalList, ApprovalListSkeleton } from '@/features/approval/components';
import {
    useApprovalTasks,
    useSubmitApprovalDecision,
} from '@/features/approval/hooks';
import { useTranslations } from 'next-intl';
import { useRegisterTabs } from '@/context/RegisterTabsContext';
import { useBreadcrumb, useFetch } from '@/shared/hooks';
import { RegistryWidgetProvider } from '@/shared/widgets';
import { useChangeRequest } from '@/features/change-request/hooks';
import { useIntakeFormSubmission } from '@/features/intake-form/hooks/useIntakeFormSubmission';
import { useRecordHistoryDates, useRecordHistoryChanges } from '@/features/register/hooks/useRecordHistory';
import { useEffect, useMemo, useReducer, useRef } from 'react';
import { useRegister } from '@/context/RegisterContext';
import { useRegisterSectionsFromCR } from '@/features/change-request/hooks/useRegisterSectionsFromCR';
import { buildSectionDataMap, pickSubmissionSectionPayload } from '@/features/shared/utils';
import VersionHistoryPageSkeleton from '@/features/register/components/VersionHistoryPageSkeleton';

type Change = {
    change_request_id?: string | null;
    submission_id?: string | null;
    created_at: string;
    request_id?: string;
};

type SectionWithChanges = {
    section_mnemonic: string;
    section_register_id?: string | null;
    changes: Change[];
};

function versionKey(change: Change): string {
    return change.change_request_id || change.submission_id || '';
}

type FilterState = {
    dateOptions: string[];
    selectedDate: string | null;
    selectedSectionId: string | null;
    selectedVersionId: string | null;
    sectionsWithChanges: Record<string, SectionWithChanges>;
};

const initialFilterState: FilterState = {
    dateOptions: [],
    selectedDate: null,
    selectedSectionId: null,
    selectedVersionId: null,
    sectionsWithChanges: {},
};

function filterReducer(state: FilterState, action:
    | { type: 'SET_DATES'; dates: string[] }
    | { type: 'SET_CHANGES'; changes: Record<string, SectionWithChanges> }
    | { type: 'SELECT_DATE'; date: string }
    | { type: 'SELECT_SECTION'; id: string; versionId: string | null }
    | { type: 'SELECT_VERSION'; id: string }
    | { type: 'RESET' }
): FilterState {
    switch (action.type) {
        case 'SET_DATES':
            const newDate = state.selectedDate && action.dates.includes(state.selectedDate)
                ? state.selectedDate
                : action.dates[0] ?? null;
            return {
                ...state,
                dateOptions: action.dates,
                selectedDate: newDate
            };
        case 'SET_CHANGES':
            const firstId = Object.keys(action.changes)[0] ?? null;
            const firstVersion = firstId
                ? versionKey(action.changes[firstId]?.changes?.[0] ?? { created_at: '' }) || null
                : null;
            return {
                ...state,
                sectionsWithChanges: action.changes,
                selectedSectionId: firstId,
                selectedVersionId: firstVersion
            };
        case 'SELECT_DATE':
            return { ...state, selectedDate: action.date, selectedSectionId: null, selectedVersionId: null };
        case 'SELECT_SECTION':
            return { ...state, selectedSectionId: action.id, selectedVersionId: action.versionId };
        case 'SELECT_VERSION':
            return { ...state, selectedVersionId: action.id };
        case 'RESET':
            return initialFilterState;
        default:
            return state;
    }
}

export default function VersionHistoryPage() {
    const t = useTranslations();

    const { type: registerType, id: routeRecordId } =
        useParams<{ type: string; id: string }>();

    const { currentRegister } = useRegister();
    const internalRecordId = routeRecordId ? decodeURIComponent(routeRecordId) : '';
    const registerId = currentRegister?.register_id ?? '';

    const [filterState, dispatch] = useReducer(filterReducer, initialFilterState);
    const {
        dateOptions,
        selectedDate,
        selectedSectionId,
        selectedVersionId,
        sectionsWithChanges
    } = filterState;

    const widgetStore = useMemo(() => createWidgetStore(), [selectedVersionId]);

    const prevSectionData = useRef<typeof newSectionData>(undefined);
    const prevSectionUISchema = useRef<typeof sectionUISchema>(undefined);

    const {
        tabs,
        activeTabIndex,
        activeTabId,
        setActiveTabByIndex,
    } = useRegisterTabs();

    const { sectionUISchema, loadingSchema } = useRegisterSectionsFromCR({
        sectionId: selectedSectionId || '',
    });

    const {
        datesData,
        loadingDates,
    } = useRecordHistoryDates({
        register_id: registerId,
        internal_record_id: internalRecordId || '',
        tab_id: activeTabId,
    });

    const {
        changesData,
        loadingChanges,
    } = useRecordHistoryChanges({
        register_id: registerId,
        internal_record_id: internalRecordId || '',
        tab_id: activeTabId,
        truncated_created_date: selectedDate,
    });

    const { data: versionHistory, loading } = useFetch<any>({
        url: `/api/register/versions`,
        enabled: !!registerId && !!internalRecordId && !!activeTabId,
        options: {
            method: "POST",
            body: JSON.stringify({
                register_id: registerId,
                internal_record_id: internalRecordId,
                tab_id: activeTabId
            }),
        },
    });

    const selectedChange = useMemo(() => {
        if (!selectedSectionId || !selectedVersionId) return null;
        return (
            sectionsWithChanges[selectedSectionId]?.changes?.find(
                (change) => versionKey(change) === selectedVersionId,
            ) ?? null
        );
    }, [selectedSectionId, selectedVersionId, sectionsWithChanges]);

    const changeRequestId = selectedChange?.change_request_id ?? '';
    const intakeSubmissionId = !changeRequestId
        ? (selectedChange?.submission_id ?? undefined)
        : undefined;

    const { details: changeRequestData, loading: loadingChangeRequestData } =
        useChangeRequest(changeRequestId);
    const { submission: intakeSubmission, loading: loadingIntakeSubmission } =
        useIntakeFormSubmission(intakeSubmissionId);

    const intakeSectionPayload = useMemo(
        () =>
            pickSubmissionSectionPayload(
                intakeSubmission?.section_payloads,
                selectedSectionId || '',
                sectionsWithChanges[selectedSectionId || '']?.section_register_id,
            ),
        [intakeSubmission, selectedSectionId, sectionsWithChanges],
    );

    const aweRequestId =
        selectedChange?.request_id ?? intakeSubmission?.awe_request_id ?? null;

    const { tasks, loadingTasks, refetchTasks } = useApprovalTasks(aweRequestId);
    const { submitDecision } = useSubmitApprovalDecision(null, refetchTasks);

    /* ───────── Handle dates response ───────── */
    useEffect(() => {
        if (datesData?.dates?.length) {
            dispatch({ type: 'SET_DATES', dates: datesData.dates });
        } else if (datesData) {
            dispatch({ type: 'RESET' });
        }
    }, [datesData]);

    /* ───────── Handle changes response ───────── */
    useEffect(() => {
        if (!changesData) return;

        const changesArray = Array.isArray(changesData) ? changesData : (changesData?.changes ?? []);
        const dict: Record<string, SectionWithChanges> = {};

        changesArray.forEach((item: any) => {
            dict[item.section_id] = {
                section_mnemonic: item.section_mnemonic,
                section_register_id: item.section_register_id,
                changes: [...(item.changes ?? [])].reverse(),
            };
        });

        dispatch({ type: 'SET_CHANGES', changes: dict });
    }, [changesData]);

    const sectionOptions = useMemo(() => {
        return Object.entries(sectionsWithChanges).map(([id, data]) => ({
            id,
            label: t.has(data.section_mnemonic)
                ? t(data.section_mnemonic)
                : data.section_mnemonic,
        }));
    }, [sectionsWithChanges]);

    const currentSectionChanges = useMemo(() => {
        if (!selectedSectionId) return [];
        return sectionsWithChanges[selectedSectionId]?.changes ?? [];
    }, [selectedSectionId, sectionsWithChanges]);

    const versionOptions = useMemo(() => {
        return currentSectionChanges.map((change, index) => ({
            label: `V${index}`,
            value: versionKey(change),
        }));
    }, [currentSectionChanges]);


    const onDateSelect = (date: string) => {
        dispatch({ type: 'SELECT_DATE', date });
    };

    const onSectionSelect = (label: string) => {
        const selected = sectionOptions.find(section => section.label === label);
        if (!selected) return;

        dispatch({
            type: 'SELECT_SECTION',
            id: selected.id,
            versionId: versionKey(sectionsWithChanges[selected.id]?.changes?.[0] ?? { created_at: '' }) || null
        });
    };

    const onVersionSelect = (label: string) => {
        const option = versionOptions.find(version => version.label === label);
        if (option) {
            dispatch({ type: 'SELECT_VERSION', id: option.value });
        }
    };

    const handleTabChange = (index: number) => {
        setActiveTabByIndex(index);
        prevSectionData.current = undefined;
        prevSectionUISchema.current = undefined;
    };

    const newSectionData = useMemo(() => {
        if (changeRequestId && changeRequestData) {
            return buildSectionDataMap(
                changeRequestData.section_register_id ?? '',
                changeRequestData.change_payload,
                changeRequestData.documents || null,
                !!changeRequestData.is_list,
            );
        }
        if (intakeSectionPayload) {
            return buildSectionDataMap(
                intakeSectionPayload.section_register_id ?? '',
                intakeSectionPayload.records,
                intakeSectionPayload.documents || null,
                !!intakeSectionPayload.is_list,
            );
        }
        return undefined;
    }, [changeRequestId, changeRequestData, intakeSectionPayload]);

    if (newSectionData) prevSectionData.current = newSectionData;
    if (sectionUISchema) prevSectionUISchema.current = sectionUISchema;

    const stableSectionData = newSectionData ?? prevSectionData.current;
    const stableSectionUISchema = sectionUISchema ?? prevSectionUISchema.current;

    const isLoading =
        loadingDates ||
        loadingChanges ||
        (!!changeRequestId && loadingChangeRequestData) ||
        (!!intakeSubmissionId && loadingIntakeSubmission) ||
        loadingSchema ||
        (!!aweRequestId && loadingTasks);
    const hasAnythingToShow = !!stableSectionData && !!stableSectionUISchema;
    const showSkeleton = isLoading && !hasAnythingToShow;

    const breadcrumb = useBreadcrumb({
        registerType,
        internalRecordId,
        includeActiveTab: true,
        includeChangeRequest: false,
        customItems: [
            { label: t('version_history') ?? 'Version History', href: '#' },
        ],
    });

    const hasVersionHistory = dateOptions.length > 0;
    const isContentLoading = isLoading;

    return (
        <TabsLayout
            breadcrumb={breadcrumb}
            tabs={{ tabs }}
            activeTab={activeTabIndex}
            onTabChange={handleTabChange}
        >
            {showSkeleton ? (
                <VersionHistoryPageSkeleton tabs={tabs} />
            ) : (
                <div className={`flex items-start gap-6 transition-opacity duration-200 ${isContentLoading ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}>
                    <div className="w-[75%] flex flex-col gap-6">
                        {hasVersionHistory && (
                            <div className="bg-neutral-second rounded-[10px] px-6 py-5 flex items-center justify-between">
                                <div className="flex items-center gap-6">
                                    <CapsuleDropdown
                                        label={t("select_date")}
                                        items={dateOptions}
                                        value={selectedDate ?? undefined}
                                        onChange={onDateSelect}
                                    />

                                    <CapsuleDropdown
                                        label={t("select_section")}
                                        items={sectionOptions.map(s => s.label)}
                                        value={
                                            selectedSectionId
                                                ? sectionOptions.find(s => s.id === selectedSectionId)?.label
                                                : undefined
                                        }
                                        onChange={onSectionSelect}
                                        key={selectedDate ?? 'date'}
                                    />

                                    <CapsuleDropdown
                                        label={t("select_version")}
                                        items={versionOptions.map(v => v.label)}
                                        value={versionOptions.find(v => v.value === selectedVersionId)?.label}
                                        onChange={onVersionSelect}
                                        key={`${selectedDate}-${selectedSectionId}`}
                                        maxWidth='w-20'
                                    />
                                </div>

                                <div className="text-[16px] text-neutral-first font-medium">
                                    {t("total_versions")} <span className="text-[20px] font-bold text-primary-second">{versionHistory.number_of_versions}</span>
                                </div>

                            </div>
                        )}

                        {hasVersionHistory && stableSectionData && stableSectionUISchema && (
                            <div className="bg-neutral-second rounded-[30px]">
                                <RegistryWidgetProvider
                                    store={widgetStore}
                                    schemaData={stableSectionData}
                                    hostContext={{
                                        subject_register_id: registerId || undefined,
                                        internal_record_id: internalRecordId || undefined,
                                    }}
                                >
                                    <SectionRenderer
                                        section={stableSectionUISchema}
                                        hideEditButton
                                        mode="CRView"
                                    />
                                </RegistryWidgetProvider>
                            </div>
                        )}
                        {!hasVersionHistory && !isLoading && tabs.length > 0 && (
                            <div className="bg-neutral-second rounded-[10px] px-6 py-5 flex items-center justify-center text-center">
                                <div className="text-[16px] text-neutral-first/50 font-medium">
                                    {t("no_version_history")}
                                </div>
                            </div>
                        )}
                    </div>

                    {hasVersionHistory && (
                        <div className="w-[25%]">
                            {!!aweRequestId && loadingTasks ? (
                                <ApprovalListSkeleton />
                            ) : (
                                <ApprovalList
                                    tasks={tasks}
                                    isPending={false}
                                    onSubmitDecision={submitDecision}
                                />
                            )}
                        </div>
                    )}
                </div>
            )}
        </TabsLayout>
    );
}
