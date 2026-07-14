import { Dispatch } from '@reduxjs/toolkit';
import { SectionConfig } from '../../../types';
import { getValueByPath, setWidgetValue } from '../../../utils/pathUtils';
import { collectWidgets } from '../../../utils/sectionValidate';
import { applySectionEditSnapshot, SectionEditSnapshot } from '../../../utils/sectionRevert';
import { setValues } from '../../../store/widgetSlice';
import { WidgetRootState } from '../../../store';

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
  let newStoreValues = currentStoreValues;

  if (editEntrySnapshot) {
    newStoreValues = applySectionEditSnapshot(currentStoreValues, editEntrySnapshot);
  } else {
    const oldSchemaData = schemaData || contextSchemaData;

    sectionWidgets.forEach((widget) => {
      const widgetId = widget['widget-id'];
      const originalDataPath = widget['widget-data-path'];
      const storeDataPath = originalDataPath;

      if (widgetId && originalDataPath) {
        let oldValue: unknown;
        if (typeof originalDataPath === 'object') {
          oldValue = {};
          Object.entries(originalDataPath).forEach(([key, path]) => {
            if (typeof path === 'string') {
              (oldValue as Record<string, unknown>)[key] = getValueByPath(
                oldSchemaData,
                path,
              );
            }
          });
        } else if (typeof originalDataPath === 'string') {
          oldValue = getValueByPath(oldSchemaData, originalDataPath);
        }

        if (oldValue !== undefined) {
          newStoreValues = setWidgetValue(
            newStoreValues,
            storeDataPath,
            widgetId,
            oldValue,
          );
          newStoreValues = { ...newStoreValues, [widgetId]: oldValue };
        }
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
          oldValue,
        );
      });
    }
  }

  dispatch(setValues(newStoreValues));
};
