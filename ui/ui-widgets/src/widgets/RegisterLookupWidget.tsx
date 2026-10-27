import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { tSchema, toTitleCase } from '../utils/tSchema';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { useWidgetContext } from '../components/WidgetProvider';
import { owtFieldInputClass } from '../theme';
import { useOwtThemeRootProps } from '../hooks/useWidgetTheme';
import { WidgetRenderer } from '../components/WidgetRenderer';
import { searchIcon, closeIcon } from '../assets';

type TabState = {
  searchText: string;
  searchResults: Record<string, any>[];
  currentPage: number;
  totalPages: number;
  totalCount: number | null;
  pendingRow: Record<string, any> | null;
  hasLoaded: boolean;
};

const DEFAULT_TAB_STATE: TabState = {
  searchText: '',
  searchResults: [],
  currentPage: 1,
  totalPages: 1,
  totalCount: null,
  pendingRow: null,
  hasLoaded: false,
};

const normalizeDisplayFields = (row: Record<string, any>) => {
  if (!Array.isArray(row.display_fields)) return [];
  return [...row.display_fields]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((f) => ({
      label: String(f.field_name ?? ''),
      value: f.value !== null && f.value !== undefined ? String(f.value) : '-',
    }));
};

const parsePagination = (
  pagination: Record<string, any>,
  rowCount: number,
  size: number,
  fallbackPage = 1,
) => {
  const totalItems =
    typeof pagination.number_of_items === 'number' ? pagination.number_of_items : rowCount;
  const totalPages =
    typeof pagination.number_of_pages === 'number'
      ? Math.max(1, pagination.number_of_pages)
      : totalItems > 0
        ? Math.max(1, Math.ceil(totalItems / size))
        : 1;
  return { totalItems, totalPages, currentPage: pagination.current_page ?? fallbackPage };
};

const RecordDisplayPanel = ({
  row,
  widgetIdPrefix,
  className = '',
  isEditMode = false,
}: {
  row: Record<string, any>;
  widgetIdPrefix: string;
  className?: string;
  isEditMode?: boolean;
}) => {
  const { t } = useWidgetContext();

  const columnFields = normalizeDisplayFields(row).filter(
    (f) => f.label !== 'record_name' && f.label !== 'functional_record_id' && f.label !== 'internal_record_id',
  );

  const fieldSlot = (widgetId: string, label: string, value: string) => (
    <div className="min-w-0 overflow-hidden" key={widgetId}>
      <WidgetRenderer
        config={{
          widget: 'display',
          'widget-type': 'input',
          'widget-id': widgetId,
          'widget-label': label,
          'widget-readonly': true,
          'widget-data-default': value,
        }}
        schemaData={{ [widgetId]: value }}
      />
    </div>
  );

  const optionalSlot = (field: { label: string; value: string } | undefined, slot: string) =>
    field
      ? fieldSlot(`${widgetIdPrefix}-${field.label}`, tSchema(t, field.label), field.value)
      : <div key={slot} className="mb-[10px] invisible text-base">&nbsp;</div>;

  const column = (showDivider: boolean, isFirst: boolean, children: React.ReactNode) => (
    <div
      className={`register-lookup-column relative min-w-0 overflow-hidden${showDivider ? ' register-lookup-column-pad-right' : ''}${isFirst ? '' : ' register-lookup-column-pad-left'}`}
    >
      {children}
      {showDivider && (
        <div
          className="register-lookup-column-divider absolute right-0 top-0 bottom-[5px] w-px"
          style={{
            backgroundColor: isEditMode
              ? 'var(--owt-color-primary)'
              : 'var(--owt-panel-divider-color)',
          }}
        />
      )}
    </div>
  );

  return (
    <>
      <style>{`
        .register-lookup-record-panel .DisplayFieldWidget,
        .register-lookup-record-panel .widget-container {
          min-width: 0 !important;
          overflow: hidden !important;
        }
        .register-lookup-record-panel .DisplayFieldWidget > .flex-1 {
          min-width: 0 !important;
          overflow: hidden !important;
        }
        .register-lookup-record-panel .DisplayFieldWidget > .text-base.owt-field-label,
        .register-lookup-record-panel .DisplayFieldWidget > .text-base.owt-text-muted {
          width: 50% !important;
          min-width: 50% !important;
          max-width: 50% !important;
          flex-shrink: 0 !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }
        .register-lookup-record-panel .DisplayFieldWidget > .flex-1 > .owt-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .register-lookup-record-panel {
          display: grid;
          width: 100%;
          min-width: 0;
          grid-template-columns: minmax(0, 1fr);
        }
        .register-lookup-column-divider {
          display: none;
        }
        @media (min-width: 640px) {
          .register-lookup-record-panel {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
          .register-lookup-column-pad-right {
            padding-right: 40px;
          }
          .register-lookup-column-pad-left {
            padding-left: 40px;
          }
          .register-lookup-column-divider {
            display: block;
          }
        }
        @media (max-width: 639px) {
          .register-lookup-record-panel .DisplayFieldWidget > .text-base.owt-field-label,
          .register-lookup-record-panel .DisplayFieldWidget > .text-base.owt-text-muted {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            white-space: normal !important;
            overflow: visible !important;
            text-overflow: unset !important;
          }
          .register-lookup-record-panel .DisplayFieldWidget > .flex-1 > .owt-text {
            white-space: normal;
            overflow: visible;
            text-overflow: unset;
          }
        }
      `}</style>
      <div className={`register-lookup-record-panel w-full min-w-0 ${className}`}>
        {column(true, true, (
          <>
            {fieldSlot(
              `${widgetIdPrefix}-record_name`,
              tSchema(t, 'record_name'),
              row.record_name == null || row.record_name === '' ? '-' : String(row.record_name),
            )}
            {fieldSlot(
              `${widgetIdPrefix}-functional_record_id`,
              tSchema(t, 'functional_record_id'),
              row.functional_record_id == null || row.functional_record_id === '' ? '-' : String(row.functional_record_id),
            )}
          </>
        ))}
        {column(true, false, [0, 1, 2].map((i) => optionalSlot(columnFields[i], `mid-${i}`)))}
        {column(false, false, [0, 1, 2].map((i) => optionalSlot(columnFields[i + 3], `right-${i}`)))}
      </div>
    </>
  );
};

