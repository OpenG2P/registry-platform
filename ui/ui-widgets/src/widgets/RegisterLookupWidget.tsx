import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';
import { useWidgetContext } from '../components/WidgetProvider';
import { searchIcon, closeIcon } from '../assets';

/**
 * Register lookup widget — searchable popup to select a record from any register.
 * Stores only the selected record ID (valueKey) at widget-data-path.
 *
 * Usage in schema:
 * {
 *   "widget": "register-lookup",
 *   "widget-type": "input",
 *   "widget-label": "Household",
 *   "widget-id": "household_id",
 *   "widget-data-path": "<section-register-id>.household_id",
 *   "widget-required": true,
 *   "widget-data-source": {
 *     "type": "api",
 *     "service": "register",
 *     "endpoint": "records",
 *     "method": "POST",
 *     "valueKey": "functional_record_id",
 *     "labelKey": "record_name",
 *     "params": {
 *       "register_id": "<target-register-uuid>"
 *     }
 *   },
 *   "widget-lookup-config": {
 *     "search_placeholder": "Search by name or ID...",
 *     "page_size": 10,
 *     "action_label": "Click to Search Household"
 *   }
 * }
 */
interface DisplayField {
  label: string;
  value: string;
}

const normalizeDisplayFields = (row: Record<string, any>): DisplayField[] => {
  if (!Array.isArray(row.display_fields)) return [];
  return [...row.display_fields]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((f) => ({
      label: String(f.field_name ?? ''),
      value: f.value !== null && f.value !== undefined ? String(f.value) : '-',
    }));
};

const deriveColumns = (
  rows: Record<string, any>[],
  labelKey: string,
): { key: string; header: string }[] => {
  if (rows.length === 0) return [];
  const cols: { key: string; header: string }[] = [{ key: labelKey, header: labelKey }];
  for (const f of normalizeDisplayFields(rows[0])) {
    cols.push({ key: f.label, header: f.label });
  }
  return cols;
};

type TranslateFn = (
  key: string,
  options?: { defaultValue?: string; [key: string]: unknown },
) => string;

interface PaginationFooterProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPrev: () => void;
  onNext: () => void;
  translate: TranslateFn;
}

