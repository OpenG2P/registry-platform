import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { WidgetRenderer } from '../components/WidgetRenderer';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';
import { formatValue } from '../utils/formatting';
import { WidgetRootState } from '../store';
import { resetWidget, setError, setTouched } from '../store/widgetSlice';
import { validateWidget } from '../utils/validation';
import { shouldRequireWidget, shouldShowWidget } from '../utils/conditions';


interface DialogTableWidgetProps {
  config: BaseWidgetConfig;
}

type DialogMode = 'add' | 'edit';

const isUnsetRowValue = (value: unknown): boolean =>
  value === null || value === undefined || value === '';

/** Stable dialog field renderer — avoids remount/re-fetch loops from inline config objects. */
const DialogTableField = React.memo(function DialogTableField({
  col,
  cellWidgetId,
  initialValue,
  isReadonly,
  dialogScopeKey,
  dialogRowValues,
  onUpdateField,
}: {
  col: BaseWidgetConfig & { 'column-key'?: string };
  cellWidgetId: string;
  initialValue: unknown;
  isReadonly: boolean;
  dialogScopeKey: string;
  dialogRowValues: Record<string, unknown>;
  onUpdateField: (columnKey: string, value: unknown) => void;
}) {
  const columnKey = col['column-key'] || cellWidgetId;

  const fieldConfig = useMemo((): BaseWidgetConfig => {
    const rawOptions = col['widget-data-options'];
    let widgetDataOptions = rawOptions;
    if (rawOptions?.condition?.field) {
      widgetDataOptions = {
        ...rawOptions,
        condition: {
          ...rawOptions.condition,
          field: `${dialogScopeKey}-${rawOptions.condition.field}`,
        },
      };
    }

    return {
      ...col,
      widget: col.widget || 'text',
      'widget-type': col['widget-type'] || 'input',
      'widget-id': cellWidgetId,
      'widget-label': col['widget-label'],
      'widget-readonly': isReadonly || col['widget-readonly'] === true,
      'widget-data-path': undefined,
      'widget-data-default': initialValue,
      'widget-data-options': widgetDataOptions,
      'widget-required': shouldRequireWidget(
        col['widget-data-options'],
        dialogRowValues,
        col['widget-required'],
      ),
    };
  }, [col, cellWidgetId, initialValue, isReadonly, dialogScopeKey, dialogRowValues]);

  const handleValueChange = useCallback(
    (_widgetId: string, newValue: unknown) => {
      onUpdateField(columnKey, newValue);
    },
    [columnKey, onUpdateField]
  );

  return <WidgetRenderer config={fieldConfig} onValueChange={handleValueChange} />;
});

// Display select value label in view mode
const SelectDisplayValue = ({ config, value }: { config: BaseWidgetConfig; value: any }) => {
  const { dataSourceOptions, loading } = useBaseWidget({ config });

  if (loading) return <span>-</span>;
  if (value === null || value === undefined || value === '') return <span>-</span>;

  const selectedOption = dataSourceOptions.find(
    (option: any) => option.value === value || String(option.value) === String(value)
  );
  return <span>{selectedOption ? selectedOption.label : String(value)}</span>;
};

/**
 * Dialog table widget:
 * - Table displays a subset of columns (n out of x)
 * - Add/Edit happens in a modal dialog that shows ALL columns as a form
 *
 * Usage in schema:
 * {
 *   "widget": "dialog-table",
 *   "widget-type": "table",
 *   "widget-label": "Household Members",
 *   "widget-id": "householdMembers",
 *   "widget-data-path": "household.members",
 *   "widget-data-columns": [ ...all columns... ],
 *   "widget-data-visible-columns": ["firstName", "lastName", "dob"], // optional override; default = by column flag
 *   // Per-column control (recommended): set "column-visible-in-table": false to hide it in the table
 *   "widget-data-operations": { "add": true, "edit": true, "remove": true }
 * }
 */
