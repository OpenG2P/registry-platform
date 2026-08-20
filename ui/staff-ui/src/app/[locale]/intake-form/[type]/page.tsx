'use client';

import { useTranslations } from 'next-intl';
import { useRegister } from '@/context/RegisterContext';
import { useParams, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';

import { EntityListPage, StackedCardSkeleton } from '@/components/shared';
import { ColumnDef } from '@/components/shared/entity-list/types';
import { IntakeFormSubmissionCard } from '@/features/intake-form/components/SubmissionCard';
import { IntakeFormSubmission } from '@/features/intake-form/types/intake-form';
import { usePagination } from '@/shared/hooks';
import { STATIC_INPUT_MECHANISMS } from '@/features/intake-form/constants/inputMechanisms';
import { useIntakeSubmissions } from '@/features/intake-form/hooks/useIntakeSubmissions';
import { INTAKE_FORM_ACTIONS } from '@/features/shared/permissions';
import Can from '@/components/shared/Can';
import { useRuntimeConfig } from '@/context/RuntimeConfigContext';
import AddNewDropdown from '@/components/ui/AddNewDropdown';

const statusClassMap: Record<string, string> = {
    REJECTED: 'text-toast-failed',
    PENDING: 'text-amber-500',
    APPROVED: 'text-toast-success',
};

export default function IntakeFormPage() {
    const t = useTranslations();
    const { config } = useRuntimeConfig();
    const router = useRouter();

    const routeParams = useParams<{ type: string }>();
    const registerType = routeParams.type;

    const searchParams = useSearchParams();
    const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
    const [sortBy, setSortBy] = useState<string | null>(searchParams.get('sort') || null);
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = config?.pageSize || 10;

    const { currentRegister } = useRegister();
    const registerId = currentRegister?.register_id;

    const mechanisms = STATIC_INPUT_MECHANISMS.map(({ labelKey, ...mechanism }) => ({
        ...mechanism,
        display_key: t(labelKey),
    }));

    const { submissions, paginationInfo, loading: submissionsLoading } = useIntakeSubmissions(
        registerId,
        { searchText: searchQuery, currentPage, pageSize, sortBy },
    );

    const pagination = usePagination({
        totalItems: paginationInfo?.number_of_items ?? 0,
        currentPage,
        pageSize,
        currentCount: submissions?.length || 0,
    });

    const handleSearch = (newSearchQuery: string) => {
        setSearchQuery(newSearchQuery);
        setCurrentPage(1);
    };

    const handleSort = (nextSortBy: string | null) => {
        setSortBy(nextSortBy);
        setCurrentPage(1);
    };

    const columns: ColumnDef<IntakeFormSubmission>[] = [
        {
            key: 'application_reference',
            header: t.has('application_reference') ? t('application_reference') : 'Application Reference',
            getValue: (s) => s.application_reference ?? s.submission_id,
            render: (s) => (
                <span className="font-medium text-[15px]">
                    {s.application_reference?.trim() || s.submission_id}
                </span>
            ),
        },
        {
            key: 'record_name',
            header: t.has('record_name') ? t('record_name') : 'Record name',
            getValue: (s) => s.record_name ?? '',
        },
        {
            key: 'submission_source',
            header: t.has('source') ? t('source') : 'Source',
            getValue: (s) => s.submission_source,
        },
        {
            key: 'draft_status',
            header: t.has('form_status') ? t('form_status') : 'Form status',
            getValue: (s) => s.draft_status,
        },
        {
            key: 'approval_status',
            header: t.has('approval_status') ? t('approval_status') : 'Approval',
            getValue: (s) => s.approval_status,
            render: (s) => (
                <span className={`font-medium ${statusClassMap[s.approval_status] ?? ''}`}>
                    {s.approval_status}
                </span>
            ),
        },
        {
            key: 'first_created_at',
            header: t.has('created_at') ? t('created_at') : 'Created at',
            getValue: (s) => s.first_created_at,
            render: (s) =>
                s.first_created_at ? new Date(s.first_created_at).toLocaleDateString() : '—',
        },
        {
            key: 'created_by',
            header: t.has('created_by') ? t('created_by') : 'Created By',
            getValue: (s) => s.created_by,
            render: (s) =>
                s.created_by ? s.created_by : '—',
        },
    ];

    const skeleton = (
        <>
            {[...Array(3)].map((_, i) => (
                <StackedCardSkeleton key={i} />
            ))}
        </>
    );

    return (
        <EntityListPage<IntakeFormSubmission>
            breadcrumb={[
                {
                    label: t('register_form_submissions', {
                        subject: currentRegister?.register_subject || t('register'),
                    }),
                },
            ]}
            showPagination
            pageStart={pagination.pageStart}
            pageEnd={pagination.pageEnd}
            total={pagination.total}
            onPrev={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            onNext={() => setCurrentPage((p) => p + 1)}
            defaultView="card"
            viewStorageKey="intakeFormView"
            showSearch
            searchValue={searchQuery}
            searchPlaceholder={t('search')}
            onSearch={handleSearch}
            showFilters={false}
            items={submissions ?? []}
            loading={submissionsLoading}
            skeleton={skeleton}
            emptyMessage={
                <div className="text-sm text-neutral-first/50 text-center py-6">
                    {t('no_submissions')}
                </div>
            }
            actions={
                <Can action={INTAKE_FORM_ACTIONS.edit}>
                    <AddNewDropdown mechanisms={mechanisms} />
                </Can>
            }
            renderCard={(submission) => (
                <IntakeFormSubmissionCard
                    key={submission.submission_id}
                    submission={submission}
                    registerType={registerType}
                />
            )}
            cardLayout="stacked"
            columns={columns}
            sortBy={sortBy}
            onSortChange={handleSort}
            onRowClick={(submission) =>
                router.push(
                    `/intake-form/${registerType}/submission/${submission.submission_id}`,
                )
            }
        />
    );
}