const PaginationFooter = ({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  onPrev,
  onNext,
}: {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPrev: () => void;
  onNext: () => void;
}) => {
  const { t } = useWidgetContext();
  const [pageInput, setPageInput] = useState(String(currentPage));

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const pageStart = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = totalCount === 0 ? 0 : Math.min(currentPage * pageSize, totalCount);

  const commitPage = () => {
    const parsed = parseInt(pageInput, 10);
    if (!Number.isFinite(parsed)) {
      setPageInput(String(currentPage));
      return;
    }
    const page = Math.min(Math.max(1, parsed), totalPages);
    setPageInput(String(page));
    if (page !== currentPage) onPageChange(page);
  };

  const navButtonClass =
    'inline-flex h-7 shrink-0 items-center justify-center rounded-[8px] px-2 text-xs font-medium owt-bg-alt owt-text disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto whitespace-nowrap text-xs owt-text-muted">
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onPrev}
          disabled={currentPage <= 1}
          className={navButtonClass}
          aria-label={t?.('common.previous', { defaultValue: 'Previous' })}
        >
          {t?.('common.previous', { defaultValue: 'Prev' })}
        </button>
        <div className="flex items-center gap-1">
          <span>{t?.('common.page', { defaultValue: 'Page' })}</span>
          <input
            type="text"
            inputMode="numeric"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitPage();
              }
            }}
            onBlur={commitPage}
            className={owtFieldInputClass({
              className: 'h-7 w-8 rounded-[8px] px-0 text-center text-xs outline-none',
            })}
            aria-label={t?.('common.pageNumber', { defaultValue: 'Page number' })}
          />
          <span>
            {t?.('common.ofPages', { total: totalPages, defaultValue: `of ${totalPages}` })}
          </span>
        </div>
        <button
          type="button"
          onClick={onNext}
          disabled={currentPage >= totalPages}
          className={navButtonClass}
          aria-label={t?.('common.next', { defaultValue: 'Next' })}
        >
          {t?.('common.next', { defaultValue: 'Next' })}
        </button>
      </div>
      <span className="shrink-0 pl-1">
        {totalCount === 1
          ? t?.('common.record', { count: totalCount, defaultValue: `${totalCount} record` })
          : t?.('common.records', { count: totalCount, defaultValue: `${totalCount} records` })}
        {totalCount > 0 && ` · ${pageStart}-${pageEnd}`}
      </span>
    </div>
  );
};

