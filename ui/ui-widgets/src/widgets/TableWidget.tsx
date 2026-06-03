import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { WidgetRenderer } from '../components/WidgetRenderer';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';
import { useWidgetContext } from '../components/WidgetProvider';
import { formatValue } from '../utils/formatting';
import { getValueByPath, setValueByPath } from '../utils/pathUtils';
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

type TranslateConfigFn = (
  value: string | undefined | null,
  fallback?: string
) => string;

const getDateColumnConstraintError = (
  column: BaseWidgetConfig,
  cellValue: unknown,
  rowValues: Record<string, any>,
  translateConfig: TranslateConfigFn
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
    ? translateConfig(optionsConfig.minDateMessage)
    : undefined;
  const maxDateMessage = optionsConfig?.maxDateMessage
    ? translateConfig(optionsConfig.maxDateMessage)
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
  translateConfig: TranslateConfigFn
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
      const dateError = getDateColumnConstraintError(col, cellValue, rowData, translateConfig);
      if (dateError) {
        return false;
      }
    }
  }

  return true;
};

// Lightweight table cell components (no labels, compact styling)

interface TableCellSelectProps {
  config: BaseWidgetConfig;
  value: any;
  onValueChange: (value: any) => void;
}

const TableCellSelect = ({ config, value, onValueChange }: TableCellSelectProps) => {
  const { translate } = useWidgetTranslation();
  // Use useBaseWidget to get data source options (it handles loading)
  const {
    dataSourceOptions,
    loading,
    config: widgetConfig,
  } = useBaseWidget({ config });
  const isReadonly = config['widget-readonly'] || false;

  return (
    <div className="table-cell-field w-full">
      <select
        value={value || ''}
        onChange={(e) => onValueChange(e.target.value)}
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
        <option value="">{translate('common.select') || 'Select'}</option>
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

// Component to display select value label in view mode
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
  
  const selectedOption = dataSourceOptions.find((option: any) => option.value === value);
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
  const formatConfig = config['widget-data-format'];
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
      // Allow partial input (e.g., "-", ".")
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
  const { translateConfig } = useWidgetTranslation();
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
    ? translateConfig(optionsConfig.minDateMessage)
    : undefined;
  const maxDateMessage = optionsConfig?.maxDateMessage
    ? translateConfig(optionsConfig.maxDateMessage)
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

  // input type="date" requires YYYY-MM-DD format
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
        title={constraintError || translateConfig(config['widget-data-tooltip'])}
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

/**
 * Table widget with record-level inline editing
 * 
 * Usage in schema:
 * {
 *   "widget": "table",
 *   "widget-type": "table",
 *   "widget-label": "Education History",
 *   "widget-id": "educationHistory",
 *   "widget-data-path": "education.history",
 *   "widget-data-columns": [
 *     {
 *       "column-key": "degree",
 *       "widget-label": "Degree",
 *       "widget": "text",
 *       "widget-type": "input",
 *       "widget-data-path": "degree",
 *       "widget-data-format": {...}
 *     },
 *     {
 *       "column-key": "year",
 *       "widget-label": "Year",
 *       "widget": "number",
 *       "widget-type": "input",
 *       "widget-data-path": "year"
 *     }
 *   ],
 *   "widget-data-operations": {
 *     "add": true,
 *     "remove": true,
 *     "edit": true
 *   },
 *   "widget-data-api": {
 *     "add": { "url": "/api/records", "method": "POST" },
 *     "edit": { "url": "/api/records/{id}", "method": "PUT" },
 *     "delete": { "url": "/api/records/{id}", "method": "DELETE" }
 *   }
 * }
 */
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

  const { translate, translateConfig } = useWidgetTranslation();
  const { dataSourceRequestHandler } = useWidgetContext();
  const dispatch = useDispatch();
  const storeValues = useSelector((state: WidgetRootState) => state.widget?.values || {});

  const rows: any[] = Array.isArray(value) ? value : [];
  const columns = widgetConfig['widget-data-columns'] || [];
  const operations = widgetConfig['widget-data-operations'] || {};
  const apiConfig = widgetConfig['widget-data-api'] || {};
  const isReadonly = widgetConfig['widget-readonly'] || false;

  // State for editing
  const [editingState, setEditingState] = useState<EditingState | null>(null);
  const [loadingRowIndex, setLoadingRowIndex] = useState<number | null>(null);
  const [confirmationState, setConfirmationState] = useState<ConfirmationState | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newRowData, setNewRowData] = useState<any>(null);
  // Track original rows when entering section edit mode for edit_action tracking
  const [originalRows, setOriginalRows] = useState<any[] | null>(null);

  // When section is in edit mode (isReadonly is false), rows can be edited individually
  // But they are NOT automatically editable - user must click Edit button for each row
  const isSectionEditMode = !isReadonly && operations.edit;
  
  // Check if any row is being edited (either manually or via section edit mode)
  const isAnyRowEditing = editingState !== null || isAdding;

  const canSaveEditingRow = useMemo(() => {
    if (!editingState) {
      return false;
    }
    return isTableRowDataValid(
      editingState.currentValue,
      columns,
      isReadonly,
      translateConfig
    );
  }, [editingState, columns, isReadonly, translateConfig]);

  const canSaveNewRow = useMemo(() => {
    if (!isAdding || !newRowData) {
      return false;
    }
    return isTableRowDataValid(newRowData, columns, isReadonly, translateConfig);
  }, [isAdding, newRowData, columns, isReadonly, translateConfig]);

  // Show confirmation dialog
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

  // Cancel current edit
  const cancelEdit = useCallback(() => {
    if (editingState) {
      // Revert to original value
      const newRows = [...rows];
      newRows[editingState.rowIndex] = editingState.originalValue;
      onChange(newRows);
      
      // Clear widget values from Redux for this row's cells
      columns.forEach((col) => {
        const cellWidgetId = `${widgetConfig['widget-id']}-row-${editingState.rowIndex}-col-${col['column-key']}`;
        dispatch(resetWidget(cellWidgetId));
      });
    }
    if (isAdding) {
      // Clear widget values from Redux for new row's cells
      columns.forEach((col) => {
        const cellWidgetId = `${widgetConfig['widget-id']}-row-${rows.length}-col-${col['column-key']}`;
        dispatch(resetWidget(cellWidgetId));
      });
    }
    setEditingState(null);
    setIsAdding(false);
    setNewRowData(null);
  }, [editingState, rows, onChange, columns, widgetConfig, isAdding, dispatch]);

  // Start editing a row
  const startEdit = useCallback((rowIndex: number) => {
    if (isAnyRowEditing) {
      showConfirmation(
        translate('table.unsavedChanges') || 'You have unsaved changes. Do you want to discard them?',
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
          // Do nothing, keep current edit
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
  }, [isAnyRowEditing, rows, showConfirmation, cancelEdit, translate]);

  // Update cell value during edit
  const updateCellValue = useCallback((columnKey: string, newValue: any, rowIndex?: number) => {
    if (editingState && rowIndex !== undefined) {
      // Update editing state (works for both section edit mode and normal mode)
      setEditingState({
        ...editingState,
        currentValue: {
          ...editingState.currentValue,
          [columnKey]: newValue,
        },
      });
      
      // Also update Redux store for the cell widget
      const cellWidgetId = `${widgetConfig['widget-id']}-row-${rowIndex}-col-${columnKey}`;
      dispatch(setValue({ widgetId: cellWidgetId, value: newValue }));
    } else if (isAdding && newRowData) {
      setNewRowData({
        ...newRowData,
        [columnKey]: newValue,
      });
    }
  }, [editingState, isAdding, newRowData, widgetConfig, dispatch]);

  // Save edited row
  const saveEdit = useCallback(async () => {
    if (!editingState) return;
    if (!canSaveEditingRow) return;

    const rowData = editingState.currentValue;
    const rowIndex = editingState.rowIndex;
    setLoadingRowIndex(rowIndex);

    try {
      // If API config exists, make API call
      // TODO: Update to use dataSourceRequestHandler pattern
      if (dataSourceRequestHandler && apiConfig.edit) {
        const editConfig = apiConfig.edit;
        // Extract service and endpoint from URL if possible, or use config
        // For now, API operations in TableWidget are disabled
        console.warn('[TableWidget] API edit operations require migration to dataSourceRequestHandler pattern');
      }

      // Update local state
      const newRows = [...rows];
      const currentRow = newRows[rowIndex] || {};
      const wasDeleted = currentRow.edit_action === 'DELETE';
      
      // Determine edit_action (for color coding)
      let editAction = currentRow.edit_action;
      if (isSectionEditMode) {
        // If row was deleted but is being saved, un-delete it
        if (wasDeleted) {
          // Check if this row exists in original rows
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
          // Check if this row exists in original rows
          const rowId = rowData.id;
          const existsInOriginal = rowId !== undefined
            ? originalRows.some(or => or.id === rowId)
            : rowIndex < originalRows.length;
          
          editAction = existsInOriginal ? 'UPDATE' : 'ADD';
        } else if (!editAction) {
          editAction = 'UPDATE';
        }
      } else {
        // In non-section edit mode, mark as UPDATE if not already set
        if (!editAction && !wasDeleted) {
          editAction = 'UPDATE';
        }
      }
      
      newRows[rowIndex] = {
        ...rowData,
        ...(editAction ? { edit_action: editAction } : {}),
      };
      onChange(newRows);

      // Clear editing state and reset widget values in Redux
      columns.forEach((col) => {
        const cellWidgetId = `${widgetConfig['widget-id']}-row-${rowIndex}-col-${col['column-key']}`;
        dispatch(resetWidget(cellWidgetId));
      });
      
      setEditingState(null);
    } catch (error) {
      console.error('Error saving record:', error);
      // Show error message (could be enhanced with toast/notification)
      alert(translate('table.saveError') || 'Failed to save record. Please try again.');
    } finally {
      setLoadingRowIndex(null);
    }
  }, [editingState, canSaveEditingRow, rows, onChange, dataSourceRequestHandler, apiConfig, translate, isSectionEditMode, originalRows, columns, widgetConfig, dispatch]);

  // Add new row
  const startAdd = useCallback(() => {
    // If there's an unsaved edit, cancel it first (no confirmation needed)
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

  // Save new row
  const saveAdd = useCallback(async () => {
    if (!isAdding || !newRowData) return;
    if (!canSaveNewRow) return;

    setLoadingRowIndex(-1); // Use -1 to indicate new row

    try {
      let savedRow = { ...newRowData };

      // If API config exists, make API call
      // TODO: Update to use dataSourceRequestHandler pattern
      if (dataSourceRequestHandler && apiConfig.add) {
        const addConfig = apiConfig.add;
        // Extract service and endpoint from URL if possible, or use config
        // For now, API operations in TableWidget are disabled
        console.warn('[TableWidget] API add operations require migration to dataSourceRequestHandler pattern');
        // Use newRowData as response for now
        const response = newRowData;
        if (response && typeof response === 'object') {
          savedRow = { ...savedRow, ...response };
        }
      }

      // Mark new row with edit_action: 'ADD' (for color coding)
      savedRow = { ...savedRow, edit_action: 'ADD' };

      // Add to local state
      onChange([...rows, savedRow]);

      setIsAdding(false);
      setNewRowData(null);
    } catch (error) {
      console.error('Error adding record:', error);
      alert(translate('table.addError') || 'Failed to add record. Please try again.');
    } finally {
      setLoadingRowIndex(null);
    }
  }, [isAdding, newRowData, canSaveNewRow, rows, onChange, dataSourceRequestHandler, apiConfig, translate, isSectionEditMode]);

  // Delete row
  const deleteRow = useCallback(async (rowIndex: number) => {
    if (isAnyRowEditing) {
      showConfirmation(
        translate('table.unsavedChanges') || 'You have unsaved changes. Do you want to discard them?',
        () => {
          cancelEdit();
          performDelete(rowIndex);
        },
        () => {
          // Do nothing, keep current edit
        }
      );
    } else {
      performDelete(rowIndex);
    }
  }, [isAnyRowEditing, showConfirmation, cancelEdit, translate]);

  const performDelete = useCallback(async (rowIndex: number) => {
    const row = rows[rowIndex];
    setLoadingRowIndex(rowIndex);

    try {
      // If API config exists, make API call
      // TODO: Update to use dataSourceRequestHandler pattern
      if (dataSourceRequestHandler && apiConfig.delete) {
        const deleteConfig = apiConfig.delete;
        // Extract service and endpoint from URL if possible, or use config
        // For now, API operations in TableWidget are disabled
        console.warn('[TableWidget] API delete operations require migration to dataSourceRequestHandler pattern');
      }

      // In section edit mode, mark row as deleted instead of removing it
      if (isSectionEditMode) {
        const newRows = [...rows];
        newRows[rowIndex] = {
          ...newRows[rowIndex],
          edit_action: 'DELETE',
        };
        onChange(newRows);
      } else {
        // Remove from local state (non-section edit mode)
        const newRows = rows.filter((_, i) => i !== rowIndex);
        onChange(newRows);
      }
    } catch (error) {
      console.error('Error deleting record:', error);
      alert(translate('table.deleteError') || 'Failed to delete record. Please try again.');
    } finally {
      setLoadingRowIndex(null);
    }
  }, [rows, onChange, dataSourceRequestHandler, apiConfig, translate, isSectionEditMode]);

  // Get cell value (from editing state or row data)
  const getCellValue = useCallback((rowIndex: number, columnKey: string) => {
    // When a specific row is being edited (either in section edit mode or normal mode)
    if (editingState && editingState.rowIndex === rowIndex) {
      // Check Redux store first for most up-to-date value
      const cellWidgetId = `${widgetConfig['widget-id']}-row-${rowIndex}-col-${columnKey}`;
      const storeValue = storeValues[cellWidgetId];
      if (storeValue !== undefined) {
        return storeValue;
      }
      return editingState.currentValue[columnKey];
    }
    if (isAdding && rowIndex === rows.length) {
      return newRowData?.[columnKey];
    }
    return rows[rowIndex]?.[columnKey];
  }, [editingState, isAdding, rows, newRowData, widgetConfig, storeValues]);

  // Get formatted display value for a cell
  const getDisplayValue = useCallback((rowIndex: number, column: any) => {
    const columnKey = column['column-key'];
    const cellValue = getCellValue(rowIndex, columnKey);
    const widgetType = column.widget || 'text';
    
    if (cellValue === null || cellValue === undefined || cellValue === '') {
      return '-';
    }

    // For select widgets, we'll use SelectDisplayValue component instead
    // This function is kept for other widget types
    if (widgetType === 'select') {
      return null; // Will be handled by SelectDisplayValue component
    }

    // Use formatValue if format config exists
    if (column['widget-data-format']) {
      return formatValue(cellValue, column['widget-data-format'], column.widget);
    }

    return cellValue?.toString() || '-';
  }, [getCellValue]);

  // Check if row is being edited
  // In section edit mode, only the row with active editingState is editable
  const isRowEditing = useCallback((rowIndex: number) => {
    return editingState?.rowIndex === rowIndex || (isAdding && rowIndex === rows.length);
  }, [editingState, isAdding, rows.length]);

  // Store original rows when entering section edit mode (for edit_action tracking)
  useEffect(() => {
    if (isSectionEditMode && originalRows === null) {
      setOriginalRows(JSON.parse(JSON.stringify(rows))); // Deep clone
    } else if (!isSectionEditMode && originalRows !== null) {
      setOriginalRows(null);
    }
  }, [isSectionEditMode, rows, originalRows]);

  // Set cell widget value in Redux when entering edit mode for a specific row
  useEffect(() => {
    if (editingState) {
      columns.forEach((col) => {
        const columnKey = col['column-key'];
        const cellWidgetId = `${widgetConfig['widget-id']}-row-${editingState.rowIndex}-col-${columnKey}`;
        const cellValue = editingState.currentValue[columnKey];
        const defaultValue = cellValue !== undefined ? cellValue : (col['widget-data-default'] ?? '');
        // Set value in Redux store
        dispatch(setValue({ widgetId: cellWidgetId, value: defaultValue }));
      });
    }
  }, [editingState, columns, widgetConfig, dispatch]);

  useEffect(() => {
    if (isAdding && newRowData) {
      columns.forEach((col) => {
        const columnKey = col['column-key'];
        const cellWidgetId = `${widgetConfig['widget-id']}-row-${rows.length}-col-${columnKey}`;
        const cellValue = newRowData[columnKey];
        const defaultValue = cellValue !== undefined ? cellValue : (col['widget-data-default'] ?? '');
        // Set value in Redux store for new row
        dispatch(setValue({ widgetId: cellWidgetId, value: defaultValue }));
      });
    }
  }, [isAdding, newRowData, columns, widgetConfig, rows.length, dispatch]);

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

  // Lightweight cell renderer for table cells (no labels, compact)
  const renderTableCell = useCallback((rowIndex: number, column: any, cellValue: any, isReadonly: boolean) => {
    const columnKey = column['column-key'];
    const widgetType = column.widget || 'text';
    const cellWidgetId = `${widgetConfig['widget-id']}-row-${rowIndex}-col-${columnKey}`;
    const rowValues = getRowValuesForEdit(rowIndex);
    
    // Use lightweight cell config (no label, minimal styling)
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

    // For common widget types, render lightweight versions directly
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

    // For other widget types, use WidgetRenderer but with compact styling
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

  // Render cell content (widget in edit mode, formatted value in view mode)
  const renderCell = useCallback((rowIndex: number, column: any, row: any) => {
    const columnKey = column['column-key'];
    const isEditing = isRowEditing(rowIndex);
    const cellValue = getCellValue(rowIndex, columnKey);
    const columnReadonly = column['widget-readonly'] === true;
    
    // Get color styling based on edit_action
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
      // Use lightweight cell renderer
      return renderTableCell(rowIndex, column, cellValue, columnReadonly);
    } else {
      // Display formatted value in view mode with color styling
      const widgetType = column.widget || 'text';
      const displayValue = getDisplayValue(rowIndex, column);
      
      // For select widgets, use SelectDisplayValue component to show label
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
      
      return (
        <div className="text-sm" style={getCellStyle()}>
          {displayValue}
        </div>
      );
    }
  }, [isRowEditing, getCellValue, getDisplayValue, renderTableCell]);

  const tableWidgetId = `table-widget-${widgetConfig['widget-id']}`;
  // Get column span from config (1, 2, 3, etc.) - defaults to 2 if not specified
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
        {/* Confirmation Dialog */}
      {confirmationState?.show && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-lg p-6 max-w-md w-full mx-4" style={{ backgroundColor: 'var(--owt-color-bg, #FFFFFF)' }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--owt-color-text, #011627)' }}>
              {translate('table.confirm') || 'Confirm Action'}
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
                {translate('common.cancel') || 'Cancel'}
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
                {translate('table.discard') || 'Discard & Continue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table Header */}
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
            {translate('table.addRecord') || 'Add New Record'}
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
                    {translateConfig(col['widget-label'])}
                  </th>
                ))}
                {((operations.edit || operations.remove) && !isReadonly) || isAnyRowEditing || isSectionEditMode ? (
                  <th
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                    style={{ color: 'var(--owt-widget-table-header-color, #727474)' }}
                  >
                    {translate('common.actions') || 'Actions'}
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
                    {translate('table.noData') || 'No records available.'}
                    {operations.add && !isReadonly && ` ${translate('table.clickToAdd') || 'Click "Add New Record" to add one.'}`}
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
                          // Show OK (Save)/Cancel buttons when row is being edited (works in both section edit mode and normal mode)
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
                              {translate('common.ok') || 'OK'}
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
                              {translate('common.cancel') || 'Cancel'}
                            </button>
                          </div>
                        ) : (
                          // Show Edit/Delete buttons when row is not being edited
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
                                {translate('common.edit') || 'Edit'}
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
                                {translate('common.remove') || 'Delete'}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}

              {/* New row being added */}
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
                        {translate('common.save') || 'Save'}
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
                        {translate('common.cancel') || 'Cancel'}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      {/* Error and Help Text */}
      {touched && error.length > 0 && (
        <p className="text-sm mt-1" style={{ color: 'var(--owt-widget-error-color, #B91C1C)' }}>{error[0]}</p>
      )}
      {/* {widgetConfig['widget-data-helptext'] && (
        <p className="text-gray-500 text-sm mt-1">
          {translateConfig(widgetConfig['widget-data-helptext'])}
        </p>
      )} */}
      </div>
    </>
  );
};