export const DialogTableWidget = ({ config }: DialogTableWidgetProps) => {
  const { value, error, touched, isEnabled, onChange, config: widgetConfig } = useBaseWidget({ config });
  const { translate, translateConfig } = useWidgetTranslation();
  const dispatch = useDispatch();

  const rows: any[] = Array.isArray(value) ? value : [];
  const columns: any[] = widgetConfig['widget-data-columns'] || [];
  const operations = widgetConfig['widget-data-operations'] || {};
  const isReadonly = widgetConfig['widget-readonly'] || false;

  const visibleColumnKeys: string[] | undefined = widgetConfig['widget-data-visible-columns'];
  const visibleColumns = useMemo(() => {
    // 1) If explicit list provided, it wins
    if (Array.isArray(visibleColumnKeys) && visibleColumnKeys.length > 0) {
      const keySet = new Set(visibleColumnKeys);
      return columns.filter((c) => keySet.has(c['column-key']));
    }

    // 2) Otherwise decide per column (default = visible)
    return columns.filter((c) => c['column-visible-in-table'] !== false);
  }, [columns, visibleColumnKeys]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>('add');
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  /** Unique per dialog open so Redux widget ids don't reuse stale values across rows/add sessions */
  const dialogSessionRef = useRef(0);
  const [dialogSessionId, setDialogSessionId] = useState(0);

  const addDialogTitle =
    translateConfig(widgetConfig['widget-data-dialog-title-add']) ||
    translate('table.addRecordDialog') ||
    'Add record';
  const editDialogTitle =
    translateConfig(widgetConfig['widget-data-dialog-title-edit']) ||
    translate('table.editRecordDialog') ||
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
    (columnKey: string) => `${widgetConfig['widget-id']}-dlg-${dialogSessionId}-${columnKey}`,
    [widgetConfig, dialogSessionId]
  );

  const resetDialogWidgets = useCallback(
    (sessionId: number) => {
      if (sessionId <= 0) return;
      columns.forEach((col) => {
        const wid = `${widgetConfig['widget-id']}-dlg-${sessionId}-${col['column-key']}`;
        dispatch(resetWidget(wid));
      });
    },
    [columns, widgetConfig, dispatch]
  );

  const beginDialogSession = useCallback(() => {
    dialogSessionRef.current += 1;
    const nextSession = dialogSessionRef.current;
    setDialogSessionId(nextSession);
    return nextSession;
  }, []);

  const openAddDialog = useCallback(() => {
    resetDialogWidgets(dialogSessionId);
    beginDialogSession();
    setDialogMode('add');
    setActiveRowIndex(null);
    setFormData(buildEmptyRow());
    setDialogOpen(true);
  }, [buildEmptyRow, beginDialogSession, resetDialogWidgets, dialogSessionId]);

  const openEditDialog = useCallback(
    (rowIndex: number) => {
      resetDialogWidgets(dialogSessionId);
      beginDialogSession();
      const row = rows[rowIndex] || {};
      const nextFormData: Record<string, any> = buildEmptyRow();
      columns.forEach((col) => {
        const key = col['column-key'];
        if (row[key] !== undefined) nextFormData[key] = row[key];
      });
      setDialogMode('edit');
      setActiveRowIndex(rowIndex);
      setFormData(nextFormData);
      setDialogOpen(true);
    },
    [rows, columns, buildEmptyRow, resetDialogWidgets, dialogSessionId, beginDialogSession]
  );

  const closeDialog = useCallback(() => {
    const sessionToClear = dialogSessionId;
    setDialogOpen(false);
    setActiveRowIndex(null);
    setFormData({});
    resetDialogWidgets(sessionToClear);
    setDialogSessionId(0);
  }, [dialogSessionId, resetDialogWidgets]);

  const updateField = useCallback((columnKey: string, newValue: unknown) => {
    setFormData((prev) => ({ ...prev, [columnKey]: newValue }));
  }, []);

  const membersWidgetId = widgetConfig['widget-id'];

  const dialogStoreValues = useSelector((state: WidgetRootState) => {
    if (dialogSessionId <= 0) {
      return {} as Record<string, any>;
    }
    const values = state.widget?.values ?? {};
    const row: Record<string, any> = {};
    columns.forEach((col) => {
      const k = col['column-key'];
      const wid = `${membersWidgetId}-dlg-${dialogSessionId}-${k}`;
      if (values[wid] !== undefined) {
        row[k] = values[wid];
      }
    });
    return row;
  }, (a, b) => JSON.stringify(a) === JSON.stringify(b));

  const buildDialogRowValues = useCallback(
    (storeSlice: Record<string, any>) => {
      const row: Record<string, any> = { ...formData };
      columns.forEach((col) => {
        const k = col['column-key'];
        if (storeSlice[k] !== undefined) {
          row[k] = storeSlice[k];
        }
      });
      return row;
    },
    [formData, columns],
  );

  const dialogRowValues = useMemo(
    () => buildDialogRowValues(dialogStoreValues),
    [buildDialogRowValues, dialogStoreValues],
  );

  const collectMergedRowPayload = useCallback(
    () => buildDialogRowValues(dialogStoreValues),
    [buildDialogRowValues, dialogStoreValues],
  );

  const finalizeDialogRowPayload = useCallback(
    (raw: Record<string, any>) => {
      const result: Record<string, any> = {};
      columns.forEach((col) => {
        const key = col['column-key'];
        if (!shouldShowWidget(col['widget-data-options'], raw)) {
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
    let hasErrors = false;

    columns.forEach((col) => {
      const key = col['column-key'];
      const cellWidgetId = dialogFieldWidgetId(key);
      const isColReadonly = isReadonly || col['widget-readonly'] === true;

      if (isColReadonly) return;
      if (!shouldShowWidget(col['widget-data-options'], payload)) return;

      const cellValue = payload[key];
      const isRequired = shouldRequireWidget(
        col['widget-data-options'],
        payload,
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
  }, [collectMergedRowPayload, finalizeDialogRowPayload, dialogMode, onChange, rows, closeDialog, activeRowIndex, columns, dialogFieldWidgetId, isReadonly, dispatch]);

  const deleteRow = useCallback(
    (rowIndex: number) => {
      const newRows = rows.filter((_, i) => i !== rowIndex);
      onChange(newRows);
    },
    [rows, onChange]
  );

  const getDisplayValue = useCallback((rowIndex: number, column: any) => {
    const key = column['column-key'];
    const cellValue = rows[rowIndex]?.[key];
    const widgetType = column.widget || 'text';

    if (cellValue === null || cellValue === undefined || cellValue === '') return '-';
    if (widgetType === 'select') return null; // handled by SelectDisplayValue
    if (column['widget-data-format']) return formatValue(cellValue, column['widget-data-format'], column.widget);
    return String(cellValue);
  }, [rows]);

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
        {/* Header actions */}
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
              {translate('table.addRecord') || 'Add New Record'}
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
                    {translateConfig(col['widget-label'])}
                  </th>
                ))}
                {((operations.edit || operations.remove) && !isReadonly) && (
                  <th
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                    style={{ color: 'var(--owt-widget-table-header-color, #727474)' }}
                  >
                    {translate('common.actions') || 'Actions'}
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
                    {translate('table.noData') || 'No records available.'}
                    {operations.add && !isReadonly && ` ${translate('table.clickToAdd') || 'Click "Add New Record" to add one.'}`}
                  </td>
                </tr>
              )}

              {rows.map((row, rowIndex) => (
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
                          <div className="text-sm">
                            <SelectDisplayValue config={displayConfig} value={row?.[key]} />
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td key={key} className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm">{displayValue}</div>
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
                            {translate('common.edit') || 'Edit'}
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
                            {translate('common.remove') || 'Delete'}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {touched && error.length > 0 && (
          <p className="text-sm mt-1" style={{ color: 'var(--owt-widget-error-color, #B91C1C)' }}>
            {error[0]}
          </p>
        )}
      </div>

      {/* Dialog */}
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
              {columns.map((col) => {
                const key = col['column-key'];
                if (!shouldShowWidget(col['widget-data-options'], dialogRowValues)) {
                  return null;
                }
                const cellWidgetId = dialogFieldWidgetId(key);
                const initialValue = formData[key] ?? col['widget-data-default'];
                const dialogScopeKey = `${widgetConfig['widget-id']}-dlg-${dialogSessionId}`;

                return (
                  <div key={`${dialogSessionId}-${key}`} className="min-w-0">
                    <DialogTableField
                      col={col}
                      cellWidgetId={cellWidgetId}
                      initialValue={initialValue}
                      isReadonly={isReadonly}
                      dialogScopeKey={dialogScopeKey}
                      dialogRowValues={dialogRowValues}
                      onUpdateField={updateField}
                    />
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
                {translate('common.cancel') || 'Cancel'}
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
                {translate('common.save') || 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