const ResultsTable = ({
  rows,
  selectedRowKey,
  onRowClick,
  onRowDoubleClick,
}: {
  rows: Record<string, any>[];
  selectedRowKey: string | number | null;
  onRowClick: (row: Record<string, any>) => void;
  onRowDoubleClick?: (row: Record<string, any>) => void;
}) => {
  const { t } = useWidgetContext();
  const columns =
    rows.length === 0
      ? []
      : [
          { key: 'record_name', header: 'record_name' },
          ...normalizeDisplayFields(rows[0]).map((f) => ({ key: f.label, header: f.label })),
        ];

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 z-[1] owt-bg-alt">
          <tr>
            {columns.map((col) => {
              const headerLabel = toTitleCase(tSchema(t, col.header));
              return (
                <th
                  key={col.key}
                  className="text-left px-4 py-2 text-sm font-medium owt-text-muted border-b owt-border owt-bg-alt max-w-[12rem]"
                  title={headerLabel}
                >
                  <span className="block truncate">{headerLabel}</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const tableRowKey = row.internal_record_id ?? idx;
            const isSelected = selectedRowKey != null && tableRowKey === selectedRowKey;
            return (
              <tr
                key={tableRowKey}
                onClick={() => onRowClick(row)}
                onDoubleClick={() => onRowDoubleClick?.(row)}
                className={`cursor-pointer border-b owt-border transition-colors ${
                  isSelected ? 'owt-highlight' : 'owt-highlight-hover'
                }`}
              >
                {columns.map((col) => {
                  const cellValue =
                    col.key === 'record_name'
                      ? row.record_name != null
                        ? String(row.record_name)
                        : '-'
                      : normalizeDisplayFields(row).find((f) => f.label === col.key)?.value ?? '-';
                  return (
                    <td key={col.key} className="whitespace-nowrap px-4 py-2 text-sm owt-text" title={cellValue}>
                      {cellValue}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export const RegisterLookupWidget = ({ config }: { config: BaseWidgetConfig }) => {
  const {
    value,
    error,
    touched,
    isEnabled,
    isRequired,
    onChange,
    onBlur,
    config: widgetConfig,
  } = useBaseWidget({ config });

  const { t, dataSourceRequestHandler } = useWidgetContext();
  const themeRoot = useOwtThemeRootProps();

  const rawDataSource = widgetConfig['widget-data-source'] as Record<string, any> | Record<string, any>[] | undefined;
  const dataSources = useMemo<Record<string, any>[]>(
    () =>
      !rawDataSource
        ? []
        : Array.isArray(rawDataSource)
          ? rawDataSource
          : [rawDataSource],
    [rawDataSource],
  );

  const lookupConfig = widgetConfig['widget-lookup-config'] as Record<string, any> | undefined;
  const pageSize: number = lookupConfig?.page_size ?? 10;
  const widgetIdPrefix = `${widgetConfig['widget-id'] || 'register-lookup'}-record`;

  const [tabStates, setTabStates] = useState<Record<number, TabState>>({});
  const [searchDraft, setSearchDraft] = useState('');
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [appliedRecord, setAppliedRecord] = useState<Record<string, any> | null>(null);
  const [isHydrating, setIsHydrating] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hydratedValueRef = useRef<unknown>(null);

  const getTabState = useCallback(
    (idx: number): TabState => tabStates[idx] ?? DEFAULT_TAB_STATE,
    [tabStates],
  );

  const updateTabState = useCallback(
    (idx: number, updater: (prev: TabState) => Partial<TabState>) => {
      setTabStates(prev => {
        const current = prev[idx] ?? DEFAULT_TAB_STATE;
        return { ...prev, [idx]: { ...current, ...updater(current) } };
      });
    },
    [],
  );

  const getTabLabel = useCallback(
    (idx: number): string => {
      if (idx === 0) return tSchema(t, 'already_registered');
      if (idx === 1) return tSchema(t, 'submissions_pending_approval');
      return tSchema(t, widgetConfig['widget-label']);
    },
    [t, widgetConfig],
  );

  const fetchRecordsForSource = useCallback(
    async (
      ds: Record<string, any>,
      text: string,
      page: number,
      size: number,
      internalRecordId: string | null = null,
    ): Promise<{ rows: Record<string, any>[]; pagination: Record<string, any> }> => {
      if (!ds?.service || !ds?.endpoint || !dataSourceRequestHandler) {
        return { rows: [], pagination: {} };
      }
      const result = await dataSourceRequestHandler(
        ds.service,
        ds.endpoint,
        ds.method,
        {
          ...(ds.params || {}),
          search_text: text,
          current_page: page,
          page_size: size,
          internal_record_id: internalRecordId,
        },
        { headers: ds.headers },
      );
      return {
        rows: (result?.records ?? []) as Record<string, any>[],
        pagination: (result?.pagination ?? {}) as Record<string, any>,
      };
    },
    [dataSourceRequestHandler],
  );

  const runSearchForTab = useCallback(
    async (tabIdx: number, text: string, page = 1) => {
      const ds = dataSources[tabIdx];
      if (!ds) return;
      try {
        const { rows, pagination } = await fetchRecordsForSource(ds, text, page, pageSize);
        const parsed = parsePagination(pagination, rows.length, pageSize, page);
        updateTabState(tabIdx, () => ({
          searchText: text,
          searchResults: rows,
          totalCount: parsed.totalItems,
          totalPages: parsed.totalPages,
          currentPage: parsed.currentPage,
          hasLoaded: true,
        }));
      } catch {
        updateTabState(tabIdx, () => ({
          searchText: text,
          searchResults: [],
          totalCount: null,
          totalPages: 1,
          currentPage: 1,
          hasLoaded: true,
        }));
      }
    },
    [dataSources, fetchRecordsForSource, pageSize, updateTabState],
  );

  const runSearchAll = useCallback(
    async (text: string) => {
      await Promise.all(dataSources.map((_, idx) => runSearchForTab(idx, text, 1)));
    },
    [dataSources, runSearchForTab],
  );

  const findRecordByValue = useCallback(
    async (recordValue: unknown): Promise<Record<string, any> | null> => {
      const target = String(recordValue).trim();
      if (!target) return null;
      for (const ds of dataSources) {
        try {
          const { rows } = await fetchRecordsForSource(ds, '', 1, 1, target);
          if (rows[0]) return rows[0];
        } catch {
          // continue
        }
      }
      return null;
    },
    [dataSources, fetchRecordsForSource],
  );

  const hasValue = value !== null && value !== undefined && value !== '';

  const applySelection = (row: Record<string, any>) => {
    hydratedValueRef.current = row.internal_record_id;
    onChange(row.internal_record_id);
    setAppliedRecord(row);
    setIsOpen(false);
  };

  const handleTabChange = useCallback(
    (idx: number) => {
      setActiveTabIdx(idx);
      const ts = tabStates[idx] ?? DEFAULT_TAB_STATE;
      if (!ts.hasLoaded) {
        runSearchForTab(idx, '', 1);
      }
      setTimeout(() => searchInputRef.current?.focus(), 50);
    },
    [tabStates, runSearchForTab],
  );

  const openLookup = () => {
    setIsOpen(true);
    setActiveTabIdx(0);
    setSearchDraft('');
    setTabStates({ 0: { ...DEFAULT_TAB_STATE, pendingRow: appliedRecord } });
    setTimeout(() => searchInputRef.current?.focus(), 50);
    runSearchForTab(0, '', 1);
  };

  useEffect(() => {
    if (!hasValue) {
      hydratedValueRef.current = null;
      setAppliedRecord(null);
      setIsHydrating(false);
      return;
    }
    if (dataSources.length === 0 || !dataSourceRequestHandler) return;
    if (hydratedValueRef.current === value) return;

    let cancelled = false;
    setIsHydrating(true);
    setAppliedRecord(null);

    (async () => {
      try {
        const match = await findRecordByValue(value);
        if (cancelled) return;
        hydratedValueRef.current = value;
        setAppliedRecord(match);
      } catch {
        if (!cancelled) {
          hydratedValueRef.current = value;
          setAppliedRecord(null);
        }
      } finally {
        if (!cancelled) setIsHydrating(false);
      }
    })();

    return () => {
      cancelled = true;
      setIsHydrating(false);
    };
  }, [hasValue, value, dataSources, dataSourceRequestHandler, findRecordByValue]);

  const isReadonly = !!widgetConfig['widget-readonly'];
  const label = tSchema(t, widgetConfig['widget-label']);
  const hasError = (touched && error.length > 0) || (widgetConfig['widget-required'] && !hasValue);
  const actionLabel = tSchema(t, String(lookupConfig?.action_label ?? `Select ${label}`));

  const hydratedPanel = isHydrating ? (
    <p className="text-sm owt-text-muted">{t?.('common.loading', { defaultValue: 'Loading...' })}</p>
  ) : appliedRecord ? (
    <RecordDisplayPanel
      row={appliedRecord}
      widgetIdPrefix={`${widgetIdPrefix}-${isReadonly ? 'readonly' : 'applied'}`}
      isEditMode={!isReadonly}
    />
  ) : null;

  const showTabs = dataSources.length > 1;
  const activeTabState = getTabState(activeTabIdx);

  return (
    <div className="mb-[10px] w-full">
      {hasValue ? (
        <div className="w-full">
          {hydratedPanel}
          {!isReadonly && isEnabled && (
            <div className="flex items-center gap-3 mt-2">
              <button
                type="button"
                onClick={openLookup}
                className="text-sm underline p-0 border-0 bg-transparent cursor-pointer focus:outline-none rounded owt-link"
                style={{ color: 'var(--owt-color-info)' }}
              >
                {t?.('common.change', { defaultValue: 'Change' })}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  hydratedValueRef.current = null;
                  onChange(null);
                  setAppliedRecord(null);
                  setTabStates({});
                }}
                className="text-sm underline p-0 border-0 bg-transparent cursor-pointer focus:outline-none rounded owt-field-error"
              >
                {t?.('common.remove', { defaultValue: 'Remove' })}
              </button>
            </div>
          )}
          {!isReadonly && touched && error.length > 0 && (
            <p className="owt-field-error text-sm mt-1">{error[0]}</p>
          )}
        </div>
      ) : !isReadonly ? (
        <div className="w-full min-w-0">
          <button
            type="button"
            disabled={!isEnabled}
            onClick={openLookup}
            title={actionLabel}
            className={owtFieldInputClass({
              error: hasError,
              disabled: !isEnabled,
              className: 'inline-flex w-max max-w-none items-center gap-2 whitespace-nowrap px-3 h-[30px] text-sm cursor-pointer',
            })}
          >
            <img src={searchIcon} alt="" className="w-4 h-4 opacity-50 flex-shrink-0" />
            <span className="whitespace-nowrap">{actionLabel}</span>
            {isRequired && <span className="shrink-0 owt-field-required">*</span>}
          </button>
          {touched && error.length > 0 && (
            <p className="owt-field-error text-sm mt-1">{error[0]}</p>
          )}
        </div>
      ) : null}

      {!isReadonly && isOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ backgroundColor: 'var(--owt-color-overlay)', padding: 12 }}
          onClick={() => { setIsOpen(false); onBlur(); }}
        >
          <div
            className={`${themeRoot.className} flex min-h-0 min-w-0 flex-col overflow-hidden`}
            style={{
              ...themeRoot.style,
              width: 'min(940px, calc(100vw - 24px))',
              height: 'min(560px, calc(100svh - 24px))',
              maxWidth: 'calc(100vw - 24px)',
              maxHeight: 'calc(100svh - 24px)',
              flexShrink: 0,
              backgroundColor: 'var(--owt-color-bg)',
              borderRadius: '10px',
              boxShadow: '0 24px 64px var(--owt-color-shadow)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 select-none items-center justify-between gap-3 border-b owt-border px-3 py-3 sm:px-5 sm:py-4">
              <h3
                className="min-w-0 truncate text-base font-semibold owt-text sm:text-lg"
                title={t?.('common.selectTitle', { label, defaultValue: `Select ${label}` })}
              >
                {t?.('common.selectTitle', { label, defaultValue: `Select ${label}` })}
              </h3>
              <button
                type="button"
                onClick={() => { setIsOpen(false); onBlur(); }}
                onMouseDown={(e) => e.stopPropagation()}
                className="shrink-0 border-0 bg-transparent p-0 cursor-pointer"
                aria-label={t?.('common.close', { defaultValue: 'Close' })}
              >
                <img src={closeIcon} alt="" className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>

            <div className="shrink-0 border-b owt-border px-3 py-3 sm:px-5">
              <div className={owtFieldInputClass({ className: 'flex h-[30px] w-full items-center gap-2 rounded-[10px] px-3' })}>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      runSearchAll(searchDraft);
                    }
                  }}
                  placeholder={tSchema(t, String(lookupConfig?.search_placeholder ?? 'Search...'))}
                  className="min-w-0 flex-1 bg-transparent text-sm owt-text outline-none"
                />
                <button
                  type="button"
                  onClick={() => runSearchAll(searchDraft)}
                  aria-label={t?.('common.search', { defaultValue: 'Search' })}
                  className="flex-shrink-0 p-0 border-0 bg-transparent cursor-pointer"
                >
                  <img src={searchIcon} alt="" className="w-4 h-4 opacity-40" />
                </button>
              </div>
            </div>

            {showTabs && (
              <div
                className="flex shrink-0 gap-0 overflow-x-auto border-b owt-border px-3 sm:px-5"
                role="tablist"
              >
                {dataSources.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    role="tab"
                    aria-selected={activeTabIdx === idx}
                    onClick={() => handleTabChange(idx)}
                    className={`shrink-0 whitespace-nowrap pl-0 pr-6 py-2.5 text-sm font-medium -mb-px border-b-[3px] outline-none transition-colors ${
                      activeTabIdx === idx
                        ? 'owt-text border-[var(--owt-color-info)]'
                        : 'owt-text-muted border-transparent hover:owt-text'
                    }`}
                  >
                    {getTabLabel(idx)}
                  </button>
                ))}
              </div>
            )}

            <div className="min-w-0 flex-1 overflow-auto">
              {activeTabState.searchResults.length === 0 ? (
                <p className="text-center text-sm owt-text-muted py-10">
                  {activeTabState.searchText
                    ? t?.('common.noResults', { defaultValue: 'No results found' })
                    : t?.('common.searchHint', { defaultValue: 'Type and press Enter or click search' })}
                </p>
              ) : (
                <ResultsTable
                  rows={activeTabState.searchResults}
                  selectedRowKey={activeTabState.pendingRow?.internal_record_id ?? null}
                  onRowClick={(row) => updateTabState(activeTabIdx, () => ({ pendingRow: row }))}
                  onRowDoubleClick={applySelection}
                />
              )}
            </div>

            <div className="flex shrink-0 flex-col gap-3 border-t owt-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              {activeTabState.totalCount !== null && (
                <PaginationFooter
                  key={`pagination-tab-${activeTabIdx}`}
                  currentPage={activeTabState.currentPage}
                  totalPages={activeTabState.totalPages}
                  totalCount={activeTabState.totalCount}
                  pageSize={pageSize}
                  onPageChange={(page) =>
                    runSearchForTab(activeTabIdx, activeTabState.searchText, page)
                  }
                  onPrev={() =>
                    activeTabState.currentPage > 1 &&
                    runSearchForTab(activeTabIdx, activeTabState.searchText, activeTabState.currentPage - 1)
                  }
                  onNext={() =>
                    activeTabState.currentPage < activeTabState.totalPages &&
                    runSearchForTab(activeTabIdx, activeTabState.searchText, activeTabState.currentPage + 1)
                  }
                />
              )}
              <button
                type="button"
                onClick={() => activeTabState.pendingRow && applySelection(activeTabState.pendingRow)}
                disabled={!activeTabState.pendingRow}
                className="h-9 shrink-0 self-end rounded-[10px] px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 sm:ml-auto sm:self-auto"
                style={{ backgroundColor: 'var(--owt-color-info)', color: 'var(--owt-color-bg)' }}
              >
                {tSchema(t, String(lookupConfig?.select_record_label ?? `Select ${label}`))}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};
