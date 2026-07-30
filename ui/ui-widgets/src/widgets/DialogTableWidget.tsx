import { memo, useCallback, useMemo, useRef, useState, type CSSProperties } from 'react';
import { tSchema } from '../utils/tSchema';
import { useWidgetContext } from '../components/WidgetProvider';
import { useDispatch, useSelector } from 'react-redux';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { WidgetRenderer } from '../components/WidgetRenderer';
import { formatValue } from '../utils/formatting';
import { WidgetRootState } from '../store';
import { resetWidget, setError, setTouched, setValues } from '../store/widgetSlice';
import { validateWidget } from '../utils/validation';
import { shouldRequireWidget, shouldShowWidget } from '../utils/conditions';
import { setValueByPath } from '../utils/pathUtils';


interface DialogTableWidgetProps {
  config: BaseWidgetConfig;
}

type DialogMode = 'add' | 'edit';

const isUnsetRowValue = (value: unknown): boolean =>
  value === null || value === undefined || value === '';

const buildDialogConditionValues = (
  row: Record<string, any>,
  columns: any[],
): Record<string, any> => {
  let context: Record<string, any> = { ...row };
  columns.forEach((col) => {
    const columnKey = col['column-key'];
    if (!columnKey || row[columnKey] === undefined) {
      return;
    }
    const dataPath = col['widget-data-path'];
    if (typeof dataPath === 'string' && dataPath) {
      context = setValueByPath(context, dataPath, row[columnKey]);
    }
  });
  return context;
};

type DialogColumnSegment =
  | { type: 'single'; col: any }
  | { type: 'group'; group: string; cols: any[] };

const buildDialogColumnSegments = (columns: any[]): DialogColumnSegment[] => {
  const segments: DialogColumnSegment[] = [];
  let index = 0;

  while (index < columns.length) {
    const group = columns[index]['column-group'];
    if (group) {
      const groupCols: any[] = [];
      while (index < columns.length && columns[index]['column-group'] === group) {
        groupCols.push(columns[index]);
        index += 1;
      }
      segments.push({ type: 'group', group, cols: groupCols });
    } else {
      segments.push({ type: 'single', col: columns[index] });
      index += 1;
    }
  }

  return segments;
};

/** Match TableWidget cell styling for add / update / delete rows */
const getRowCellStyle = (editAction?: string): CSSProperties => {
  if (editAction === 'ADD') {
    return { color: 'var(--owt-color-success, #16A34A)' };
  }
  if (editAction === 'DELETE') {
    return {
      color: 'var(--owt-color-error, #B91C1C)',
      textDecoration: 'line-through',
    };
  }
  if (editAction === 'UPDATE') {
    return { color: 'var(--owt-color-warning, #F59E0B)' };
  }
  return {};
};

const SelectDisplayValue = ({ config, value }: { config: BaseWidgetConfig; value: any }) => {
  const { dataSourceOptions, loading } = useBaseWidget({ config });

  if (loading) return <span>-</span>;
  if (value === null || value === undefined || value === '') return <span>-</span>;

  const selectedOption = dataSourceOptions.find(
    (option: any) => option.value === value || String(option.value) === String(value)
  );
  return <span>{selectedOption ? selectedOption.label : String(value)}</span>;
};

interface DialogTableFieldProps {
  col: any;
  cellWidgetId: string;
  dialogConditionValues: Record<string, any>;
  isReadonly: boolean;
}

