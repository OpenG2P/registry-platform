import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tSchema, toTitleCase } from '../utils/tSchema';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { useWidgetContext } from '../components/WidgetProvider';
import { WidgetFieldLabel } from '../components/WidgetFieldLabel';
import { owtFieldInputClass } from '../theme';
import { useOwtThemeRootProps } from '../hooks/useWidgetTheme';
import { searchIcon, closeIcon } from '../assets';
import type { DataSourceRequestHandler } from '../types';

type ParentLookupPageResult = {
  rows: Record<string, any>[];
  pagination: Record<string, any>;
};

const parentLookupRecordCache = new Map<string, Record<string, any>>();

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

const parentLabel = (row: Record<string, any> | null | undefined) => {
  if (!row) return '';
  if (row.record_name != null && String(row.record_name).trim() !== '') {
    return String(row.record_name);
  }
  return String(row.internal_record_id ?? '');
};

const indexParentRecords = (rows: Record<string, any>[]) => {
  for (const row of rows) {
    const id = String(row.internal_record_id ?? '').trim();
    if (id) {
      parentLookupRecordCache.set(id, row);
    }
  }
};

const hasFilledParams = (params: Record<string, unknown> | undefined | null): boolean => {
  if (!params) return false;
  const values = Object.values(params);
  if (values.length === 0) return false;
  return values.every(
    (value) => value !== null && value !== undefined && String(value).trim() !== '',
  );
};

const fetchParentLookupPage = async (
  handler: DataSourceRequestHandler,
  service: string,
  endpoint: string,
  method: string | undefined,
  params: Record<string, any>,
  headers?: Record<string, string>,
): Promise<ParentLookupPageResult> => {
  const result = await handler(service, endpoint, method || 'POST', params, { headers });
  const parsed: ParentLookupPageResult = {
    rows: (result?.records ?? []) as Record<string, any>[],
    pagination: (result?.pagination ?? {}) as Record<string, any>,
  };
  indexParentRecords(parsed.rows);
  return parsed;
};

