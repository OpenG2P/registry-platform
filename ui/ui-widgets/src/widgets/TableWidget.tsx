import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { tSchema } from '../utils/tSchema';
import { useDispatch, useSelector } from 'react-redux';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { WidgetRenderer } from '../components/WidgetRenderer';
import { useWidgetContext } from '../components/WidgetProvider';
import { formatValue } from '../utils/formatting';
import { getValueByPath } from '../utils/pathUtils';
import {
  getMinDate,
  getMaxDate,
  validateDateConstraints,
  resolveDateBoundFromFieldValue,
  mergeMinDateBounds,
  mergeMaxDateBounds,
} from '../utils/dateInput';
import { setValue, resetWidget } from '../store/widgetSlice';
import { WidgetRootState } from '../store';
import { validateWidget } from '../utils/validation';

type ResolveSchemaLabelFn = (value: string | undefined | null) => string;

const getDateColumnConstraintError = (
  column: BaseWidgetConfig,
  cellValue: unknown,
  rowValues: Record<string, any>,
  resolveSchemaLabel: ResolveSchemaLabelFn,
): string | null => {
  const displayValue =
    cellValue && typeof cellValue === 'string' ? cellValue.split('T')[0] : '';
  if (!displayValue) {
    return null;
  }

  const optionsConfig = column['widget-data-options'];
  const formatConfig = column['widget-data-format'];
  const dateConstraint = formatConfig?.dateConstraint || 'any';
  const minDate = optionsConfig?.minDate;
  const maxDate = optionsConfig?.maxDate;
  const minDateField = optionsConfig?.minDateField as string | undefined;
  const maxDateField = optionsConfig?.maxDateField as string | undefined;
  const minDateMessage = optionsConfig?.minDateMessage
    ? resolveSchemaLabel(optionsConfig.minDateMessage)
    : undefined;
  const maxDateMessage = optionsConfig?.maxDateMessage
    ? resolveSchemaLabel(optionsConfig.maxDateMessage)
    : undefined;

  const resolveSiblingDate = (fieldRef: string | undefined): string | undefined => {
    if (!fieldRef) {
      return undefined;
    }
    const raw = getValueByPath(rowValues, fieldRef) ?? rowValues[fieldRef];
    return resolveDateBoundFromFieldValue(raw);
  };

  const effectiveMinDate = mergeMinDateBounds(
    getMinDate(dateConstraint, minDate),
    resolveSiblingDate(minDateField)
  );
  const effectiveMaxDate = mergeMaxDateBounds(
    getMaxDate(dateConstraint, maxDate),
    resolveSiblingDate(maxDateField)
  );

  return validateDateConstraints(
    displayValue,
    effectiveMinDate,
    effectiveMaxDate,
    dateConstraint,
    { minDateMessage, maxDateMessage }
  );
};

const isTableRowDataValid = (
  rowData: Record<string, any>,
  columns: any[],
  tableReadonly: boolean,
  resolveSchemaLabel: ResolveSchemaLabelFn,
): boolean => {
  for (const col of columns) {
    if (tableReadonly || col['widget-readonly'] === true) {
      continue;
    }

    const columnKey = col['column-key'];
    const cellValue = rowData[columnKey];
    const widgetErrors = validateWidget(
      cellValue,
      col['widget-data-validation'],
      col['widget-required']
    );
    if (widgetErrors.length > 0) {
      return false;
    }

    if ((col.widget || 'text') === 'date') {
      const dateError = getDateColumnConstraintError(col, cellValue, rowData, resolveSchemaLabel);
      if (dateError) {
        return false;
      }
    }
  }

  return true;
};


interface TableCellSelectProps {
  config: BaseWidgetConfig;
  value: any;
  onValueChange: (value: any) => void;
}

