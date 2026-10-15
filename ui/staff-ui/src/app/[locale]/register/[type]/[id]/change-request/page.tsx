'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { PaginationBar, TabsLayout } from '@/components/shared';
import { ChangeRequestList, ChangeRequestSkeleton } from '@/features/change-request/components';
import { useChangeRequestList } from '@/features/change-request/hooks/useChangeRequestList';
import { useLocale, useTranslations } from 'next-intl';
import { useRegister } from '@/context/RegisterContext';
import { useRegisterTabs } from '@/context/RegisterTabsContext';
import { useBreadcrumb, usePagination, usePageSize } from '@/shared/hooks';
import { useFetch } from '@/shared/hooks/useFetch';

export default function ChangeRequestPage() {
    const t = useTranslations();
    const locale = useLocale();
    const { type: registerType, id } = useParams<{ type: string; id: string }>();
    const internalRecordId = id ? decodeURIComponent(id) : undefined;
    const recordName = useSearchParams().get('record_name')?.trim();
    const { currentRegister } = useRegister();

    const {
        tabs,
        activeTabIndex,
        activeTabId,
        setActiveTabByIndex,
    } = useRegisterTabs();

    const subjectRegisterId = currentRegister?.register_id;
    const pageSize = usePageSize();

    const {
        changeRequests,
        loading,
        currentPage,
        paginationInfo,
        onPrev,
        onNext,
    } = useChangeRequestList({
        subjectRecordId: internalRecordId,
        subjectRegisterId: subjectRegisterId,
        tabId: activeTabId,
        pageSize,
        enabled: !!activeTabId && !!internalRecordId && !!subjectRegisterId,
    });

    const { data: pendingData } = useFetch<any>({
        url: '/api/change-request/pending',
        enabled: !!subjectRegisterId && !!internalRecordId && !!activeTabId,
        options: {
            method: 'POST',
            body: JSON.stringify({
                subject_register_id: subjectRegisterId,
                subject_record_id: internalRecordId,
                tab_id: activeTabId,
            }),
        },
    });

    const { pageStart, pageEnd, total } = usePagination({
        totalItems: paginationInfo?.number_of_items ?? 0,
        currentPage,
        pageSize,
        currentCount: changeRequests.length,
    });

    const breadcrumb = useBreadcrumb({
        registerType,
        internalRecordId,
        recordName,
        includeActiveTab: true,
        includeChangeRequest: true,
    });

    // Right side of TabsLayout-- Pending request + pagination
    const pendingRequestsCount = pendingData?.number_of_pending_change_requests ?? 0;
    const rightContent = !loading && (
        <div className="flex w-full min-w-0 flex-wrap items-center justify-start gap-3 sm:w-auto sm:justify-end sm:gap-6 lg:gap-10">
            {pendingRequestsCount !== undefined && (
                <div className="flex min-w-0 items-center gap-2">
                    <span className="text-base font-medium text-neutral-first sm:text-[18px]">
                        {t('pending_requests')}
                    </span>
                    <span className="shrink-0 text-xl font-bold text-primary-second sm:text-[24px]">
                        {pendingRequestsCount.toString().padStart(2, '0')}
                    </span>
                </div>
            )}
            <div className="sm:mb-2.5">
                <PaginationBar
                    pageStart={pageStart ?? 0}
                    pageEnd={pageEnd ?? 0}
                    total={total ?? 0}
                    onPrev={onPrev}
                    onNext={onNext}
                />
            </div>
        </div>
    );

    return (
        <TabsLayout
            breadcrumb={breadcrumb}
            tabs={{ tabs }}
            activeTab={activeTabIndex}
            onTabChange={setActiveTabByIndex}
            rightContent={rightContent}
        >
            {loading ? (
                <>
                    {(tabs.length === 0 && <div className="flex gap-2">
                        {[1, 2, 3].map(i => (
                            <div
                                key={i}
                                className="h-11 w-32 rounded-t-[10px] bg-primary-first/50"
                            />
                        ))}
                    </div>)}
                    <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                            <ChangeRequestSkeleton key={i} />
                        ))}
                    </div>
                </>
            ) : changeRequests.length === 0 ? (
                <div className="px-6 py-5 flex items-center justify-center text-center">
                    <div className="text-[16px] text-neutral-first/50 font-medium">
                        {t("no_change_request")}
                    </div>
                </div>
            ) : (
                <>
                    <ChangeRequestList
                        changeRequests={changeRequests}
                        getDetailsUrl={changeRequest => {
                            const params = new URLSearchParams();
                            if (activeTabId) params.set('tab', activeTabId);
                            if (recordName) params.set('record_name', recordName);
                            const qs = params.toString();
                            return `/${locale}/register/${registerType}/${internalRecordId}/change-request/${changeRequest.change_request_id}${qs ? `?${qs}` : ''}`;
                        }}
                    />
                </>
            )}
        </TabsLayout>
    );
}