export const ParentLookupWidget = ({
  config,
  value: valueProp,
  error: errorProp,
  touched: touchedProp,
  isEnabled: isEnabledProp,
  isRequired: isRequiredProp,
  onChange: onChangeProp,
  onBlur: onBlurProp,
}: {
  config: BaseWidgetConfig;
  value?: any;
  error?: string[];
  touched?: boolean;
  isEnabled?: boolean;
  isRequired?: boolean;
  onChange?: (value: any, validate?: boolean) => void;
  onBlur?: () => void;
}) => {
  const hook = useBaseWidget({ config });

  // WidgetRenderer spreads its hook result as props (includes table onValueChange).
  // Prefer those so parent selection updates the table row / form state.
  const useInjected = typeof onChangeProp === 'function';
  const value = useInjected ? valueProp : hook.value;
  const error = useInjected ? (errorProp ?? hook.error) : hook.error;
  const touched = useInjected ? !!touchedProp : hook.touched;
  const isEnabled = useInjected ? (isEnabledProp ?? hook.isEnabled) : hook.isEnabled;
  const isRequired = useInjected ? !!isRequiredProp : hook.isRequired;
  const onChange = useInjected ? onChangeProp! : hook.onChange;
  const onBlur = useInjected ? (onBlurProp ?? hook.onBlur) : hook.onBlur;
  const widgetConfig = config;

  const { t, dataSourceRequestHandler, hostContext } = useWidgetContext();
  const themeRoot = useOwtThemeRootProps();

  const dataSource = widgetConfig['widget-data-source'] as Record<string, any> | undefined;
  const lookupConfig = widgetConfig['widget-lookup-config'] as Record<string, any> | undefined;
  const pageSize: number = lookupConfig?.page_size ?? 10;
  const isCompact = !widgetConfig['widget-label'];

  const requestParams = useMemo(() => {
    const merged: Record<string, any> = { ...(hostContext || {}) };
    const schemaParams = dataSource?.params || {};
    for (const [key, paramValue] of Object.entries(schemaParams)) {
      if (paramValue !== null && paramValue !== undefined && paramValue !== '') {
        merged[key] = paramValue;
      }
    }
    return merged;
  }, [hostContext, dataSource?.params]);

  const canFetch = useMemo(
    () =>
      hasFilledParams(hostContext) &&
      hasFilledParams(dataSource?.params) &&
      !!dataSource?.service &&
      !!dataSource?.endpoint &&
      !!dataSourceRequestHandler,
    [hostContext, dataSource, dataSourceRequestHandler],
  );

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
      if (!canFetch || !dataSource?.service || !dataSource?.endpoint || !dataSourceRequestHandler) {
        return { rows: [] as Record<string, any>[], pagination: {} as Record<string, any> };
      }
      return fetchParentLookupPage(
        dataSourceRequestHandler,
        dataSource.service,
        dataSource.endpoint,
        dataSource.method,
        {
          ...requestParams,
          search_text: text,
          current_page: page,
          page_size: size,
        },
        dataSource.headers,
      );
    },
    [canFetch, dataSource, dataSourceRequestHandler, requestParams],
  );

  const findRecordByValue = useCallback(
    async (recordValue: unknown): Promise<Record<string, any> | null> => {
      const target = String(recordValue).trim();
      if (!target) return null;

      const cachedRecord = parentLookupRecordCache.get(target);
      if (cachedRecord) {
        return cachedRecord;
      }

      const hydratePageSize: number = lookupConfig?.hydrate_page_size ?? 50;
      let page = 1;
      let pages = 1;

      while (page <= pages) {
        const { rows, pagination } = await fetchRecords('', page, hydratePageSize);
        const match = rows.find(
          (row) => String(row.internal_record_id ?? '').trim() === target,
        );
        if (match) return match;

        pages = parsePagination(pagination, rows.length, hydratePageSize).totalPages;
        if (page >= pages) break;
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
    const onUp = () => {
      isDragging.current = false;
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  const hasValue = value !== null && value !== undefined && value !== '';

  const applySelection = (row: Record<string, any>) => {
    indexParentRecords([row]);
    hydratedValueRef.current = row.internal_record_id;
    onChange(row.internal_record_id);
    setAppliedRecord(row);
    setIsOpen(false);
  };

  const clearSelection = () => {
    hydratedValueRef.current = null;
    onChange(null);
    setAppliedRecord(null);
    setPendingRow(null);
  };

  const openLookup = () => {
    const w = Math.min(Math.round(window.innerWidth * 0.82), 940);
    const h = Math.min(Math.round(window.innerHeight * 0.72), 560);
    setModalPos({
      x: Math.round((window.innerWidth - w) / 2),
      y: Math.round((window.innerHeight - h) / 2),
    });
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
    if (!canFetch) return;
    if (hydratedValueRef.current === value) return;

    let cancelled = false;
    setIsHydrating(true);
    setAppliedRecord(null);

    (async () => {
      try {
        const match = await findRecordByValue(value);
        if (cancelled) return;
        hydratedValueRef.current = value;
        setAppliedRecord(match ?? { internal_record_id: String(value) });
      } catch {
        if (!cancelled) {
          hydratedValueRef.current = value;
          setAppliedRecord({ internal_record_id: String(value) });
        }
      } finally {
        if (!cancelled) setIsHydrating(false);
      }
    })();

    return () => {
      cancelled = true;
      setIsHydrating(false);
    };
  }, [hasValue, value, canFetch, findRecordByValue]);

  const isReadonly = !!widgetConfig['widget-readonly'];
  const rawLabel = widgetConfig['widget-label'];
  const label = tSchema(t, rawLabel || 'Parent');
  const hasError =
    (touched && error.length > 0) || (!!widgetConfig['widget-required'] && !hasValue);

  const placeholder = tSchema(
    t,
    String(lookupConfig?.action_label ?? t?.('common.select') ?? 'Select'),
  );
  const searchPlaceholder = tSchema(
    t,
    String(lookupConfig?.search_placeholder ?? 'Search parent...'),
  );
  const selectRecordLabel = tSchema(
    t,
    String(lookupConfig?.select_record_label ?? 'Select Parent'),
  );

  const displayName = isHydrating
    ? t?.('common.loading', { defaultValue: 'Loading...' })
    : parentLabel(appliedRecord) || (hasValue ? String(value) : '');

  const selectTrigger = isCompact ? (
    <select
      value={hasValue ? '__selected__' : ''}
      disabled={!isEnabled || isReadonly}
      onMouseDown={(e) => {
        if (!isEnabled || isReadonly) return;
        e.preventDefault();
        openLookup();
      }}
      onKeyDown={(e) => {
        if (!isEnabled || isReadonly) return;
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          openLookup();
        }
      }}
      onChange={() => undefined}
      onBlur={onBlur}
      className={`w-full h-[28px] px-2 text-sm border focus:outline-none table-cell-input ${
        !isEnabled || isReadonly ? 'cursor-not-allowed' : 'cursor-pointer'
      }`}
      style={{
        borderRadius: '10px',
        borderColor: hasError
          ? 'var(--owt-color-error)'
          : 'var(--owt-widget-input-border)',
        backgroundColor:
          !isEnabled || isReadonly
            ? 'var(--owt-color-bg-alt)'
            : 'var(--owt-color-bg)',
      }}
      title={hasValue ? displayName : placeholder}
    >
      <option value="">{placeholder}</option>
      {hasValue && <option value="__selected__">{displayName}</option>}
    </select>
  ) : (
    <select
      value={hasValue ? '__selected__' : ''}
      disabled={!isEnabled || isReadonly}
      onMouseDown={(e) => {
        if (!isEnabled || isReadonly) return;
        e.preventDefault();
        openLookup();
      }}
      onKeyDown={(e) => {
        if (!isEnabled || isReadonly) return;
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          openLookup();
        }
      }}
      onChange={() => undefined}
      onBlur={onBlur}
      className={owtFieldInputClass({
        error: hasError,
        disabled: !isEnabled || isReadonly,
        className: `w-full sm:w-[180px] max-w-full h-[30px] px-3 owt-shadow-sm ${
          !isEnabled || isReadonly ? '' : 'cursor-pointer'
        }`,
      })}
      style={{ borderRadius: '10px' }}
      title={hasValue ? displayName : placeholder}
    >
      <option value="">{placeholder}</option>
      {hasValue && <option value="__selected__">{displayName}</option>}
    </select>
  );

  if (isReadonly && !isCompact) {
    return (
      <div className="mb-[10px] flex flex-col sm:flex-row sm:items-start">
        {rawLabel && (
          <div
            className="text-base owt-text-muted font-medium md:min-w-[120px] sm:pr-4 mb-1 sm:mb-0"
            style={{ fontFamily: 'Roboto, sans-serif' }}
            title={label}
          >
            {label}:
          </div>
        )}
        <div className="flex-1 text-base owt-text font-medium">
          {hasValue ? displayName : '-'}
        </div>
      </div>
    );
  }

  if (isReadonly && isCompact) {
    return (
      <span className="text-sm truncate block" style={{ color: 'inherit' }}>
        {hasValue ? displayName : '-'}
      </span>
    );
  }

  return (
    <div className={isCompact ? 'table-cell-field w-full' : 'mb-[10px]'}>
      {isCompact ? (
        <>
          {selectTrigger}
          <p className="table-cell-field-error" aria-hidden="true">
            {'\u00a0'}
          </p>
        </>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-start">
          {rawLabel && (
            <WidgetFieldLabel
              className="text-base font-medium owt-text md:min-w-[120px] sm:pr-4 sm:pt-1 mb-1 sm:mb-0"
              label={rawLabel}
              required={isRequired}
            />
          )}
          <div className="flex-1 min-w-0">
            {selectTrigger}
            {touched && error.length > 0 && (
              <p className="owt-field-error text-sm mt-1">{error[0]}</p>
            )}
          </div>
        </div>
      )}

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[100]"
            style={{ backgroundColor: 'var(--owt-color-overlay)' }}
            onClick={() => {
              setIsOpen(false);
              onBlur();
            }}
          />
          <div
            className={`${themeRoot.className} flex flex-col overflow-hidden`}
            style={{
              ...themeRoot.style,
              position: 'fixed',
              top: modalPos.y,
              left: modalPos.x,
              width: modalSize.w,
              height: modalSize.h,
              zIndex: 101,
              resize: 'both',
              minWidth: 340,
              minHeight: 260,
              maxWidth: '96vw',
              maxHeight: '92vh',
              backgroundColor: 'var(--owt-color-bg)',
              borderRadius: 'var(--owt-widget-card-border-radius)',
              boxShadow: '0 24px 64px var(--owt-color-shadow)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                isDragging.current = true;
                dragOrigin.current = {
                  mouseX: e.clientX,
                  mouseY: e.clientY,
                  posX: modalPos.x,
                  posY: modalPos.y,
                };
              }}
              className="flex items-center justify-between px-5 py-4 flex-shrink-0 select-none border-b owt-border cursor-grab"
            >
              <h3 className="text-lg font-semibold owt-text">
                {t?.('common.selectTitle', { label, defaultValue: `Select ${label}` })}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onBlur();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="p-0 border-0 bg-transparent cursor-pointer"
                aria-label={t?.('common.close', { defaultValue: 'Close' })}
              >
                <img src={closeIcon} alt="" className="w-5 h-5 opacity-60" />
              </button>
            </div>

            <div className="px-5 py-3 flex-shrink-0 border-b owt-border">
              <div className={owtFieldInputClass({ className: 'flex items-center gap-2 px-3 h-[30px] rounded-[10px]' })}>
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
                  className="flex-1 outline-none text-sm owt-text bg-transparent"
                />
                <button
                  type="button"
                  onClick={() => runSearch(searchText, 1)}
                  aria-label={t?.('common.search', { defaultValue: 'Search' })}
                  className="flex-shrink-0 p-0 border-0 bg-transparent cursor-pointer"
                >
                  <img src={searchIcon} alt="" className="w-4 h-4 opacity-40" />
                </button>
              </div>
            </div>

            <div className="overflow-auto flex-1">
              {searchResults.length === 0 ? (
                <p className="text-center text-sm owt-text-muted py-10">
                  {searchText
                    ? t?.('common.noResults', { defaultValue: 'No results found' })
                    : t?.('common.searchHint', {
                        defaultValue: 'Type and press Enter or click search',
                      })}
                </p>
              ) : (
                <div className="overflow-auto h-full">
                  <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0 z-[1] owt-bg-alt">
                      <tr>
                        <th
                          className="text-left px-4 py-2 text-sm font-medium owt-text-muted border-b owt-border owt-bg-alt max-w-[12rem]"
                          title={toTitleCase(tSchema(t, 'record_name'))}
                        >
                          <span className="block truncate">
                            {toTitleCase(tSchema(t, 'record_name'))}
                          </span>
                        </th>
                        <th
                          className="text-left px-4 py-2 text-sm font-medium owt-text-muted border-b owt-border owt-bg-alt max-w-[12rem]"
                          title={toTitleCase(tSchema(t, 'internal_record_id'))}
                        >
                          <span className="block truncate">
                            {toTitleCase(tSchema(t, 'internal_record_id'))}
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchResults.map((row, idx) => {
                        const rowKey = row.internal_record_id ?? idx;
                        const isSelected =
                          pendingRow?.internal_record_id != null &&
                          rowKey === pendingRow.internal_record_id;
                        return (
                          <tr
                            key={rowKey}
                            onClick={() => setPendingRow(row)}
                            onDoubleClick={() => applySelection(row)}
                            className={`cursor-pointer border-b owt-border transition-colors ${
                              isSelected ? 'owt-highlight' : 'owt-highlight-hover'
                            }`}
                          >
                            <td className="px-4 py-2 text-sm owt-text whitespace-nowrap">
                              {parentLabel(row) || '-'}
                            </td>
                            <td className="px-4 py-2 text-sm owt-text whitespace-nowrap">
                              {row.internal_record_id != null
                                ? String(row.internal_record_id)
                                : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div
              className={`flex-shrink-0 flex flex-wrap items-center gap-3 px-5 py-3 border-t owt-border ${
                totalCount !== null ? 'justify-between' : 'justify-end'
              }`}
            >
              {totalCount !== null && (
                <span className="text-sm owt-text-muted">
                  {totalCount === 1
                    ? t?.('common.record', {
                        count: totalCount,
                        defaultValue: `${totalCount} record`,
                      })
                    : t?.('common.records', {
                        count: totalCount,
                        defaultValue: `${totalCount} records`,
                      })}
                  {totalCount > 0 &&
                    ` · ${(currentPage - 1) * pageSize + 1}-${Math.min(
                      currentPage * pageSize,
                      totalCount,
                    )}`}
                </span>
              )}
              <div className="flex items-center gap-2">
                {totalCount !== null && (
                  <>
                    <button
                      type="button"
                      onClick={() => currentPage > 1 && runSearch(searchText, currentPage - 1)}
                      disabled={currentPage <= 1}
                      className="px-3 h-8 text-sm font-medium rounded-[10px] owt-bg-alt owt-text disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {t?.('common.previous', { defaultValue: 'Prev' })}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        currentPage < totalPages && runSearch(searchText, currentPage + 1)
                      }
                      disabled={currentPage >= totalPages}
                      className="px-3 h-8 text-sm font-medium rounded-[10px] owt-bg-alt owt-text disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {t?.('common.next', { defaultValue: 'Next' })}
                    </button>
                  </>
                )}
                {hasValue && (
                  <button
                    type="button"
                    onClick={() => {
                      clearSelection();
                      setIsOpen(false);
                      onBlur();
                    }}
                    className="px-4 h-9 text-sm font-medium rounded-[10px] owt-bg-alt owt-text flex-shrink-0"
                  >
                    {t?.('common.remove', { defaultValue: 'Clear' })}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => pendingRow && applySelection(pendingRow)}
                  disabled={!pendingRow}
                  className="px-4 h-9 text-sm font-medium rounded-[10px] text-white disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                  style={{ backgroundColor: 'var(--owt-color-info)' }}
                >
                  {selectRecordLabel}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