const TableCellSelect = ({ config, value, onValueChange }: TableCellSelectProps) => {
  const { t } = useWidgetContext();
  const {
    dataSourceOptions,
    loading,
  } = useBaseWidget({ config });
  const isReadonly = config['widget-readonly'] || false;

  return (
    <div className="table-cell-field w-full">
      <select
        value={value || ''}
        onChange={(e) => onValueChange(e.target.value === '' ? undefined : e.target.value)}
        disabled={isReadonly || loading}
        className={`w-full h-[28px] px-2 text-sm border focus:outline-none ${
          isReadonly || loading ? 'cursor-not-allowed' : ''
        } table-cell-input`}
        style={{
          borderRadius: '10px',
          borderColor: 'var(--owt-widget-input-border, #C4C4C4)',
          backgroundColor: isReadonly || loading ? 'var(--owt-color-bg-alt, #F6F6F6)' : 'var(--owt-color-bg, #FFFFFF)',
        }}
      >
        <option value="">{t?.('common.select') || 'Select'}</option>
        {dataSourceOptions.map((option: any) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <p className="table-cell-field-error" aria-hidden="true">
        {'\u00a0'}
      </p>
    </div>
  );
};

interface SelectDisplayValueProps {
  config: BaseWidgetConfig;
  value: any;
}

const SelectDisplayValue = ({ config, value }: SelectDisplayValueProps) => {
  const { dataSourceOptions, loading } = useBaseWidget({ config });
  
  if (loading) {
    return <span>-</span>;
  }
  
  if (value === null || value === undefined || value === '') {
    return <span>-</span>;
  }
  
  const selectedOption = dataSourceOptions.find(
    (option: any) => option.value === value || String(option.value) === String(value)
  );
  return <span>{selectedOption ? selectedOption.label : String(value)}</span>;
};

interface TableCellTextProps {
  config: BaseWidgetConfig;
  value: any;
  onValueChange: (value: any) => void;
}

const TableCellText = ({ config, value, onValueChange }: TableCellTextProps) => {
  const isReadonly = config['widget-readonly'] || false;
  const placeholder = config['widget-data-placeholder'] || '';
  const maxLength = config['widget-data-validation']?.maxLength;

  const displayValue = value !== null && value !== undefined ? String(value) : '';

  return (
    <div className="table-cell-field w-full">
      <input
        type="text"
        value={displayValue}
        onChange={(e) => onValueChange(e.target.value)}
        disabled={isReadonly}
        placeholder={placeholder}
        maxLength={maxLength}
        className={`w-full h-[28px] px-2 text-sm border focus:outline-none ${
          isReadonly ? 'cursor-not-allowed' : ''
        } table-cell-input`}
        style={{
          borderRadius: '10px',
          borderColor: 'var(--owt-widget-input-border, #C4C4C4)',
          backgroundColor: isReadonly ? 'var(--owt-color-bg-alt, #F6F6F6)' : 'var(--owt-color-bg, #FFFFFF)',
        }}
      />
      <p className="table-cell-field-error" aria-hidden="true">
        {'\u00a0'}
      </p>
    </div>
  );
};

interface TableCellNumberProps {
  config: BaseWidgetConfig;
  value: any;
  onValueChange: (value: any) => void;
}

const TableCellNumber = ({ config, value, onValueChange }: TableCellNumberProps) => {
  const isReadonly = config['widget-readonly'] || false;
  const placeholder = config['widget-data-placeholder'] || '';
  const formatConfig = config['widget-data-format'];
  const validationConfig = config['widget-data-validation'];

  const displayValue = value !== null && value !== undefined ? String(value) : '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    if (inputValue === '') {
      onValueChange('');
      return;
    }
    const numValue = parseFloat(inputValue);
    if (!isNaN(numValue)) {
      onValueChange(numValue);
    } else {
      onValueChange(inputValue);
    }
  };

  return (
    <div className="table-cell-field w-full">
      <input
        type="number"
        value={displayValue}
        onChange={handleChange}
        disabled={isReadonly}
        placeholder={placeholder}
        min={validationConfig?.min}
        max={validationConfig?.max}
        step={formatConfig?.decimalPlaces ? Math.pow(0.1, formatConfig.decimalPlaces) : undefined}
        className={`w-full h-[28px] px-2 text-sm border focus:outline-none text-right ${
          isReadonly ? 'cursor-not-allowed' : ''
        } table-cell-input`}
        style={{
          borderRadius: '10px',
          borderColor: 'var(--owt-widget-input-border, #C4C4C4)',
          backgroundColor: isReadonly ? 'var(--owt-color-bg-alt, #F6F6F6)' : 'var(--owt-color-bg, #FFFFFF)',
        }}
      />
      <p className="table-cell-field-error" aria-hidden="true">
        {'\u00a0'}
      </p>
    </div>
  );
};

interface TableCellDateProps {
  config: BaseWidgetConfig;
  value: any;
  rowValues?: Record<string, any>;
  onValueChange: (value: any) => void;
}

const TableCellDate = ({ config, value, rowValues, onValueChange }: TableCellDateProps) => {
  const { t } = useWidgetContext();
  const isReadonly = config['widget-readonly'] || false;
  const placeholder = config['widget-data-placeholder'] || '';
  const optionsConfig = config['widget-data-options'];
  const formatConfig = config['widget-data-format'];
  const dateConstraint = formatConfig?.dateConstraint || 'any';
  const minDate = optionsConfig?.minDate;
  const maxDate = optionsConfig?.maxDate;
  const minDateField = optionsConfig?.minDateField as string | undefined;
  const maxDateField = optionsConfig?.maxDateField as string | undefined;
  const minDateMessage = optionsConfig?.minDateMessage
    ? tSchema(t, optionsConfig.minDateMessage)
    : undefined;
  const maxDateMessage = optionsConfig?.maxDateMessage
    ? tSchema(t, optionsConfig.maxDateMessage)
    : undefined;

  const [constraintError, setConstraintError] = useState<string | null>(null);

  const resolveSiblingDate = (fieldRef: string | undefined): string | undefined => {
    if (!fieldRef || !rowValues) {
      return undefined;
    }
    const raw = getValueByPath(rowValues, fieldRef) ?? rowValues[fieldRef];
    return resolveDateBoundFromFieldValue(raw);
  };

  const fieldMinDate = useMemo(
    () => resolveSiblingDate(minDateField),
    [minDateField, rowValues]
  );
  const fieldMaxDate = useMemo(
    () => resolveSiblingDate(maxDateField),
    [maxDateField, rowValues]
  );

  const effectiveMinDate = useMemo(() => {
    const staticMin = getMinDate(dateConstraint, minDate);
    return mergeMinDateBounds(staticMin, fieldMinDate);
  }, [dateConstraint, minDate, fieldMinDate]);

  const effectiveMaxDate = useMemo(() => {
    const staticMax = getMaxDate(dateConstraint, maxDate);
    return mergeMaxDateBounds(staticMax, fieldMaxDate);
  }, [dateConstraint, maxDate, fieldMaxDate]);

  const constraintMessages = useMemo(
    () => ({ minDateMessage, maxDateMessage }),
    [minDateMessage, maxDateMessage]
  );

  const displayValue = value && typeof value === 'string' ? value.split('T')[0] : '';

  useEffect(() => {
    if (!displayValue) {
      setConstraintError(null);
      return;
    }
    const error = validateDateConstraints(
      displayValue,
      effectiveMinDate,
      effectiveMaxDate,
      dateConstraint,
      constraintMessages
    );
    setConstraintError(error);
  }, [displayValue, effectiveMinDate, effectiveMaxDate, dateConstraint, constraintMessages]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = e.target.value;
    onValueChange(nextValue);
    if (!nextValue) {
      setConstraintError(null);
      return;
    }
    const error = validateDateConstraints(
      nextValue,
      effectiveMinDate,
      effectiveMaxDate,
      dateConstraint,
      constraintMessages
    );
    setConstraintError(error);
  };

  const hasError = Boolean(constraintError);

  return (
    <div className="table-cell-field w-full">
      <input
        type="date"
        value={displayValue}
        onChange={handleChange}
        disabled={isReadonly}
        placeholder={placeholder}
        min={effectiveMinDate}
        max={effectiveMaxDate}
        title={constraintError || tSchema(t, config['widget-data-tooltip'])}
        className={`w-full h-[28px] px-2 text-sm border focus:outline-none ${
          isReadonly ? 'cursor-not-allowed' : ''
        } table-cell-input`}
        style={{
          borderRadius: '10px',
          borderColor: hasError
            ? 'var(--owt-color-error, #B91C1C)'
            : 'var(--owt-widget-input-border, #C4C4C4)',
          backgroundColor: isReadonly ? 'var(--owt-color-bg-alt, #F6F6F6)' : 'var(--owt-color-bg, #FFFFFF)',
        }}
      />
      <p
        className="table-cell-field-error text-xs mt-0.5 leading-tight"
        style={{
          color: hasError ? 'var(--owt-color-error, #B91C1C)' : 'transparent',
        }}
        aria-live="polite"
      >
        {constraintError ?? '\u00a0'}
      </p>
    </div>
  );
};

