import { Dispatch } from '@reduxjs/toolkit';
import { SectionConfig } from '../../../types';
import { getValueByPath, setWidgetValue } from '../../../utils/pathUtils';
import { collectWidgets } from '../../../utils/sectionValidate';
import { applySectionEditSnapshot, SectionEditSnapshot } from '../../../utils/sectionRevert';
import { isTableLikeWidget } from '../../../utils/extractTableRecordsFromSnapshot';
import { replaceValues } from '../../../store/widgetSlice';
import { WidgetRootState } from '../../../store';

const resolveSchemaValue = (
  schemaData: Record<string, unknown> | undefined,
  dataPath: string | Record<string, string>,
): unknown => {
  if (typeof dataPath === 'object') {
    const value: Record<string, unknown> = {};
    Object.entries(dataPath).forEach(([key, path]) => {
      if (typeof path === 'string') {
        value[key] = getValueByPath(schemaData, path);
      }
    });
    return value;
  }
  return getValueByPath(schemaData, dataPath);
};

/** Empty schema → explicit empty value so replaceValues clears edited data. */
const emptyRestoreValue = (widget: { widget?: string; 'widget-type'?: string }, schemaValue: unknown) => {
  if (schemaValue !== undefined) return schemaValue;
  return isTableLikeWidget(widget as any) ? [] : null;
};

const clearTableCellDraftKeys = (
  values: Record<string, unknown>,
  widgetId: string,
): Record<string, unknown> => {
  const prefix = `${widgetId}-row-`;
  const next = { ...values };
  for (const key of Object.keys(next)) {
    if (key.startsWith(prefix)) {
      delete next[key];
    }
  }
  return next;
};

/**
 * Restore section widget values after cancel/save from schemaData
 * (approved register data). Uses replaceValues — setValues merges and would
 * keep deleted table rows / cleared fields.
 */
export const revertSectionValues = ({
  section,
  store,
  dispatch,
  schemaData,
  contextSchemaData,
  hasSupportingDocuments,
  sectionId,
  editEntrySnapshot,
}: {
  section: SectionConfig;
  store: { getState: () => unknown };
  dispatch: Dispatch;
  schemaData?: Record<string, unknown>;
  contextSchemaData?: Record<string, unknown>;
  hasSupportingDocuments: boolean;
  sectionId: string;
  editEntrySnapshot: SectionEditSnapshot | null;
}) => {
  const sectionWidgets = collectWidgets(section.panels);
  const currentStoreValues = (store.getState() as WidgetRootState).widget.values;
  const oldSchemaData = schemaData || contextSchemaData;
  let newStoreValues: Record<string, unknown> = { ...currentStoreValues };

  if (oldSchemaData) {
    sectionWidgets.forEach((widget) => {
      const widgetId = widget['widget-id'];
      const dataPath = widget['widget-data-path'];
      if (!widgetId || !dataPath) return;

      const schemaValue = resolveSchemaValue(
        oldSchemaData,
        dataPath as string | Record<string, string>,
      );
      const restoreValue = emptyRestoreValue(widget, schemaValue);
      newStoreValues = setWidgetValue(newStoreValues, dataPath, widgetId, restoreValue);

      if (isTableLikeWidget(widget)) {
        newStoreValues = clearTableCellDraftKeys(newStoreValues, widgetId);
      }
    });

    if (hasSupportingDocuments) {
      const supportingDocuments = section['section-supporting-documents'] || [];
      supportingDocuments.forEach((doc, index) => {
        const widgetId = `supporting-doc-${sectionId}-${index}`;
        const originalDataPath = doc['document-data-path'];
        const oldValue = getValueByPath(oldSchemaData, originalDataPath);
        newStoreValues = setWidgetValue(
          newStoreValues,
          originalDataPath,
          widgetId,
          oldValue === undefined ? null : oldValue,
        );
      });
    }
  } else if (editEntrySnapshot) {
    newStoreValues = applySectionEditSnapshot(currentStoreValues, editEntrySnapshot);
  }

  dispatch(replaceValues(newStoreValues));
};
