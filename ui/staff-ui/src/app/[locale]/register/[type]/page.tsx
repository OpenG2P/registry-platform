'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import { useRouter } from '@/i18n/navigation';
import { History, FileDown } from 'lucide-react';
import { EntityListPage, CompactCard, CompactCardSkeleton } from '@/components/shared';
import { ColumnDef, MoreMenuItem } from '@/components/shared/entity-list/types';
import { useRegisterRecords } from '@/features/register/hooks/useRegisterRecords';
import { useRegisterIntakeMenuItems } from '@/features/register/hooks/useRegisterIntakeMenuItems';
import {
    RegisterIntakeMenuModals,
    toRegisterIntakeMoreMenuItems,
} from '@/features/register/components';
import { RegisterRecord } from '@/features/register/types';
import { sortedDisplayFields } from '@/features/register/utils';
import { useRbac } from '@/context/RbacContext';
import { REGISTER_ACTIONS } from '@/features/shared/permissions';
import {
    ExportQueuePanel,
    ExportRecordsModal,
    useExportQueue,
    useRegisterExport,
    useRegisterRecordSelection,
    type ExportFormat,
    type ExportQueueRecord,
    type ExportRegisterRecordsPayload,
    type ExportScope,
} from '@/features/export/register';

export default function RegisterTypePage() {
    const t = useTranslations();
    const router = useRouter();
    const { can } = useRbac();
    const canExport = can(REGISTER_ACTIONS.export) || can(REGISTER_ACTIONS.view);

    const {
        registerType,
        registerTypeLabel,
        records,
        isLoadingRecords,
        searchQuery,
        sortBy,
        pagination,
        handlers: {
            handlePreviousPage,
            handleNextPage,
            handleSearch,
            handleSort,
        },
        filters: {
            appliedFilters,
            filterBy,
            filterConfig,
            applyFilters,
            removeFilter,
            clearAllFilters,
        },
        registerId,
        currentPage,
        pageSize,
    } = useRegisterRecords();

    const {
        groups: intakeMenuGroups,
        selectedImportFile,
        showImportModal,
        closeImportModal,
        selectedVC,
        openVC,
        closeVC,
    } = useRegisterIntakeMenuItems(registerType);
    const intakeMenuItems = toRegisterIntakeMoreMenuItems(intakeMenuGroups);

    const selectionResetKey = `${registerId ?? ''}|${searchQuery}|${JSON.stringify(filterBy)}|${sortBy ?? ''}`;
    const selection = useRegisterRecordSelection(selectionResetKey);
    const { enqueue, submitting } = useRegisterExport();

    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [exportModalScope, setExportModalScope] = useState<ExportScope>('all');
    const [queueOpen, setQueueOpen] = useState(false);
    const queue = useExportQueue(queueOpen);

    const displayFieldKeys: string[] = [];
    records.forEach((r) => {
        sortedDisplayFields(r.display_fields).forEach((f) => {
            if (!displayFieldKeys.includes(f.field_name)) displayFieldKeys.push(f.field_name);
        });
    });

    const columns: ColumnDef<RegisterRecord>[] = [
        {
            key: 'record_name',
            header: t.has('record_name') ? t('record_name') : 'Record Name',
            getValue: (r) => r.record_name,
            render: (r) => (
                <span className="font-medium  text-[15px]">{r.record_name || '—'}</span>
            ),
        },
        {
            key: 'functional_record_id',
            header: t.has('id') ? t('id') : 'ID',
            getValue: (r) => r.functional_record_id,
        },
        ...displayFieldKeys.slice(0, 6).map((key) => ({
            key,
            header: t.has(key) ? t(key) : key,
            getValue: (r: RegisterRecord) =>
                r.display_fields.find((f) => f.field_name === key)?.value ?? '',
        })),
    ];

    const skeleton = (
        <>
            {[...Array(5)].map((_, i) => (
                <CompactCardSkeleton key={i} isEven={i % 2 === 0} />
            ))}
        </>
    );

    const openExportModal = (scope: ExportScope = 'all') => {
        setExportModalScope(scope);
        setExportModalOpen(true);
    };

    const buildPayload = (
        format: ExportFormat,
        scope: ExportScope,
        selectedIds = selection.selectedIdList,
    ): ExportRegisterRecordsPayload | null => {
        if (!registerId) return null;

        if (scope === 'selected' && selectedIds.length > 0) {
            return {
                register_id: registerId,
                export_format: format,
                selected_internal_record_ids: selectedIds,
            };
        }

        return {
            current_page: currentPage,
            page_size: pageSize,
            sort_by: sortBy,
            filter_by: filterBy,
            search_text: searchQuery,
            register_id: registerId,
            export_format: format,
            selected_internal_record_ids: [],
        };
    };

    const showQueuedToast = () => {
        const message = t.has('export_has_been_queued')
            ? t('export_has_been_queued')
            : 'Export has been queued. You can download it once processing completes.';
        const viewQueueLabel = t.has('view_queue') ? t('view_queue') : 'View Queue';

        toast.success(
            <div className="flex flex-col gap-2">
                <span>{message}</span>
                <button
                    type="button"
                    className="self-start text-[13px] font-medium underline"
                    onClick={() => {
                        setQueueOpen(true);
                        toast.dismiss();
                    }}
                >
                    {viewQueueLabel}
                </button>
            </div>,
            { autoClose: 8000, style: { width: '28rem', minWidth: '28rem' } },
        );
    };

    const handleStartExport = async (format: ExportFormat, scope: ExportScope) => {
        const payload = buildPayload(format, scope);
        if (!payload) return;
        const result = await enqueue(payload);
        if (result) {
            setExportModalOpen(false);
            showQueuedToast();
        }
    };

    const handleRetry = async (record: ExportQueueRecord) => {
        const format: ExportFormat = record.export_format === 'CSV' ? 'CSV' : 'XLSX';
        const payload = buildPayload(format, 'all');
        if (!payload) return;
        const result = await enqueue(payload);
        if (result) showQueuedToast();
    };

    const exportMenuItems: MoreMenuItem[] = useMemo(() => {
        if (!canExport) return [];
        return [
            { id: 'export-divider', divider: true },
            {
                id: 'export-records',
                label: t.has('export_records') ? t('export_records') : 'Export Records',
                icon: <FileDown size={16} />,
                onClick: () => openExportModal(selection.selectedCount > 0 ? 'selected' : 'all'),
            },
            {
                id: 'export-history',
                label: t.has('export_history') ? t('export_history') : 'Export History',
                icon: <History size={16} />,
                onClick: () => setQueueOpen(true),
            },
        ];
    }, [canExport, selection.selectedCount, t]);

    return (
        <>
        <EntityListPage<RegisterRecord>
            breadcrumb={[{ label: registerTypeLabel }]}
            showPagination
            pageStart={pagination.pageStart}
            pageEnd={pagination.pageEnd}
            total={pagination.total}
            onPrev={handlePreviousPage}
            onNext={handleNextPage}
            defaultView="card"
            viewStorageKey="registerView"
            showSearch
            searchValue={searchQuery}
            searchPlaceholder={t('search')}
            onSearch={handleSearch}
            showFilters
            appliedFilters={appliedFilters}
            filterConfig={filterConfig}
            onApplyFilters={applyFilters}
            removeFilter={removeFilter}
            clearAllFilters={clearAllFilters}
            items={records}
            loading={isLoadingRecords}
            skeleton={skeleton}
            emptyMessage={
                <div className="text-center py-10 text-neutral-first/50">{t('no_items_found')}</div>
            }
            renderCard={(record, index) => (
                <CompactCard
                    key={record.internal_record_id}
                    href={`/register/${registerType}/${record.internal_record_id}`}
                    imageUrl={record.record_image_url}
                    imageAlt={record.record_name}
                    title={record.record_name}
                    subtitleLabel={t('id')}
                    subtitleValue={record.functional_record_id}
                    isEven={index % 2 === 0}
                    selectable={canExport}
                    selected={selection.isSelected(record.internal_record_id)}
                    onSelectChange={() => selection.toggle(record.internal_record_id)}
                    fields={sortedDisplayFields(record.display_fields).map((field) => ({
                        label: t.has(field.field_name) ? t(field.field_name) : field.field_name,
                        value: field.value
                            ? t.has(field.value)
                                ? t(field.value)
                                : field.value
                            : '',
                    }))}
                />
            )}
            cardLayout="compact"
            columns={columns}
            sortBy={sortBy}
            onSortChange={handleSort}
            onRowClick={(record) =>
                router.push(`/register/${registerType}/${record.internal_record_id}`)
            }
            moreMenuItems={[...intakeMenuItems, ...exportMenuItems]}
            selectable={canExport}
            selectedIds={selection.selectedIds}
            getItemId={(record) => record.internal_record_id}
            onToggleSelect={selection.toggle}
            onTogglePageSelect={selection.togglePage}
        />
        <RegisterIntakeMenuModals
            selectedImportFile={selectedImportFile}
            showImportModal={showImportModal}
            onCloseImport={closeImportModal}
            selectedVC={selectedVC}
            openVC={openVC}
            onCloseVC={closeVC}
        />
        <ExportRecordsModal
            isOpen={exportModalOpen}
            onClose={() => setExportModalOpen(false)}
            onStart={handleStartExport}
            submitting={submitting}
            selectedCount={selection.selectedCount}
            totalCount={pagination.total}
            initialScope={exportModalScope}
            searchQuery={searchQuery}
            appliedFilters={appliedFilters}
        />
        <ExportQueuePanel
            isOpen={queueOpen}
            onClose={() => setQueueOpen(false)}
            records={queue.records}
            loading={queue.loading}
            pageStart={queue.pagination.pageStart}
            pageEnd={queue.pagination.pageEnd}
            total={queue.pagination.total}
            onPrev={queue.onPrev}
            onNext={queue.onNext}
            onRefresh={queue.refresh}
            onExportRecords={() => {
                setQueueOpen(false);
                openExportModal('all');
            }}
            onRetry={handleRetry}
            onDownload={(url) => {
                window.open(url, '_blank', 'noopener,noreferrer');
            }}
        />
        </>
    );
}