interface TableWidgetProps {
  config: BaseWidgetConfig;
}

interface EditingState {
  rowIndex: number;
  originalValue: any;
  currentValue: any;
}

interface ConfirmationState {
  show: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const TableWidget = ({ config }: TableWidgetProps) => {
  const {
    value,
    error,
    touched,
    isEnabled,
    onChange,
    config: widgetConfig,
  } = useBaseWidget({ config });

  const { t } = useWidgetContext();
  const resolveSchemaLabel = useCallback(
    (value: string | undefined | null) =>
      value ? tSchema(t, value) : '',
    [t],
  );
  const { dataSourceRequestHandler } = useWidgetContext();
  const dispatch = useDispatch();
  const storeValues = useSelector((state: WidgetRootState) => state.widget?.values || {});

  const rows: any[] = Array.isArray(value) ? value : [];
  const columns = widgetConfig['widget-data-columns'] || [];
  const operations = widgetConfig['widget-data-operations'] || {};
  const apiConfig = widgetConfig['widget-data-api'] || {};
  const isReadonly = widgetConfig['widget-readonly'] || false;

  const [editingState, setEditingState] = useState<EditingState | null>(null);
  const [loadingRowIndex, setLoadingRowIndex] = useState<number | null>(null);
  const [confirmationState, setConfirmationState] = useState<ConfirmationState | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newRowData, setNewRowData] = useState<any>(null);
  const [originalRows, setOriginalRows] = useState<any[] | null>(null);

  const isSectionEditMode = !isReadonly && operations.edit;
  
  const isAnyRowEditing = editingState !== null || isAdding;

  const resolveEditingRowData = useCallback(() => {
    if (!editingState) return null;
    const row: Record<string, any> = { ...editingState.currentValue };
    columns.forEach((col) => {
      const key = col['column-key'];
      const cellWidgetId = `${widgetConfig['widget-id']}-row-${editingState.rowIndex}-col-${key}`;
      if (storeValues[cellWidgetId] !== undefined) {
        row[key] = storeValues[cellWidgetId];
      }
    });
    return row;
  }, [editingState, columns, widgetConfig, storeValues]);

  const resolveNewRowData = useCallback(() => {
    if (!isAdding || !newRowData) return null;
    const row: Record<string, any> = { ...newRowData };
    columns.forEach((col) => {
      const key = col['column-key'];
      const cellWidgetId = `${widgetConfig['widget-id']}-row-${rows.length}-col-${key}`;
      if (storeValues[cellWidgetId] !== undefined) {
        row[key] = storeValues[cellWidgetId];
      }
    });
    return row;
  }, [isAdding, newRowData, columns, widgetConfig, rows.length, storeValues]);

  const canSaveEditingRow = useMemo(() => {
    const rowData = resolveEditingRowData();
    if (!rowData) {
      return false;
    }
    return isTableRowDataValid(
      rowData,
      columns,
      isReadonly,
      resolveSchemaLabel,
    );
  }, [resolveEditingRowData, columns, isReadonly, resolveSchemaLabel]);

  const canSaveNewRow = useMemo(() => {
    const rowData = resolveNewRowData();
    if (!rowData) {
      return false;
    }
    return isTableRowDataValid(rowData, columns, isReadonly, resolveSchemaLabel);
  }, [resolveNewRowData, columns, isReadonly, resolveSchemaLabel]);

