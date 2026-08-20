import { setError, setTouched } from '../store/widgetSlice';
import { WidgetDispatch } from '../store';
import {
  SectionConfig,
  PanelConfig,
  BaseWidgetConfig,
} from '../types';
import { shouldShowWidget, shouldEnableWidget, shouldRequireWidget } from './conditions';
import { getValueByPath, getWidgetValue } from './pathUtils';
import { validateDocsWidget, validateWidget } from './validation';
import { isTableLikeWidget } from './extractTableRecordsFromSnapshot';

const isColumnRequired = (
  column: Record<string, unknown>,
  skipRequired: boolean,
): boolean => {
  if (skipRequired) return false;
  const validation = column['widget-data-validation'] as { required?: boolean } | undefined;
  return !!(column['widget-required'] || validation?.required);
};

const validateTableLikeWidget = (
  widget: BaseWidgetConfig,
  currentSchemaData: Record<string, any>,
  dispatch: WidgetDispatch,
  skipRequired: boolean,
): boolean => {
  const widgetId = widget['widget-id'];
  if (!widgetId) return true;

  const columns = (widget['widget-data-columns'] || []) as Record<string, unknown>[];
  const value = getWidgetValue(
    currentSchemaData,
    widget['widget-data-path'],
    widgetId,
  );
  const rows: Record<string, unknown>[] = Array.isArray(value)
    ? (value as Record<string, unknown>[])
    : [];

  const activeRows = rows.filter((row) => row?.edit_action !== 'DELETE');
  const rowErrors: string[] = [];
  let isValid = true;

  if (!skipRequired && widget['widget-required'] && activeRows.length === 0) {
    dispatch(setTouched({ widgetId, touched: true }));
    dispatch(setError({ widgetId, errors: ['At least one record is required'] }));
    return false;
  }

  const hasRequiredColumns = columns.some((col) => isColumnRequired(col, skipRequired));
  if (!skipRequired && hasRequiredColumns && activeRows.length === 0) {
    dispatch(setTouched({ widgetId, touched: true }));
    dispatch(setError({
      widgetId,
      errors: ['Add at least one record and fill all required fields'],
    }));
    return false;
  }

  activeRows.forEach((row, rowIndex) => {
    columns.forEach((col) => {
      if (col['widget-readonly']) return;

      const key = col['column-key'] as string | undefined;
      if (!key) return;

      const required = isColumnRequired(col, skipRequired);
      const cellValue = row[key];
      const errors = validateWidget(
        cellValue,
        col['widget-data-validation'] as BaseWidgetConfig['widget-data-validation'],
        required,
        skipRequired,
      );

      if (errors.length > 0) {
        isValid = false;
        const label = (col['widget-label'] as string) || key;
        rowErrors.push(`Row ${rowIndex + 1}, ${label}: ${errors[0]}`);
      }
    });
  });

  if (!isValid) {
    dispatch(setTouched({ widgetId, touched: true }));
    dispatch(setError({
      widgetId,
      errors:
        rowErrors.length > 0
          ? rowErrors.slice(0, 5)
          : ['Please fix required fields in the table'],
    }));
  } else {
    dispatch(setTouched({ widgetId, touched: false }));
    dispatch(setError({ widgetId, errors: [] }));
  }

  return isValid;
};

export const collectWidgets = (panels: PanelConfig[]): BaseWidgetConfig[] => {
  let widgets: BaseWidgetConfig[] = [];
  panels.forEach((panel) => {
    if (panel.widgets) {
      widgets = [...widgets, ...panel.widgets];
    }
    if (panel.panels) {
      widgets = [...widgets, ...collectWidgets(panel.panels)];
    }
  });
  return widgets;
};

/**
 * @param skipRequired - Skip required checks for per-section Save/Next navigation;
 *   format and range validation still run.
 */
export const sectionValidate = (
  section: SectionConfig,
  currentSchemaData: Record<string, any>,
  dispatch: WidgetDispatch,
  skipRequired: boolean = false,
): boolean => {
  const allWidgets = collectWidgets(section.panels);

  let isValid = true;

  for (const widget of allWidgets) {
    const isVisible = shouldShowWidget(
      widget['widget-data-options'],
      currentSchemaData
    );

    if (!isVisible) continue;

    const isEnabled = shouldEnableWidget(
      widget['widget-data-options'],
      currentSchemaData,
    );

    if (!isEnabled) continue;

    const widgetId = widget['widget-id'];

    if (isTableLikeWidget(widget)) {
      const tableValid = validateTableLikeWidget(
        widget,
        currentSchemaData,
        dispatch,
        skipRequired,
      );
      if (!tableValid) {
        isValid = false;
      }
      continue;
    }

    const value = getWidgetValue(
      currentSchemaData,
      widget['widget-data-path'],
      widgetId
    );

    const isRequired = shouldRequireWidget(
      widget['widget-data-options'],
      currentSchemaData,
      widget['widget-required'] ?? false,
    );

    const errors = widget.widget === 'docs'
      ? validateDocsWidget(value, widget['documents'], skipRequired)
      : validateWidget(
          value,
          widget['widget-data-validation'],
          isRequired,
          skipRequired,
        );

    if (errors.length > 0) {
      isValid = false;
      dispatch(setTouched({ widgetId, touched: true }));
      dispatch(setError({ widgetId, errors }));
    } else {
      dispatch(setTouched({ widgetId, touched: false }));
      dispatch(setError({ widgetId, errors: [] }));
    }
  }

  section['section-supporting-documents']?.forEach((doc, index) => {
    const widgetId = `supporting-doc-${section['section-id']}-${index}`;

    if (!skipRequired && doc['document-required']) {
      const file = getValueByPath(
        currentSchemaData,
        doc['document-data-path']
      );

      if (!file) {
        isValid = false;
        dispatch(setTouched({ widgetId, touched: true }));
        dispatch(setError({
          widgetId,
          errors: ['This document is required'],
        }));
      } else {
        dispatch(setTouched({ widgetId, touched: false }));
        dispatch(setError({ widgetId, errors: [] }));
      }
    }
  });

  return isValid;
};