const PaginationFooter = ({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  onPrev,
  onNext,
  translate,
}: PaginationFooterProps) => {
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
      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 flex-shrink-0 border-t border-gray-200"
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
            {translate('common.ofPages', {
              total: totalPages,
              defaultValue: `of ${totalPages}`,
            })}
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

interface ResultsTableProps {
  rows: Record<string, any>[];
  valueKey: string;
  labelKey: string;
  onSelect: (row: Record<string, any>) => void;
  translate: (key: string) => string;
}

const ResultsTable = ({ rows, valueKey, labelKey, onSelect, translate }: ResultsTableProps) => {
  const columns = deriveColumns(rows, labelKey);

  const getCellValue = (row: Record<string, any>, colKey: string): string => {
    if (colKey === labelKey) return row[labelKey] != null ? String(row[labelKey]) : '-';
    const match = normalizeDisplayFields(row).find((f) => f.label === colKey);
    return match ? match.value : '-';
  };

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
                {translate(col.header)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={row[valueKey] ?? idx}
              onClick={() => onSelect(row)}
              className="cursor-pointer border-b border-gray-100 hover:bg-blue-50 transition-colors"
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">
                  {getCellValue(row, col.key)}
                </td>
              ))}
            </tr>
          ))}
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
    onChange,
    onBlur,
    config: widgetConfig,
  } = useBaseWidget({ config });

  const { translate, translateConfig } = useWidgetTranslation();
  const { dataSourceRequestHandler } = useWidgetContext();

  const dataSource = widgetConfig['widget-data-source'] as Record<string, any> | undefined;
  const lookupConfig = widgetConfig['widget-lookup-config'] as Record<string, any> | undefined;

  const valueKey: string = dataSource?.valueKey || 'id';
  const labelKey: string = dataSource?.labelKey || 'name';
  const pageSize: number = lookupConfig?.page_size ?? 10;

  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<Record<string, any>[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  const [modalPos, setModalPos] = useState({ x: 80, y: 80 });
  const [modalSize, setModalSize] = useState({ w: 860, h: 520 });
  const isDragging = useRef(false);
  const dragOrigin = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });
  const searchInputRef = useRef<HTMLInputElement>(null);

  const runSearch = useCallback(
    async (text: string, page = 1) => {
      if (!dataSource?.service || !dataSource?.endpoint || !dataSourceRequestHandler) return;

      try {
        const result = await dataSourceRequestHandler(
          dataSource.service,
          dataSource.endpoint,
          dataSource.method,
          {
            ...(dataSource.params || {}),
            search_text: text,
            current_page: page,
            page_size: pageSize,
          },
          { headers: dataSource.headers },
        );

        const rows: Record<string, any>[] = result?.records ?? [];
        const pagination = result?.pagination ?? {};

        setSearchResults(rows);
        setTotalCount(
          typeof pagination.number_of_items === 'number' ? pagination.number_of_items : rows.length,
        );
        setTotalPages(
          typeof pagination.number_of_pages === 'number'
            ? Math.max(1, pagination.number_of_pages)
            : 1,
        );
        setCurrentPage(pagination.current_page ?? page);
      } catch {
        setSearchResults([]);
        setTotalCount(null);
        setTotalPages(1);
        setCurrentPage(1);
      }
    },
    [dataSource, dataSourceRequestHandler, pageSize],
  );

  const handleOpen = () => {
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
    setTimeout(() => searchInputRef.current?.focus(), 50);
    runSearch('', 1);
  };

  const handleClose = () => {
    setIsOpen(false);
    onBlur();
  };

  const onHeaderMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragOrigin.current = { mouseX: e.clientX, mouseY: e.clientY, posX: modalPos.x, posY: modalPos.y };
  };

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

  const handleSelect = (row: Record<string, any>) => {
    onChange(row[valueKey]);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  const label = translateConfig(widgetConfig['widget-label']);
  const searchPlaceholder = lookupConfig?.search_placeholder
    ? translateConfig(String(lookupConfig.search_placeholder))
    : translate('common.searchPlaceholder', { defaultValue: 'Search...' });
  const actionLabel = lookupConfig?.action_label
    ? translateConfig(String(lookupConfig.action_label))
    : translate('common.selectAction', { label, defaultValue: `Select ${label}` });
  const selectTitle = translate('common.selectTitle', {
    label,
    defaultValue: `Select ${label}`,
  });
  const hasValue = value !== null && value !== undefined && value !== '';
  const displayValue = hasValue ? String(value) : null;
  const hasError =
    (touched && error.length > 0) ||
    (widgetConfig['widget-required'] && !hasValue);

  if (widgetConfig['widget-readonly']) {
    return (
      <div className="mb-[10px] flex flex-col sm:flex-row sm:items-start">
        {label && (
          <div
            className="text-base text-gray-600 font-medium md:min-w-[120px] sm:pr-4 mb-1 sm:mb-0"
            style={{ fontFamily: 'Roboto, sans-serif' }}
            title={label}
          >
            {label}:
          </div>
        )}
        <div className="flex-1">
          <div className="text-base text-gray-900 font-medium" title={displayValue ?? undefined}>
            {displayValue ?? '-'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-[10px]">
      <div className="flex flex-col sm:flex-row sm:items-start">
        <label
          className="text-base font-medium text-gray-700 md:min-w-[120px] sm:pr-4 sm:pt-1 mb-1 sm:mb-0"
          style={{ fontFamily: 'Roboto, sans-serif' }}
          title={label}
        >
          {label}
          {widgetConfig['widget-required'] && <span className="text-red-500 ml-1">*</span>}
        </label>

        <div className="flex-1 min-w-0">
          {hasValue ? (
            <div className="flex flex-col items-start gap-1 min-w-0">
              <span
                className="text-base text-gray-900 font-medium truncate max-w-full sm:max-w-[180px]"
                title={displayValue ?? undefined}
              >
                {displayValue}
              </span>
              {isEnabled && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleOpen}
                    className="text-sm underline p-0 border-0 bg-transparent cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded"
                    style={{ color: 'var(--owt-color-info, #2563eb)' }}
                  >
                    {translate('common.change', { defaultValue: 'Change' })}
                  </button>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-sm underline text-red-500 p-0 border-0 bg-transparent cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 rounded"
                  >
                    {translate('common.remove', { defaultValue: 'Remove' })}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              disabled={!isEnabled}
              onClick={handleOpen}
              title={actionLabel}
              className={`flex items-center gap-2 w-full sm:w-[180px] max-w-full px-3 h-[30px] text-sm border rounded-[10px] shadow-sm transition-colors ${
                hasError
                  ? 'border-red-500 text-gray-700'
                  : 'border-gray-300 text-gray-700'
              } ${!isEnabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white cursor-pointer'}`}
            >
              <img src={searchIcon} alt="" className="w-4 h-4 opacity-50 flex-shrink-0" />
              <span className="truncate">{actionLabel}</span>
            </button>
          )}

          {touched && error.length > 0 && (
            <p className="text-red-500 text-sm mt-1">{error[0]}</p>
          )}
        </div>
      </div>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-50"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={handleClose}
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
              onMouseDown={onHeaderMouseDown}
              className="flex items-center justify-between px-5 py-4 flex-shrink-0 select-none border-b border-gray-200 cursor-grab"
            >
              <h3 className="text-lg font-semibold text-gray-900">
                {selectTitle}
              </h3>
              <button
                type="button"
                onClick={handleClose}
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
                    : translate('common.searchHint', {
                        defaultValue: 'Type and press Enter or click search',
                      })}
                </p>
              ) : (
                <ResultsTable
                  rows={searchResults}
                  valueKey={valueKey}
                  labelKey={labelKey}
                  onSelect={handleSelect}
                  translate={translateConfig}
                />
              )}
            </div>

            {totalCount !== null && (
              <PaginationFooter
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
          </div>
        </>
      )}
    </div>
  );
};