  const showConfirmation = useCallback((message: string, onConfirm: () => void, onCancel: () => void) => {
    setConfirmationState({
      show: true,
      message,
      onConfirm: () => {
        setConfirmationState(null);
        onConfirm();
      },
      onCancel: () => {
        setConfirmationState(null);
        onCancel();
      },
    });
  }, []);

  const cancelEdit = useCallback(() => {
    if (editingState) {
      const newRows = [...rows];
      newRows[editingState.rowIndex] = editingState.originalValue;
      onChange(newRows);
      
      columns.forEach((col) => {
        const cellWidgetId = `${widgetConfig['widget-id']}-row-${editingState.rowIndex}-col-${col['column-key']}`;
        dispatch(resetWidget(cellWidgetId));
      });
    }
    if (isAdding) {
      columns.forEach((col) => {
        const cellWidgetId = `${widgetConfig['widget-id']}-row-${rows.length}-col-${col['column-key']}`;
        dispatch(resetWidget(cellWidgetId));
      });
    }
    setEditingState(null);
    setIsAdding(false);
    setNewRowData(null);
  }, [editingState, rows, onChange, columns, widgetConfig, isAdding, dispatch]);

  const startEdit = useCallback((rowIndex: number) => {
    if (isAnyRowEditing) {
      showConfirmation(
        t?.('table.unsavedChanges') || 'You have unsaved changes. Do you want to discard them?',
        () => {
          cancelEdit();
          const row = rows[rowIndex];
          setEditingState({
            rowIndex,
            originalValue: { ...row },
            currentValue: { ...row },
          });
        },
        () => {
        }
      );
    } else {
      const row = rows[rowIndex];
      setEditingState({
        rowIndex,
        originalValue: { ...row },
        currentValue: { ...row },
      });
    }
  }, [isAnyRowEditing, rows, showConfirmation, cancelEdit, t]);

  const updateCellValue = useCallback((columnKey: string, newValue: any, rowIndex?: number) => {
    if (editingState && rowIndex !== undefined) {
      setEditingState((prev) => {
        if (!prev || prev.rowIndex !== rowIndex) return prev;
        return {
          ...prev,
          currentValue: {
            ...prev.currentValue,
            [columnKey]: newValue,
          },
        };
      });

      const cellWidgetId = `${widgetConfig['widget-id']}-row-${rowIndex}-col-${columnKey}`;
      dispatch(setValue({ widgetId: cellWidgetId, value: newValue }));
    } else if (isAdding) {
      setNewRowData((prev: Record<string, any> | null) => {
        if (!prev) return prev;
        return {
          ...prev,
          [columnKey]: newValue,
        };
      });

      if (rowIndex !== undefined) {
        const cellWidgetId = `${widgetConfig['widget-id']}-row-${rowIndex}-col-${columnKey}`;
        dispatch(setValue({ widgetId: cellWidgetId, value: newValue }));
      }
    }
  }, [editingState, isAdding, widgetConfig, dispatch]);

  const saveEdit = useCallback(async () => {
    const rowData = resolveEditingRowData();
    if (!editingState || !rowData) return;
    if (!canSaveEditingRow) return;

    const rowIndex = editingState.rowIndex;
    setLoadingRowIndex(rowIndex);

    try {
      // TODO: Update to use dataSourceRequestHandler pattern
      if (dataSourceRequestHandler && apiConfig.edit) {
        console.warn('[TableWidget] API edit operations require migration to dataSourceRequestHandler pattern');
      }

      const newRows = [...rows];
      const currentRow = newRows[rowIndex] || {};
      const wasDeleted = currentRow.edit_action === 'DELETE';
      
      let editAction = currentRow.edit_action;
      if (isSectionEditMode) {
        if (wasDeleted) {
          if (originalRows) {
            const rowId = rowData.id;
            const existsInOriginal = rowId !== undefined
              ? originalRows.some(or => or.id === rowId)
              : rowIndex < originalRows.length;
            
            editAction = existsInOriginal ? 'UPDATE' : 'ADD';
          } else {
            editAction = 'UPDATE';
          }
        } else if (!editAction && originalRows) {
          const rowId = rowData.id;
          const existsInOriginal = rowId !== undefined
            ? originalRows.some(or => or.id === rowId)
            : rowIndex < originalRows.length;
          
          editAction = existsInOriginal ? 'UPDATE' : 'ADD';
        } else if (!editAction) {
          editAction = 'UPDATE';
        }
      } else {
        if (!editAction && !wasDeleted) {
          editAction = 'UPDATE';
        }
      }
      
      newRows[rowIndex] = {
        ...rowData,
        ...(editAction ? { edit_action: editAction } : {}),
      };
      onChange(newRows);

      columns.forEach((col) => {
        const cellWidgetId = `${widgetConfig['widget-id']}-row-${rowIndex}-col-${col['column-key']}`;
        dispatch(resetWidget(cellWidgetId));
      });
      
      setEditingState(null);
    } catch (error) {
      console.error('Error saving record:', error);
      alert(t?.('table.saveError') || 'Failed to save record. Please try again.');
    } finally {
      setLoadingRowIndex(null);
    }
  }, [editingState, canSaveEditingRow, resolveEditingRowData, rows, onChange, dataSourceRequestHandler, apiConfig, t, isSectionEditMode, originalRows, columns, widgetConfig, dispatch]);