/** Isolated dialog field — avoids re-running data-source effects when sibling fields update. */
const DialogTableField = memo(function DialogTableField({
  col,
  cellWidgetId,
  dialogConditionValues,
  isReadonly,
}: DialogTableFieldProps) {
  const widgetType = col.widget || 'text';

  const fieldConfig = useMemo((): BaseWidgetConfig => {
    return {
      ...col,
      widget: widgetType,
      'widget-type': col['widget-type'] || 'input',
      'widget-id': cellWidgetId,
      'widget-label': col['widget-label'] || col['column-label'] || col['column-key'] || '',
      'widget-readonly': isReadonly || col['widget-readonly'] === true,
      'widget-data-path': undefined,
      'widget-data-default': col['widget-data-default'],
      'widget-data-options': undefined,
      'widget-required': shouldRequireWidget(
        col['widget-data-options'],
        dialogConditionValues,
        col['widget-required'],
      ),
    };
  }, [col, cellWidgetId, dialogConditionValues, isReadonly, widgetType]);

  return (
    <div className="min-w-0">
      <WidgetRenderer config={fieldConfig} />
    </div>
  );
});

/**
 * Dialog table widget:
 * - Table displays a subset of columns (n out of x)
 * - Add/Edit happens in a modal dialog that shows ALL columns as a form
 */
