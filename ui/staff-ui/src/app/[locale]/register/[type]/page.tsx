'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { EntityListPage, CompactCard, CompactCardSkeleton } from '@/components/shared';
import { ColumnDef } from '@/components/shared/entity-list/types';
import { useRegisterRecords } from '@/features/register/hooks/useRegisterRecords';
import { RegisterRecord } from '@/features/register/types';
import { sortedDisplayFields } from '@/features/register/utils';

export default function RegisterTypePage() {
    const t = useTranslations();
    const router = useRouter();

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
            filterConfig,
            applyFilters,
            removeFilter,
            clearAllFilters,
        },
    } = useRegisterRecords();

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
                <CompactCardSkeleton key={i} />
            ))}
        </>
    );

    return (
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
        />
    );
}