  const startAdd = useCallback(() => {
    if (isAnyRowEditing) {
      cancelEdit();
    }
    const emptyRow: any = {};
    columns.forEach((col) => {
      emptyRow[col['column-key']] = col['widget-data-default'] || '';
    });
    setIsAdding(true);
    setNewRowData(emptyRow);
  }, [isAnyRowEditing, columns, cancelEdit]);

  const saveAdd = useCallback(async () => {
    const rowData = resolveNewRowData();
    if (!isAdding || !rowData) return;
    if (!canSaveNewRow) return;

    setLoadingRowIndex(-1);

    try {
      let savedRow = { ...rowData };

      if (dataSourceRequestHandler && apiConfig.add) {
        console.warn('[TableWidget] API add operations require migration to dataSourceRequestHandler pattern');
        if (rowData && typeof rowData === 'object') {
          savedRow = { ...savedRow, ...rowData };
        }
      }

      savedRow = { ...savedRow, edit_action: 'ADD' };

      onChange([...rows, savedRow]);

      columns.forEach((col) => {
        const cellWidgetId = `${widgetConfig['widget-id']}-row-${rows.length}-col-${col['column-key']}`;
        dispatch(resetWidget(cellWidgetId));
      });

      setIsAdding(false);
      setNewRowData(null);
    } catch (error) {
      console.error('Error adding record:', error);
      alert(t?.('table.addError') || 'Failed to add record. Please try again.');
    } finally {
      setLoadingRowIndex(null);
    }
  }, [isAdding, resolveNewRowData, canSaveNewRow, rows, onChange, dataSourceRequestHandler, apiConfig, t, columns, widgetConfig, dispatch]);

  const deleteRow = useCallback(async (rowIndex: number) => {
    if (isAnyRowEditing) {
      showConfirmation(
        t?.('table.unsavedChanges') || 'You have unsaved changes. Do you want to discard them?',
        () => {
          cancelEdit();
          performDelete(rowIndex);
        },
        () => {
        }
      );
    } else {
      performDelete(rowIndex);
    }
  }, [isAnyRowEditing, showConfirmation, cancelEdit, t]);

  const performDelete = useCallback(async (rowIndex: number) => {
    setLoadingRowIndex(rowIndex);

    try {
      // TODO: Update to use dataSourceRequestHandler pattern
      if (dataSourceRequestHandler && apiConfig.delete) {
        console.warn('[TableWidget] API delete operations require migration to dataSourceRequestHandler pattern');
      }

      if (isSectionEditMode) {
        const newRows = [...rows];
        newRows[rowIndex] = {
          ...newRows[rowIndex],
          edit_action: 'DELETE',
        };
        onChange(newRows);
      } else {
        const newRows = rows.filter((_, i) => i !== rowIndex);
        onChange(newRows);
      }
    } catch (error) {
      console.error('Error deleting record:', error);
      alert(t?.('table.deleteError') || 'Failed to delete record. Please try again.');
    } finally {
      setLoadingRowIndex(null);
    }
  }, [rows, onChange, dataSourceRequestHandler, apiConfig, t, isSectionEditMode]);

  const getCellValue = useCallback((rowIndex: number, columnKey: string) => {
    if (editingState && editingState.rowIndex === rowIndex) {
      const cellWidgetId = `${widgetConfig['widget-id']}-row-${rowIndex}-col-${columnKey}`;
      const storeValue = storeValues[cellWidgetId];
      if (storeValue !== undefined) {
        return storeValue;
      }
      return editingState.currentValue[columnKey];
    }
    if (isAdding && rowIndex === rows.length) {
      const cellWidgetId = `${widgetConfig['widget-id']}-row-${rowIndex}-col-${columnKey}`;
      const storeValue = storeValues[cellWidgetId];
      if (storeValue !== undefined) {
        return storeValue;
      }
      return newRowData?.[columnKey];
    }
    return rows[rowIndex]?.[columnKey];
  }, [editingState, isAdding, rows, newRowData, widgetConfig, storeValues]);

  const getDisplayValue = useCallback((rowIndex: number, column: any) => {
    const columnKey = column['column-key'];
    const cellValue = getCellValue(rowIndex, columnKey);
    const widgetType = column.widget || 'text';
    
    if (cellValue === null || cellValue === undefined || cellValue === '') {
      return '-';
    }

    if (widgetType === 'select') {
      return null; // Will be handled by SelectDisplayValue component
    }

    if (widgetType === 'parent-lookup') {
      return null;
    }

    if (column['widget-data-format']) {
      return formatValue(cellValue, column['widget-data-format'], column.widget);
    }

    return cellValue?.toString() || '-';
  }, [getCellValue]);

  const isRowEditing = useCallback((rowIndex: number) => {
    return editingState?.rowIndex === rowIndex || (isAdding && rowIndex === rows.length);
  }, [editingState, isAdding, rows.length]);

  useEffect(() => {
    if (isSectionEditMode && originalRows === null) {
      setOriginalRows(JSON.parse(JSON.stringify(rows))); // Deep clone
    } else if (!isSectionEditMode && originalRows !== null) {
      setOriginalRows(null);
    }
  }, [isSectionEditMode, rows, originalRows]);

  const editSessionKey = editingState
    ? `edit-${editingState.rowIndex}`
    : isAdding
      ? `add-${rows.length}`
      : null;

