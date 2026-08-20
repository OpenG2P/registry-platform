'use client';

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';

import { EntityListPage, StackedCardSkeleton } from '@/components/shared';
import { ColumnDef } from '@/components/shared/entity-list/types';
import { useMyTasks } from '@/features/approval/hooks/useMyTasks';
import { TASK_ARTIFACT_FILTER_OPTIONS } from '@/features/approval/constants';
import { useRuntimeConfig } from '@/context/RuntimeConfigContext';
import { useRegister } from '@/context/RegisterContext';
import TaskCard from './TaskCard';
import { getTaskDetailHref } from '@/features/approval/utils/taskNavigation';
import { ApprovalTask } from '@/features/approval/types/approval';

export type TaskListArtifactFilter = 'change_request' | 'intake_form';

interface BreadcrumbItem {
    label: string;
    href?: string;
}

interface TasksListViewProps {
    fixedArtifactFilter?: TaskListArtifactFilter;
    breadcrumb: BreadcrumbItem[];
    listBasePath: string;
}

const taskStatusClassMap: Record<string, string> = {
    open: 'text-amber-500',
    claimed: 'text-amber-500',
    completed: 'text-toast-success',
    cancelled: 'text-toast-failed',
};

export default function TasksListView({
    fixedArtifactFilter,
    breadcrumb,
    listBasePath,
}: TasksListViewProps) {
    const t = useTranslations();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { config } = useRuntimeConfig();
    const { registers } = useRegister();

    const searchQuery = searchParams.get('search') || '';
    const sortBy = searchParams.get('sort') || null;
    const artifactFilterParam = searchParams.get('artifact_type');

    const artifactType = useMemo(() => {
        const filter = fixedArtifactFilter ?? artifactFilterParam;
        if (!filter) return undefined;
        return TASK_ARTIFACT_FILTER_OPTIONS.find((o) => o.value === filter)?.artifactType;
    }, [fixedArtifactFilter, artifactFilterParam]);

    const pageSize = config.pageSize || 25;

    const { tasks, loading, total, currentPage, pages, setCurrentPage } = useMyTasks({
        artifactType,
        searchText: searchQuery,
        sortBy,
        pageSize,
    });

    const registerMnemonicById = useMemo(
        () => new Map(registers.map((r) => [r.register_id, r.register_mnemonic.toLowerCase()])),
        [registers],
    );

    const handleSearch = useCallback(
        (searchValue: string) => {
            const params = new URLSearchParams(searchParams.toString());
            if (searchValue.trim()) {
                params.set('search', searchValue.trim());
            } else {
                params.delete('search');
            }
            params.set('page', '1');
            if (fixedArtifactFilter) {
                params.delete('artifact_type');
            }
            const query = params.toString();
            router.push(query ? `${listBasePath}?${query}` : listBasePath);
        },
        [router, searchParams, listBasePath, fixedArtifactFilter],
    );

    const handleSort = useCallback(
        (nextSortBy: string | null) => {
            const params = new URLSearchParams(searchParams.toString());
            if (nextSortBy) {
                params.set('sort', nextSortBy);
            } else {
                params.delete('sort');
            }
            params.set('page', '1');
            if (fixedArtifactFilter) {
                params.delete('artifact_type');
            }
            const query = params.toString();
            router.push(query ? `${listBasePath}?${query}` : listBasePath);
        },
        [router, searchParams, listBasePath, fixedArtifactFilter],
    );

    const pageStart = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const pageEnd = Math.min(currentPage * pageSize, total);

    const translateKey = (value?: string | null) => {
        const trimmed = value?.trim();
        if (!trimmed) return '—';
        if (t.has(trimmed)) return t(trimmed);
        const lower = trimmed.toLowerCase();
        if (lower !== trimmed && t.has(lower)) return t(lower);
        return trimmed;
    };

    const formatEnum = (value?: string | null) => {
        const trimmed = value?.trim();
        if (!trimmed) return '—';
        if (t.has(trimmed)) return t(trimmed);
        const lower = trimmed.toLowerCase();
        if (lower !== trimmed && t.has(lower)) return t(lower);
        return trimmed.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    };

    const columns: ColumnDef<ApprovalTask>[] = [
        {
            key: 'record_name',
            header: t.has('record_name') ? t('record_name') : 'Record Name',
            getValue: (task) => String(task.context?.record_name ?? task.artifact_id ?? task.id),
            render: (task) => (
                <span className="font-medium text-[15px]">
                    {String(task.context?.record_name ?? '—')}
                </span>
            ),
        },
        {
            key: 'register',
            header: t.has('register') ? t('register') : 'Register',
            sortKey: 'register_mnemonic',
            getValue: (task) => {
                const mnemonic = String(task.context?.register_mnemonic ?? '');
                const matched = registers.find(
                    (register) =>
                        register.register_mnemonic.toLowerCase() === mnemonic.toLowerCase(),
                );
                return matched?.register_subject
                    ? translateKey(matched.register_subject)
                    : translateKey(mnemonic);
            },
        },
        {
            key: 'section',
            header: t.has('section') ? t('section') : 'Section',
            sortKey: 'section_mnemonic',
            getValue: (task) =>
                translateKey(
                    String(task.context?.section_mnemonic ?? task.context?.intake_form_mnemonic ?? ''),
                ),
        },
        {
            key: 'assignee',
            header: t.has('assignee_name') ? t('assignee_name') : 'Assignee',
            sortKey: 'assignee_name',
            getValue: (task) => task.assignee_name ?? task.assignee,
        },
        {
            key: 'kind',
            header: t.has('kind') ? t('kind') : 'Kind',
            getValue: (task) => task.kind ?? '',
            render: (task) => formatEnum(task.kind),
        },
        {
            key: 'status',
            header: t.has('status') ? t('status') : 'Status',
            getValue: (task) => task.status,
            render: (task) => (
                <span
                    className={`font-medium ${taskStatusClassMap[task.status?.toLowerCase()] ?? ''}`}
                >
                    {formatEnum(task.status)}
                </span>
            ),
        },
        {
            key: 'created_at',
            header: t.has('created_at') ? t('created_at') : 'Created at',
            getValue: (task) => task.created_at,
            render: (task) =>
                task.created_at ? new Date(task.created_at).toLocaleDateString() : '—',
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
        <EntityListPage<ApprovalTask>
            breadcrumb={breadcrumb}
            showPagination
            pageStart={pageStart}
            pageEnd={pageEnd}
            total={total}
            onPrev={() => setCurrentPage((p) => Math.max(1, p - 1))}
            onNext={() => setCurrentPage((p) => Math.min(pages, p + 1))}
            defaultView="card"
            viewStorageKey={`tasksView_${listBasePath.replace(/\//g, '_')}`}
            showSearch
            searchValue={searchQuery}
            searchPlaceholder={t('search_approval_tasks')}
            onSearch={handleSearch}
            showFilters={false}
            items={tasks}
            loading={loading}
            skeleton={skeleton}
            emptyMessage={
                <div className="text-sm text-neutral-first/50 text-center py-6">
                    {t('no_approval_tasks')}
                </div>
            }
            renderCard={(task) => {
                const href = getTaskDetailHref(task, registerMnemonicById);
                return (
                    <TaskCard
                        key={task.id}
                        task={task}
                        href={href}
                        onNavigate={(path) => router.push(path)}
                    />
                );
            }}
            cardLayout="stacked"
            columns={columns}
            sortBy={sortBy}
            onSortChange={handleSort}
            onRowClick={(task) => {
                const href = getTaskDetailHref(task, registerMnemonicById);
                if (href) router.push(href);
            }}
        />
    );
}