export const DialogTableWidget = ({ config }: DialogTableWidgetProps) => {
  const { value, error, touched, isEnabled, onChange, config: widgetConfig } = useBaseWidget({ config });
  const { t } = useWidgetContext();
  const dispatch = useDispatch();

  const rows: any[] = Array.isArray(value) ? value : [];
  const columns: any[] = widgetConfig['widget-data-columns'] || [];
  const operations = widgetConfig['widget-data-operations'] || {};
  const isReadonly = widgetConfig['widget-readonly'] || false;

  // Soft-delete (keep row, red + strikethrough) whenever remove is allowed — matches TableWidget
  const shouldSoftDeleteOnRemove = !isReadonly && !!operations.remove;

  const visibleColumnKeys: string[] | undefined = widgetConfig['widget-data-visible-columns'];
  const visibleColumns = useMemo(() => {
    if (Array.isArray(visibleColumnKeys) && visibleColumnKeys.length > 0) {
      const keySet = new Set(visibleColumnKeys);
      return columns.filter((c) => keySet.has(c['column-key']));
    }
    return columns.filter((c) => c['column-visible-in-table'] !== false);
  }, [columns, visibleColumnKeys]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>('add');
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  const dialogSessionRef = useRef(0);
  const [dialogSessionId, setDialogSessionId] = useState(0);

  const membersWidgetId = widgetConfig['widget-id'];

  const addDialogTitle =
    tSchema(t, widgetConfig['widget-data-dialog-title-add']) ||
    t?.('table.addRecordDialog') ||
    'Add record';
  const editDialogTitle =
    tSchema(t, widgetConfig['widget-data-dialog-title-edit']) ||
    t?.('table.editRecordDialog') ||
    'Edit record';

  const buildEmptyRow = useCallback(() => {
    const emptyRow: Record<string, any> = {};
    columns.forEach((col) => {
      const key = col['column-key'];
      if (col['widget-data-default'] !== undefined) {
        emptyRow[key] = col['widget-data-default'];
      } else if (col.widget === 'checkbox') {
        emptyRow[key] = false;
      }
    });
    return emptyRow;
  }, [columns]);

  const dialogFieldWidgetId = useCallback(
    (sessionId: number, columnKey: string) =>
      `${membersWidgetId}-dlg-${sessionId}-${columnKey}`,
    [membersWidgetId],
  );

  const resetDialogWidgets = useCallback(
    (sessionId: number) => {
      if (sessionId <= 0) return;
      columns.forEach((col) => {
        dispatch(resetWidget(dialogFieldWidgetId(sessionId, col['column-key'])));
      });
    },
    [columns, dialogFieldWidgetId, dispatch],
  );

  const seedDialogReduxValues = useCallback(
    (sessionId: number, rowData: Record<string, any>) => {
      const seeds: Record<string, any> = {};
      columns.forEach((col) => {
        const key = col['column-key'];
        if (rowData[key] !== undefined) {
          seeds[dialogFieldWidgetId(sessionId, key)] = rowData[key];
        }
      });
      if (Object.keys(seeds).length > 0) {
        dispatch(setValues(seeds));
      }
    },
    [columns, dialogFieldWidgetId, dispatch],
  );

  const beginDialogSession = useCallback(() => {
    dialogSessionRef.current += 1;
    const nextSession = dialogSessionRef.current;
    setDialogSessionId(nextSession);
    return nextSession;
  }, []);

  const openAddDialog = useCallback(() => {
    resetDialogWidgets(dialogSessionId);
    const sessionId = beginDialogSession();
    seedDialogReduxValues(sessionId, buildEmptyRow());
    setDialogMode('add');
    setActiveRowIndex(null);
    setDialogOpen(true);
  }, [
    buildEmptyRow,
    beginDialogSession,
    resetDialogWidgets,
    dialogSessionId,
    seedDialogReduxValues,
  ]);

  const openEditDialog = useCallback(
    (rowIndex: number) => {
      resetDialogWidgets(dialogSessionId);
      const sessionId = beginDialogSession();
      const row = rows[rowIndex] || {};
      const nextFormData: Record<string, any> = buildEmptyRow();
      columns.forEach((col) => {
        const key = col['column-key'];
        if (row[key] !== undefined) nextFormData[key] = row[key];
      });
      seedDialogReduxValues(sessionId, nextFormData);
      setDialogMode('edit');
      setActiveRowIndex(rowIndex);
      setDialogOpen(true);
    },
    [
      rows,
      columns,
      buildEmptyRow,
      resetDialogWidgets,
      dialogSessionId,
      beginDialogSession,
      seedDialogReduxValues,
    ],
  );

  const closeDialog = useCallback(() => {
    const sessionToClear = dialogSessionId;
    setDialogOpen(false);
    setActiveRowIndex(null);
    resetDialogWidgets(sessionToClear);
    setDialogSessionId(0);
  }, [dialogSessionId, resetDialogWidgets]);

  const dialogStoreValues = useSelector((state: WidgetRootState) => {
    if (dialogSessionId <= 0) {
      return {} as Record<string, any>;
    }
    const values = state.widget?.values ?? {};
    const row: Record<string, any> = {};
    columns.forEach((col) => {
      const k = col['column-key'];
      const wid = dialogFieldWidgetId(dialogSessionId, k);
      if (values[wid] !== undefined) {
        row[k] = values[wid];
      }
    });
    return row;
  });

  const dialogRowValues = dialogStoreValues;

  const dialogConditionValues = useMemo(
    () => buildDialogConditionValues(dialogRowValues, columns),
    [dialogRowValues, columns],
  );

  const collectMergedRowPayload = useCallback(
    () => dialogStoreValues,
    [dialogStoreValues],
  );

  const finalizeDialogRowPayload = useCallback(
    (raw: Record<string, any>) => {
      const conditionValues = buildDialogConditionValues(raw, columns);
      const result: Record<string, any> = {};
      columns.forEach((col) => {
        const key = col['column-key'];
        if (!shouldShowWidget(col['widget-data-options'], conditionValues)) {
          return;
        }
        const val = raw[key];
        if (!isUnsetRowValue(val)) {
          result[key] = val;
        }
      });
      return result;
    },
    [columns],
  );

  const saveDialog = useCallback(() => {
    const payload = collectMergedRowPayload();
    const conditionValues = buildDialogConditionValues(payload, columns);
    let hasErrors = false;

    columns.forEach((col) => {
      const key = col['column-key'];
      const cellWidgetId = dialogFieldWidgetId(dialogSessionId, key);
      const isColReadonly = isReadonly || col['widget-readonly'] === true;

      if (isColReadonly) return;
      if (!shouldShowWidget(col['widget-data-options'], conditionValues)) return;

      const cellValue = payload[key];
      const isRequired = shouldRequireWidget(
        col['widget-data-options'],
        conditionValues,
        col['widget-required'],
      );
      const validationErrors = validateWidget(
        cellValue,
        col['widget-data-validation'],
        isRequired
      );

      if (validationErrors && validationErrors.length > 0) {
        hasErrors = true;
        dispatch(setError({ widgetId: cellWidgetId, errors: validationErrors }));
        dispatch(setTouched({ widgetId: cellWidgetId, touched: true }));
      } else {
        dispatch(setError({ widgetId: cellWidgetId, errors: [] }));
      }
    });

    if (hasErrors) {
      return;
    }

    const cleaned = finalizeDialogRowPayload(payload);

    if (dialogMode === 'add') {
      const savedRow = { ...cleaned, edit_action: 'ADD' };
      onChange([...rows, savedRow]);
      closeDialog();
      return;
    }

    if (dialogMode === 'edit' && activeRowIndex !== null) {
      const newRows = [...rows];
      const currentRow = newRows[activeRowIndex] || {};
      const wasDeleted = currentRow.edit_action === 'DELETE';
      const editAction = wasDeleted ? 'UPDATE' : (currentRow.edit_action ?? 'UPDATE');
      const merged = { ...currentRow, ...cleaned, edit_action: editAction };
      columns.forEach((col) => {
        const key = col['column-key'];
        if (!(key in cleaned)) {
          delete merged[key];
        }
      });
      newRows[activeRowIndex] = merged;
      onChange(newRows);
      closeDialog();
    }
  }, [
    collectMergedRowPayload,
    finalizeDialogRowPayload,
    dialogMode,
    onChange,
    rows,
    closeDialog,
    activeRowIndex,
    columns,
    dialogSessionId,
    dialogFieldWidgetId,
    isReadonly,
    dispatch,
  ]);

  const deleteRow = useCallback(
    (rowIndex: number) => {
      if (shouldSoftDeleteOnRemove) {
        const newRows = [...rows];
        newRows[rowIndex] = {
          ...newRows[rowIndex],
          edit_action: 'DELETE',
        };
        onChange(newRows);
        return;
      }
      onChange(rows.filter((_, i) => i !== rowIndex));
    },
    [rows, onChange, shouldSoftDeleteOnRemove],
  );

  const getDisplayValue = useCallback((rowIndex: number, column: any) => {
    const key = column['column-key'];
    const cellValue = rows[rowIndex]?.[key];
    const widgetType = column.widget || 'text';

    if (cellValue === null || cellValue === undefined || cellValue === '') return '-';
    if (widgetType === 'select') return null;
    if (widgetType === 'parent-lookup') return null;
    if (column['widget-data-format']) return formatValue(cellValue, column['widget-data-format'], column.widget);
    return String(cellValue);
  }, [rows]);

  const dialogColumnSegments = useMemo(() => {
    return buildDialogColumnSegments(columns)
      .map((segment) => {
        if (segment.type === 'single') {
          if (!shouldShowWidget(segment.col['widget-data-options'], dialogConditionValues)) {
            return null;
          }
          return segment;
        }

        const visibleCols = segment.cols.filter((col) =>
          shouldShowWidget(col['widget-data-options'], dialogConditionValues),
        );
        if (visibleCols.length === 0) {
          return null;
        }
        return { type: 'group' as const, group: segment.group, cols: visibleCols };
      })
      .filter((segment): segment is DialogColumnSegment => segment !== null);
  }, [columns, dialogConditionValues]);

  const renderDialogField = (col: any) => {
    const key = col['column-key'];
    const cellWidgetId = dialogFieldWidgetId(dialogSessionId, key);
    return (
      <DialogTableField
        key={`${dialogSessionId}-${key}`}
        col={col}
        cellWidgetId={cellWidgetId}
        dialogConditionValues={dialogConditionValues}
        isReadonly={isReadonly}
      />
    );
  };

  const tableWidgetId = `dialog-table-widget-${widgetConfig['widget-id']}`;
  const columnSpan = widgetConfig['widget-column-span'] || 2;
  const minWidth = columnSpan * 200;

  return (
    <>
      <style>{`
        .${tableWidgetId} {
          width: 100%;
          min-width: ${minWidth}px;
        }

        .widget-container[data-widget-id="${widgetConfig['widget-id']}"] {
          min-width: ${minWidth}px;
          width: 100%;
          flex: none;
        }

        .panel-horizontal .widget-container[data-widget-id="${widgetConfig['widget-id']}"],
        [data-panel-orientation="horizontal"] .widget-container[data-widget-id="${widgetConfig['widget-id']}"] {
          grid-column: span ${columnSpan};
        }
      `}</style>

      <div className={`table-widget-container ${tableWidgetId}`}>
        {operations.add && !isReadonly && isEnabled && (
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={openAddDialog}
              className="px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                borderRadius: 'var(--owt-btn-border-radius, 10px)',
                border: '1px solid var(--owt-btn-primary-border, #F07B1A)',
                backgroundColor: 'var(--owt-color-primary, #F5BB1A)',
                color: 'var(--owt-color-bg, #FFFFFF)',
              }}
            >
              {t?.('table.addRecord') || 'Add New Record'}
            </button>
          </div>
        )}

        <div
          className="overflow-x-auto border"
          style={{
            borderRadius: 'var(--owt-widget-table-border-radius, 15px)',
            borderColor: 'var(--owt-widget-table-border-color, #C4C4C4)',
          }}
        >
          <table className="min-w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead style={{ backgroundColor: 'var(--owt-widget-table-header-bg, #F6F6F6)' }}>
              <tr style={{ borderBottom: '1px solid var(--owt-widget-table-row-divider, #E4E4E4)' }}>
                {visibleColumns.map((col) => (
                  <th
                    key={col['column-key']}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                    style={{ color: 'var(--owt-widget-table-header-color, #727474)' }}
                  >
                    {tSchema(t, col['column-label'] || col['widget-label'] || col['column-key'])}
                  </th>
                ))}
                {((operations.edit || operations.remove) && !isReadonly) && (
                  <th
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                    style={{ color: 'var(--owt-widget-table-header-color, #727474)' }}
                  >
                    {t?.('common.actions') || 'Actions'}
                  </th>
                )}
              </tr>
            </thead>

            <tbody style={{ backgroundColor: 'var(--owt-widget-table-body-bg, #FFFFFF)' }}>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={visibleColumns.length + (((operations.edit || operations.remove) && !isReadonly) ? 1 : 0)}
                    className="px-4 py-6 text-center text-sm"
                    style={{ color: 'var(--owt-widget-table-empty-color, #727474)' }}
                  >
                    {t?.('table.noData') || 'No records available.'}
                    {operations.add && !isReadonly && ` ${t?.('table.clickToAdd') || 'Click "Add New Record" to add one.'}`}
                  </td>
                </tr>
              )}

              {rows.map((row, rowIndex) => {
                const cellStyle = getRowCellStyle(row?.edit_action);
                return (
                <tr
                  key={rowIndex}
                  style={{
                    borderBottom: '1px solid var(--owt-widget-table-row-divider, #E4E4E4)',
                    backgroundColor: row?.edit_action === 'DELETE'
                      ? 'var(--owt-widget-table-deleted-row-bg, #FEE2E2)'
                      : undefined,
                  }}
                >
                  {visibleColumns.map((col) => {
                    const key = col['column-key'];
                    const widgetType = col.widget || 'text';
                    const displayValue = getDisplayValue(rowIndex, col);

                    if (widgetType === 'select' && displayValue === null) {
                      const displayConfig: BaseWidgetConfig = {
                        ...col,
                        'widget-id': `${widgetConfig['widget-id']}-view-row-${rowIndex}-col-${key}`,
                        'widget-label': '',
                        'widget-readonly': true,
                        'widget-data-path': undefined,
                      };
                      return (
                        <td key={key} className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm" style={cellStyle}>
                            <SelectDisplayValue config={displayConfig} value={row?.[key]} />
                          </div>
                        </td>
                      );
                    }

                    if (widgetType === 'parent-lookup' && displayValue === null) {
                      const cellWidgetId = `${widgetConfig['widget-id']}-view-row-${rowIndex}-col-${key}`;
                      const displayConfig: BaseWidgetConfig = {
                        ...col,
                        'widget-id': cellWidgetId,
                        'widget-label': '',
                        'widget-readonly': true,
                        'widget-data-path': undefined,
                        'widget-data-default': row?.[key] ?? '',
                      };
                      return (
                        <td key={key} className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm table-cell-widget" style={cellStyle}>
                            <WidgetRenderer
                              config={displayConfig}
                              schemaData={{ [cellWidgetId]: row?.[key] ?? '' }}
                            />
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td key={key} className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm" style={cellStyle}>{displayValue}</div>
                      </td>
                    );
                  })}

                  {((operations.edit || operations.remove) && !isReadonly) && (
                    <td className="px-4 py-3 whitespace-nowrap" style={{ minWidth: '120px' }}>
                      <div className="flex gap-2">
                        {operations.edit && (
                          <button
                            type="button"
                            onClick={() => openEditDialog(rowIndex)}
                            disabled={!isEnabled}
                            className="px-3 py-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                              borderRadius: 'var(--owt-btn-border-radius, 10px)',
                              color: 'var(--owt-color-primary-dark, #F07B1A)',
                              backgroundColor: 'transparent',
                              border: 'none',
                            }}
                          >
                            {t?.('common.edit') || 'Edit'}
                          </button>
                        )}
                        {operations.remove && (
                          <button
                            type="button"
                            onClick={() => deleteRow(rowIndex)}
                            disabled={!isEnabled}
                            className="px-3 py-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                              borderRadius: 'var(--owt-btn-border-radius, 10px)',
                              color: 'var(--owt-color-error, #B91C1C)',
                              backgroundColor: 'transparent',
                              border: 'none',
                            }}
                          >
                            {t?.('common.remove') || 'Delete'}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>

        {touched && error.length > 0 && (
          <p className="text-sm mt-1" style={{ color: 'var(--owt-widget-error-color, #B91C1C)' }}>
            {error[0]}
          </p>
        )}
      </div>

      {dialogOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div
            className="rounded-lg p-6 w-full mx-4"
            style={{
              maxWidth: '900px',
              backgroundColor: 'var(--owt-color-bg, #FFFFFF)',
              borderRadius: 'var(--owt-widget-card-border-radius, 20px)',
            }}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--owt-color-text, #011627)' }}>
                {dialogMode === 'add' ? addDialogTitle : editDialogTitle}
              </h3>
              <button
                type="button"
                onClick={closeDialog}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--owt-color-text-muted, #727474)',
                  cursor: 'pointer',
                  fontSize: '20px',
                  lineHeight: 1,
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div
              key={`dialog-fields-${dialogSessionId}`}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
              style={{ maxHeight: '70vh', overflow: 'auto' }}
            >
              {dialogColumnSegments.map((segment) => {
                if (segment.type === 'single') {
                  return renderDialogField(segment.col);
                }

                return (
                  <div
                    key={`${dialogSessionId}-group-${segment.group}`}
                    className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    {segment.cols.map((col) => renderDialogField(col))}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={closeDialog}
                className="px-4 py-2 text-sm font-medium"
                style={{
                  borderRadius: 'var(--owt-btn-border-radius, 10px)',
                  border: '1px solid var(--owt-btn-secondary-border, #C4C4C4)',
                  backgroundColor: 'var(--owt-btn-secondary-bg, #FFFFFF)',
                  color: 'var(--owt-btn-secondary-color, #011627)',
                }}
              >
                {t?.('common.cancel') || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={saveDialog}
                disabled={isReadonly || !isEnabled}
                className="px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  borderRadius: 'var(--owt-btn-border-radius, 10px)',
                  border: '1px solid var(--owt-btn-primary-border, #F07B1A)',
                  backgroundColor: 'var(--owt-color-primary, #F5BB1A)',
                  color: 'var(--owt-color-bg, #FFFFFF)',
                }}
              >
                {t?.('common.save') || 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};