  useEffect(() => {
    if (!editSessionKey) return;

    if (editingState) {
      columns.forEach((col) => {
        const columnKey = col['column-key'];
        const cellWidgetId = `${widgetConfig['widget-id']}-row-${editingState.rowIndex}-col-${columnKey}`;
        const cellValue = editingState.currentValue[columnKey];
        const defaultValue = cellValue !== undefined ? cellValue : (col['widget-data-default'] ?? '');
        dispatch(setValue({ widgetId: cellWidgetId, value: defaultValue }));
      });
      return;
    }

    if (isAdding && newRowData) {
      columns.forEach((col) => {
        const columnKey = col['column-key'];
        const cellWidgetId = `${widgetConfig['widget-id']}-row-${rows.length}-col-${columnKey}`;
        const cellValue = newRowData[columnKey];
        const defaultValue = cellValue !== undefined ? cellValue : (col['widget-data-default'] ?? '');
        dispatch(setValue({ widgetId: cellWidgetId, value: defaultValue }));
      });
    }
    // Seed only when add/edit session starts — not on every cell change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editSessionKey]);

  const getRowValuesForEdit = useCallback(
    (rowIndex: number): Record<string, any> => {
      if (editingState && editingState.rowIndex === rowIndex) {
        return editingState.currentValue ?? {};
      }
      if (isAdding && rowIndex === rows.length && newRowData) {
        return newRowData;
      }
      return rows[rowIndex] ?? {};
    },
    [editingState, isAdding, rows, newRowData]
  );

  const renderTableCell = useCallback((rowIndex: number, column: any, cellValue: any, isReadonly: boolean) => {
    const columnKey = column['column-key'];
    const widgetType = column.widget || 'text';
    const cellWidgetId = `${widgetConfig['widget-id']}-row-${rowIndex}-col-${columnKey}`;
    const rowValues = getRowValuesForEdit(rowIndex);
    
    const cellConfig: BaseWidgetConfig = {
      ...column,
      'widget-id': cellWidgetId,
      'widget-label': '', // No label in table cells
      'widget-readonly': isReadonly,
      'widget-data-path': undefined,
      'widget-data-default': cellValue !== undefined ? cellValue : (column['widget-data-default'] ?? ''),
      widget: widgetType,
      'widget-type': column['widget-type'] || 'input',
    };

    if (widgetType === 'select') {
      return <TableCellSelect 
        config={cellConfig} 
        value={cellValue}
        onValueChange={(newValue) => updateCellValue(columnKey, newValue, rowIndex)}
      />;
    } else if (widgetType === 'text') {
      return <TableCellText 
        config={cellConfig}
        value={cellValue}
        onValueChange={(newValue) => updateCellValue(columnKey, newValue, rowIndex)}
      />;
    } else if (widgetType === 'number') {
      return <TableCellNumber 
        config={cellConfig}
        value={cellValue}
        onValueChange={(newValue) => updateCellValue(columnKey, newValue, rowIndex)}
      />;
    } else if (widgetType === 'date') {
      return <TableCellDate
        config={cellConfig}
        value={cellValue}
        rowValues={rowValues}
        onValueChange={(newValue) => updateCellValue(columnKey, newValue, rowIndex)}
      />;
    }

    return (
      <div className="table-cell-widget" style={{ margin: 0, padding: 0 }}>
        <WidgetRenderer
          config={cellConfig}
          schemaData={{
            [cellWidgetId]: cellValue !== undefined ? cellValue : (column['widget-data-default'] ?? ''),
          }}
          onValueChange={(widgetId, newValue) => {
            updateCellValue(columnKey, newValue, rowIndex);
          }}
        />
      </div>
    );
  }, [widgetConfig, updateCellValue, getRowValuesForEdit]);

  const renderCell = useCallback((rowIndex: number, column: any, row: any) => {
    const columnKey = column['column-key'];
    const isEditing = isRowEditing(rowIndex);
    const cellValue = getCellValue(rowIndex, columnKey);
    const columnReadonly = column['widget-readonly'] === true;
    
    const getCellStyle = () => {
      if (isEditing) return {}; // No special styling when editing
      
      const editAction = row?.edit_action;
      if (editAction === 'ADD') {
        return { color: 'var(--owt-color-success, #16A34A)' };
      } else if (editAction === 'DELETE') {
        return { color: 'var(--owt-color-error, #B91C1C)', textDecoration: 'line-through' };
      } else if (editAction === 'UPDATE') {
        return { color: 'var(--owt-color-warning, #F59E0B)' };
      }
      return {};
    };
    
    if (isEditing) {
      return renderTableCell(rowIndex, column, cellValue, columnReadonly);
    } else {
      const widgetType = column.widget || 'text';
      const displayValue = getDisplayValue(rowIndex, column);
      
      if (widgetType === 'select' && displayValue === null) {
        const cellWidgetId = `${widgetConfig['widget-id']}-row-${rowIndex}-col-${columnKey}`;
        const cellConfig: BaseWidgetConfig = {
          ...column,
          'widget-id': cellWidgetId,
          'widget-label': '',
          'widget-readonly': true,
          'widget-data-path': undefined,
        };
        
        return (
          <div className="text-sm" style={getCellStyle()}>
            <SelectDisplayValue config={cellConfig} value={cellValue} />
          </div>
        );
      }

      if (widgetType === 'parent-lookup' && displayValue === null) {
        const cellWidgetId = `${widgetConfig['widget-id']}-row-${rowIndex}-col-${columnKey}`;
        const cellConfig: BaseWidgetConfig = {
          ...column,
          'widget-id': cellWidgetId,
          'widget-label': '',
          'widget-readonly': true,
          'widget-data-path': undefined,
          'widget-data-default': cellValue !== undefined ? cellValue : '',
        };

        return (
          <div className="text-sm table-cell-widget" style={getCellStyle()}>
            <WidgetRenderer
              config={cellConfig}
              schemaData={{
                [cellWidgetId]: cellValue !== undefined ? cellValue : '',
              }}
            />
          </div>
        );
      }
      
      return (
        <div className="text-sm" style={getCellStyle()}>
          {displayValue}
        </div>
      );
    }
  }, [isRowEditing, getCellValue, getDisplayValue, renderTableCell]);

  const tableWidgetId = `table-widget-${widgetConfig['widget-id']}`;
  const columnSpan = widgetConfig['widget-column-span'] || 2;
  const minWidth = columnSpan * 200; // Each column is 200px

  return (
    <>
      <style>{`
        /* Table widget styling - width based on column span */
        .${tableWidgetId} {
          width: 100%;
          min-width: ${minWidth}px;
        }
        
        /* Target the widget-container parent when it contains a table widget */
        .widget-container[data-widget-id="${widgetConfig['widget-id']}"] {
          min-width: ${minWidth}px;
          width: 100%;
          /* Remove flex properties to avoid height issues */
          flex: none;
        }
        
        /* In horizontal panels, make table widget span specified columns */
        .panel-horizontal .widget-container[data-widget-id="${widgetConfig['widget-id']}"],
        [data-panel-orientation="horizontal"] .widget-container[data-widget-id="${widgetConfig['widget-id']}"] {
          grid-column: span ${columnSpan};
        }
        
        /* When table is the only widget in horizontal panel, take full width */
        .panel-horizontal > div:only-child .widget-container[data-widget-id="${widgetConfig['widget-id']}"],
        [data-panel-orientation="horizontal"] > div:only-child .widget-container[data-widget-id="${widgetConfig['widget-id']}"] {
          grid-column: 1 / -1; /* Span all columns in grid */
          width: 100%;
          flex: 1 1 100%;
        }
        
        /* Compact styling for widgets inside table cells - hide labels and reduce margins */
        .${tableWidgetId} .table-cell-widget,
        .${tableWidgetId} .table-cell-widget * {
          margin: 0 !important;
          margin-bottom: 0 !important;
        }
        
        .${tableWidgetId} .table-cell-widget label,
        .${tableWidgetId} .table-cell-widget .text-base.font-medium {
          display: none !important;
        }
        
        .${tableWidgetId} .table-cell-widget .mb-\\[10px\\],
        .${tableWidgetId} .table-cell-widget .mb-4 {
          margin-bottom: 0 !important;
        }
        
        /* 10px border radius for all controls in table cells */
        .${tableWidgetId} input,
        .${tableWidgetId} select,
        .${tableWidgetId} textarea,
        .${tableWidgetId} button {
          border-radius: 10px !important;
        }
        /* Focus ring for table cell inputs */
        .${tableWidgetId} .table-cell-input:focus {
          box-shadow: 0 0 0 1px var(--owt-widget-input-focus-border, #F07B1A);
          border-color: var(--owt-widget-input-focus-border, #F07B1A);
        }

        /* Keep inputs and action buttons top-aligned when a cell shows validation text */
        .${tableWidgetId} tr.table-row-editing td {
          vertical-align: top;
        }

        .${tableWidgetId} .table-cell-field-error {
          min-height: 1.125rem;
        }

        .${tableWidgetId} .table-cell-actions {
          display: flex;
          flex-direction: row;
          gap: 0.5rem;
          align-items: flex-start;
        }
      `}</style>
      <div className={`table-widget-container ${tableWidgetId}`}>
      {confirmationState?.show && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-lg p-6 max-w-md w-full mx-4" style={{ backgroundColor: 'var(--owt-color-bg, #FFFFFF)' }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--owt-color-text, #011627)' }}>
              {t?.('table.confirm') || 'Confirm Action'}
            </h3>
            <p className="mb-6" style={{ color: 'var(--owt-color-text, #011627)' }}>
              {confirmationState.message}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={confirmationState.onCancel}
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
                onClick={confirmationState.onConfirm}
                className="px-4 py-2 text-sm font-medium"
                style={{
                  borderRadius: 'var(--owt-btn-border-radius, 10px)',
                  border: '1px solid var(--owt-btn-primary-border, #F07B1A)',
                  backgroundColor: 'var(--owt-color-primary, #F5BB1A)',
                  color: 'var(--owt-color-bg, #FFFFFF)',
                }}
              >
                {t?.('table.discard') || 'Discard & Continue'}
              </button>
            </div>
          </div>
        </div>
      )}
      {operations.add && !isReadonly && isEnabled && (isSectionEditMode || !isAnyRowEditing) && (
        <div className="flex justify-end mb-2">
          <button
            type="button"
            onClick={startAdd}
            disabled={loadingRowIndex !== null}
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

        <div className="overflow-x-auto border" style={{ borderRadius: 'var(--owt-widget-table-border-radius, 15px)', borderColor: 'var(--owt-widget-table-border-color, #C4C4C4)' }}>
          <table className="min-w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead style={{ backgroundColor: 'var(--owt-widget-table-header-bg, #F6F6F6)' }}>
              <tr style={{ borderBottom: '1px solid var(--owt-widget-table-row-divider, #E4E4E4)' }}>
                {columns.map((col) => (
                  <th
                    key={col['column-key']}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                    style={{ color: 'var(--owt-widget-table-header-color, #727474)' }}
                  >
                    {tSchema(t, col['column-label'] || col['widget-label'] || col['column-key'])}
                  </th>
                ))}
                {((operations.edit || operations.remove) && !isReadonly) || isAnyRowEditing || isSectionEditMode ? (
                  <th
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                    style={{ color: 'var(--owt-widget-table-header-color, #727474)' }}
                  >
                    {t?.('common.actions') || 'Actions'}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody style={{ backgroundColor: 'var(--owt-widget-table-body-bg, #FFFFFF)' }}>
              {rows.length === 0 && !isAdding && (
                <tr>
                  <td
                    colSpan={columns.length + (((operations.edit || operations.remove) && !isReadonly) || isSectionEditMode ? 1 : 0)}
                    className="px-4 py-6 text-center text-sm"
                    style={{ color: 'var(--owt-widget-table-empty-color, #727474)' }}
                  >
                    {t?.('table.noData') || 'No records available.'}
                    {operations.add && !isReadonly && ` ${t?.('table.clickToAdd') || 'Click "Add New Record" to add one.'}`}
                  </td>
                </tr>
              )}
              {rows.map((row, rowIndex) => {
                const isEditing = isRowEditing(rowIndex);
                const isLoading = loadingRowIndex === rowIndex;
                return (
                  <tr
                    key={rowIndex}
                    className={`${isLoading ? 'opacity-50' : ''}${isEditing ? ' table-row-editing' : ''}`}
                    style={{
                      borderBottom: '1px solid var(--owt-widget-table-row-divider, #E4E4E4)',
                      backgroundColor: isEditing
                        ? 'var(--owt-widget-table-editing-row-bg, #FBE6AA)'
                        : row.edit_action === 'DELETE'
                          ? 'var(--owt-widget-table-deleted-row-bg, #FEE2E2)'
                          : undefined,
                    }}
                  >
                    {columns.map((col) => {
                      return (
                        <td 
                          key={col['column-key']} 
                          className="px-4 py-3 whitespace-nowrap"
                        >
                          {renderCell(rowIndex, col, row)}
                        </td>
                      );
                    })}
                    {((operations.edit || operations.remove) && !isReadonly) || isEditing || isSectionEditMode ? (
                      <td className="px-4 py-3 whitespace-nowrap" style={{ minWidth: '120px' }}>
                        {isEditing ? (
                          <div className="table-cell-actions" style={{ width: '100%' }}>
                            <button
                              type="button"
                              onClick={saveEdit}
                              disabled={isLoading || !canSaveEditingRow}
                              className="px-3 py-1 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
                              style={{ 
                                display: 'inline-block', 
                                minWidth: '60px',
                                backgroundColor: 'var(--owt-color-success, #16A34A)',
                                color: 'var(--owt-color-bg, #FFFFFF)',
                                border: 'none',
                                borderRadius: 'var(--owt-btn-border-radius, 10px)',
                              }}
                            >
                              {t?.('common.ok') || 'OK'}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={isLoading}
                              className="px-3 py-1 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
                              style={{
                                display: 'inline-block',
                                minWidth: '60px',
                                borderRadius: 'var(--owt-btn-border-radius, 10px)',
                                border: '1px solid var(--owt-btn-secondary-border, #C4C4C4)',
                                backgroundColor: 'var(--owt-btn-secondary-bg, #FFFFFF)',
                                color: 'var(--owt-btn-secondary-color, #011627)',
                              }}
                            >
                              {t?.('common.cancel') || 'Cancel'}
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            {operations.edit && (
                              <button
                                type="button"
                                onClick={() => startEdit(rowIndex)}
                                disabled={isAnyRowEditing || isLoading}
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
                                disabled={isAnyRowEditing || isLoading}
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
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
              {isAdding && newRowData && (
                <tr
                  className="table-row-editing"
                  style={{ backgroundColor: 'var(--owt-widget-table-editing-row-bg, #FBE6AA)' }}
                >
                  {columns.map((col) => (
                    <td key={col['column-key']} className="px-4 py-3 whitespace-nowrap">
                      {renderCell(rows.length, col, { ...newRowData, edit_action: 'ADD' })}
                    </td>
                  ))}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="table-cell-actions">
                      <button
                        type="button"
                        onClick={saveAdd}
                        disabled={loadingRowIndex === -1 || !canSaveNewRow}
                        className="px-3 py-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          borderRadius: 'var(--owt-btn-border-radius, 10px)',
                          backgroundColor: 'var(--owt-color-success, #16A34A)',
                          color: 'var(--owt-color-bg, #FFFFFF)',
                          border: 'none',
                        }}
                      >
                        {t?.('common.save') || 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAdding(false);
                          setNewRowData(null);
                        }}
                        disabled={loadingRowIndex === -1}
                        className="px-3 py-1 text-xs disabled:opacity-50"
                        style={{
                          borderRadius: 'var(--owt-btn-border-radius, 10px)',
                          border: '1px solid var(--owt-btn-secondary-border, #C4C4C4)',
                          backgroundColor: 'var(--owt-btn-secondary-bg, #FFFFFF)',
                          color: 'var(--owt-btn-secondary-color, #011627)',
                        }}
                      >
                        {t?.('common.cancel') || 'Cancel'}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      {touched && error.length > 0 && (
        <p className="text-sm mt-1" style={{ color: 'var(--owt-widget-error-color, #B91C1C)' }}>{error[0]}</p>
      )}
      
      </div>
    </>
  );
};
