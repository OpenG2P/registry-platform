import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';
import { useWidgetContext } from '../components/WidgetProvider';
import { WidgetRenderer } from '../components/WidgetRenderer';
import { searchIcon, closeIcon } from '../assets';

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
}: {
  row: Record<string, any>;
  widgetIdPrefix: string;
  className?: string;
}) => {
  const { translateConfig } = useWidgetTranslation();

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
      ? fieldSlot(`${widgetIdPrefix}-${field.label}`, translateConfig(field.label), field.value)
      : <div key={slot} className="mb-[10px] invisible text-base">&nbsp;</div>;

  const column = (showDivider: boolean, isFirst: boolean, children: React.ReactNode) => (
    <div
      className="relative min-w-0 overflow-hidden"
      style={{ paddingRight: showDivider ? '40px' : undefined, paddingLeft: isFirst ? undefined : '40px' }}
    >
      {children}
      {showDivider && (
        <div
          className="absolute right-0 top-0 bottom-[5px] w-px"
          style={{ backgroundColor: 'var(--owt-panel-divider-color, #C4C4C4)' }}
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
        .register-lookup-record-panel .DisplayFieldWidget > .text-base.text-gray-600 {
          width: 50% !important;
          min-width: 50% !important;
          max-width: 50% !important;
          flex-shrink: 0 !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }
        .register-lookup-record-panel .DisplayFieldWidget > .flex-1 > .text-gray-900 {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
      <div
        className={`register-lookup-record-panel grid w-full min-w-0 ${className}`}
        style={{ gridTemplateColumns: 'repeat(3, minmax(200px, 1fr))' }}
      >
        {column(true, true, (
          <>
            {fieldSlot(
              `${widgetIdPrefix}-record_name`,
              translateConfig('record_name'),
              row.record_name == null || row.record_name === '' ? '-' : String(row.record_name),
            )}
            {fieldSlot(
              `${widgetIdPrefix}-functional_record_id`,
              translateConfig('functional_record_id'),
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
  translate,
  embedded,
}: {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPrev: () => void;
  onNext: () => void;
  translate: ReturnType<typeof useWidgetTranslation>['translate'];
  embedded?: boolean;
}) => {
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

  return (
    <div
      className={
        embedded
          ? 'flex flex-wrap items-center gap-3 flex-1 min-w-0'
          : 'flex flex-wrap items-center justify-between gap-3 px-5 py-3 flex-shrink-0 border-t border-gray-200'
      }
    >
      <span className="text-sm text-gray-600">
        {totalCount === 1
          ? translate('common.record', { count: totalCount, defaultValue: `${totalCount} record` })
          : translate('common.records', { count: totalCount, defaultValue: `${totalCount} records` })}
        {totalCount > 0 && ` · ${pageStart}-${pageEnd}`}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={currentPage <= 1}
          className="px-3 h-8 text-sm font-medium rounded-[10px] bg-gray-100 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {translate('common.previous', { defaultValue: 'Prev' })}
        </button>
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          <span>{translate('common.page', { defaultValue: 'Page' })}</span>
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
            className="w-10 h-8 text-center text-sm text-gray-900 outline-none rounded-[10px] border border-gray-300 bg-white"
            aria-label={translate('common.pageNumber', { defaultValue: 'Page number' })}
          />
          <span>
            {translate('common.ofPages', { total: totalPages, defaultValue: `of ${totalPages}` })}
          </span>
        </div>
        <button
          type="button"
          onClick={onNext}
          disabled={currentPage >= totalPages}
          className="px-3 h-8 text-sm font-medium rounded-[10px] bg-gray-100 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {translate('common.next', { defaultValue: 'Next' })}
        </button>
      </div>
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
  const { translateConfig } = useWidgetTranslation();
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
        <thead className="sticky top-0 z-[1] bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="text-left px-4 py-2 text-sm font-medium text-gray-600 whitespace-nowrap border-b border-gray-200 bg-gray-50"
              >
                {translateConfig(col.header)}
              </th>
            ))}
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
                className={`cursor-pointer border-b border-gray-100 transition-colors ${
                  isSelected ? 'bg-blue-100' : 'hover:bg-blue-50'
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
                    <td key={col.key} className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">
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

  const { translate, translateConfig } = useWidgetTranslation();
  const { dataSourceRequestHandler } = useWidgetContext();

  const dataSource = widgetConfig['widget-data-source'] as Record<string, any> | undefined;
  const lookupConfig = widgetConfig['widget-lookup-config'] as Record<string, any> | undefined;
  const pageSize: number = lookupConfig?.page_size ?? 10;
  const widgetIdPrefix = `${widgetConfig['widget-id'] || 'register-lookup'}-record`;

  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<Record<string, any>[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [pendingRow, setPendingRow] = useState<Record<string, any> | null>(null);
  const [appliedRecord, setAppliedRecord] = useState<Record<string, any> | null>(null);
  const [isHydrating, setIsHydrating] = useState(false);
  const [modalPos, setModalPos] = useState({ x: 80, y: 80 });
  const [modalSize, setModalSize] = useState({ w: 860, h: 520 });

  const isDragging = useRef(false);
  const dragOrigin = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hydratedValueRef = useRef<unknown>(null);

  const fetchRecords = useCallback(
    async (text: string, page: number, size: number) => {
      if (!dataSource?.service || !dataSource?.endpoint || !dataSourceRequestHandler) {
        return { rows: [] as Record<string, any>[], pagination: {} as Record<string, any> };
      }
      const result = await dataSourceRequestHandler(
        dataSource.service,
        dataSource.endpoint,
        dataSource.method,
        {
          ...(dataSource.params || {}),
          search_text: text,
          current_page: page,
          page_size: size,
        },
        { headers: dataSource.headers },
      );
      return {
        rows: (result?.records ?? []) as Record<string, any>[],
        pagination: (result?.pagination ?? {}) as Record<string, any>,
      };
    },
    [dataSource, dataSourceRequestHandler],
  );

  const findRecordByValue = useCallback(
    async (recordValue: unknown): Promise<Record<string, any> | null> => {
      const target = String(recordValue).trim();
      if (!target) return null;

      const hydratePageSize: number = lookupConfig?.hydrate_page_size ?? 50;
      let page = 1;
      let totalPages = 1;

      while (page <= totalPages) {
        const { rows, pagination } = await fetchRecords('', page, hydratePageSize);
        const match = rows.find(
          (row) => String(row.internal_record_id ?? '').trim() === target,
        );
        if (match) return match;

        totalPages = parsePagination(pagination, rows.length, hydratePageSize).totalPages;
        if (page >= totalPages) break;
        page += 1;
      }
      return null;
    },
    [fetchRecords, lookupConfig?.hydrate_page_size],
  );

  const runSearch = useCallback(
    async (text: string, page = 1) => {
      try {
        const { rows, pagination } = await fetchRecords(text, page, pageSize);
        const parsed = parsePagination(pagination, rows.length, pageSize, page);
        setSearchResults(rows);
        setTotalCount(parsed.totalItems);
        setTotalPages(parsed.totalPages);
        setCurrentPage(parsed.currentPage);
      } catch {
        setSearchResults([]);
        setTotalCount(null);
        setTotalPages(1);
        setCurrentPage(1);
      }
    },
    [fetchRecords, pageSize],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      setModalPos({
        x: dragOrigin.current.posX + (e.clientX - dragOrigin.current.mouseX),
        y: dragOrigin.current.posY + (e.clientY - dragOrigin.current.mouseY),
      });
    };
    const onUp = () => { isDragging.current = false; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  const hasValue = value !== null && value !== undefined && value !== '';

  const applySelection = (row: Record<string, any>) => {
    hydratedValueRef.current = row.internal_record_id;
    onChange(row.internal_record_id);
    setAppliedRecord(row);
    setIsOpen(false);
  };

  const openLookup = () => {
    const w = Math.min(Math.round(window.innerWidth * 0.82), 940);
    const h = Math.min(Math.round(window.innerHeight * 0.72), 560);
    setModalPos({ x: Math.round((window.innerWidth - w) / 2), y: Math.round((window.innerHeight - h) / 2) });
    setModalSize({ w, h });
    setIsOpen(true);
    setSearchText('');
    setSearchResults([]);
    setTotalCount(null);
    setCurrentPage(1);
    setTotalPages(1);
    setPendingRow(appliedRecord);
    setTimeout(() => searchInputRef.current?.focus(), 50);
    runSearch('', 1);
  };

  useEffect(() => {
    if (!hasValue) {
      hydratedValueRef.current = null;
      setAppliedRecord(null);
      setIsHydrating(false);
      return;
    }
    if (!dataSource?.service || !dataSource?.endpoint || !dataSourceRequestHandler) return;
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
  }, [hasValue, value, dataSource, dataSourceRequestHandler, findRecordByValue]);

  const isReadonly = !!widgetConfig['widget-readonly'];
  const label = translateConfig(widgetConfig['widget-label']);
  const hasError =
    (touched && error.length > 0) ||
    (widgetConfig['widget-required'] && !hasValue);
    
  const actionLabel = translateConfig(String(lookupConfig?.action_label ?? `Select ${label}`));
  const searchPlaceholder = translateConfig(String(lookupConfig?.search_placeholder ?? 'Search...'));
  const selectRecordLabel = translateConfig(String(lookupConfig?.select_record_label ?? `Select ${label}`));

  const hydratedPanel =
    isHydrating ? (
      <p className="text-sm text-gray-500">{translate('common.loading', { defaultValue: 'Loading...' })}</p>
    ) : appliedRecord ? (
      <RecordDisplayPanel
        row={appliedRecord}
        widgetIdPrefix={`${widgetIdPrefix}-${isReadonly ? 'readonly' : 'applied'}`}
      />
    ) : null;

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
                className="text-sm underline p-0 border-0 bg-transparent cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded"
                style={{ color: 'var(--owt-color-info, #2563eb)' }}
              >
                {translate('common.change', { defaultValue: 'Change' })}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  hydratedValueRef.current = null;
                  onChange(null);
                  setAppliedRecord(null);
                  setPendingRow(null);
                }}
                className="text-sm underline text-red-500 p-0 border-0 bg-transparent cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 rounded"
              >
                {translate('common.remove', { defaultValue: 'Remove' })}
              </button>
            </div>
          )}
          {!isReadonly && touched && error.length > 0 && <p className="text-red-500 text-sm mt-1">{error[0]}</p>}
        </div>
      ) : !isReadonly ? (
        <div className="w-full min-w-0">
          <button
            type="button"
            disabled={!isEnabled}
            onClick={openLookup}
            title={actionLabel}
            className={`flex items-center gap-2 w-full sm:w-[180px] max-w-full px-3 h-[30px] text-sm border rounded-[10px] shadow-sm transition-colors ${
              hasError ? 'border-red-500 text-gray-700' : 'border-gray-300 text-gray-700'
            } ${!isEnabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white cursor-pointer'}`}
          >
            <img src={searchIcon} alt="" className="w-4 h-4 opacity-50 flex-shrink-0" />
            <span className="min-w-0 truncate">{actionLabel}</span>
            {isRequired && <span className="shrink-0 text-red-500">*</span>}
          </button>
          {touched && error.length > 0 && <p className="text-red-500 text-sm mt-1">{error[0]}</p>}
        </div>
      ) : null}

      {!isReadonly && isOpen && (
        <>
          <div
            className="fixed inset-0 z-50"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={() => { setIsOpen(false); onBlur(); }}
          />
          <div
            className="flex flex-col overflow-hidden"
            style={{
              position: 'fixed',
              top: modalPos.y,
              left: modalPos.x,
              width: modalSize.w,
              height: modalSize.h,
              zIndex: 51,
              resize: 'both',
              minWidth: 340,
              minHeight: 260,
              maxWidth: '96vw',
              maxHeight: '92vh',
              backgroundColor: 'var(--owt-color-bg, #FFFFFF)',
              borderRadius: 'var(--owt-widget-card-border-radius, 20px)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                isDragging.current = true;
                dragOrigin.current = { mouseX: e.clientX, mouseY: e.clientY, posX: modalPos.x, posY: modalPos.y };
              }}
              className="flex items-center justify-between px-5 py-4 flex-shrink-0 select-none border-b border-gray-200 cursor-grab"
            >
              <h3 className="text-lg font-semibold text-gray-900">
                {translate('common.selectTitle', { label, defaultValue: `Select ${label}` })}
              </h3>
              <button
                type="button"
                onClick={() => { setIsOpen(false); onBlur(); }}
                onMouseDown={(e) => e.stopPropagation()}
                className="p-0 border-0 bg-transparent cursor-pointer"
                aria-label={translate('common.close', { defaultValue: 'Close' })}
              >
                <img src={closeIcon} alt="" className="w-5 h-5 opacity-60" />
              </button>
            </div>

            <div className="px-5 py-3 flex-shrink-0 border-b border-gray-200">
              <div className="flex items-center gap-2 px-3 h-[30px] border border-gray-300 rounded-[10px] bg-white">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      runSearch(searchText, 1);
                    }
                  }}
                  placeholder={searchPlaceholder}
                  className="flex-1 outline-none text-sm text-gray-900 bg-transparent"
                />
                <button
                  type="button"
                  onClick={() => runSearch(searchText, 1)}
                  aria-label={translate('common.search', { defaultValue: 'Search' })}
                  className="flex-shrink-0 p-0 border-0 bg-transparent cursor-pointer"
                >
                  <img src={searchIcon} alt="" className="w-4 h-4 opacity-40" />
                </button>
              </div>
            </div>

            <div className="overflow-auto flex-1">
              {searchResults.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-10">
                  {searchText
                    ? translate('common.noResults', { defaultValue: 'No results found' })
                    : translate('common.searchHint', { defaultValue: 'Type and press Enter or click search' })}
                </p>
              ) : (
                <ResultsTable
                  rows={searchResults}
                  selectedRowKey={pendingRow?.internal_record_id ?? null}
                  onRowClick={setPendingRow}
                  onRowDoubleClick={applySelection}
                />
              )}
            </div>

            <div
              className={`flex-shrink-0 flex flex-wrap items-center gap-3 px-5 py-3 border-t border-gray-200 ${
                totalCount !== null ? 'justify-between' : 'justify-end'
              }`}
            >
              {totalCount !== null && (
                <PaginationFooter
                  embedded
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  pageSize={pageSize}
                  onPageChange={(page) => runSearch(searchText, page)}
                  onPrev={() => currentPage > 1 && runSearch(searchText, currentPage - 1)}
                  onNext={() => currentPage < totalPages && runSearch(searchText, currentPage + 1)}
                  translate={translate}
                />
              )}
              <button
                type="button"
                onClick={() => pendingRow && applySelection(pendingRow)}
                disabled={!pendingRow}
                className="px-4 h-9 text-sm font-medium rounded-[10px] text-white disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                style={{ backgroundColor: 'var(--owt-color-info, #2563eb)' }}
              >
                {selectRecordLabel}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
