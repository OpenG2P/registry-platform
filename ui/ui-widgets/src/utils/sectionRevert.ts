import { SectionConfig, SupportingDocumentConfig } from '../types';
import { collectWidgets } from './sectionValidate';
import { getValueByPath, setValueByPath } from './pathUtils';

export interface SectionWidgetIdSnapshot {
  present: boolean;
  value?: any;
}

export interface SectionEditSnapshot {
  dataPaths: Array<{ path: string; value: any }>;
  widgetIds: Record<string, SectionWidgetIdSnapshot>;
}

const cloneValue = (value: any): any => {
  if (value === undefined) {
    return undefined;
  }
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
};

export function captureSectionEditSnapshot(
  values: Record<string, any>,
  section: SectionConfig,
  options?: {
    sectionId?: string;
    supportingDocuments?: SupportingDocumentConfig[];
  }
): SectionEditSnapshot {
  const { sectionId, supportingDocuments = [] } = options ?? {};
  const dataPaths: Array<{ path: string; value: any }> = [];
  const processedPaths = new Set<string>();
  const widgetIds: Record<string, SectionWidgetIdSnapshot> = {};

  const addPath = (path: string) => {
    if (!path || processedPaths.has(path)) {
      return;
    }
    processedPaths.add(path);
    dataPaths.push({
      path,
      value: cloneValue(getValueByPath(values, path)),
    });

    if (path.endsWith('.geo_code_hierarchy_json')) {
      const prefix = path.slice(0, -'.geo_code_hierarchy_json'.length);
      addPath(`${prefix}.geo_lowest_level_value_id`);
    }
  };

  collectWidgets(section.panels).forEach((widget) => {
    const widgetId = widget['widget-id'];
    const storeDataPath = widget['widget-data-path'];

    if (Object.prototype.hasOwnProperty.call(values, widgetId)) {
      widgetIds[widgetId] = { present: true, value: cloneValue(values[widgetId]) };
    } else {
      widgetIds[widgetId] = { present: false };
    }

    if (typeof storeDataPath === 'string') {
      addPath(storeDataPath);
    } else if (storeDataPath && typeof storeDataPath === 'object') {
      Object.values(storeDataPath).forEach((path) => {
        if (typeof path === 'string') {
          addPath(path);
        }
      });
    }
  });

  supportingDocuments.forEach((doc, index) => {
    const widgetId = `supporting-doc-${sectionId ?? 'section'}-${index}`;
    const storeDataPath = doc['document-data-path'];

    if (Object.prototype.hasOwnProperty.call(values, widgetId)) {
      widgetIds[widgetId] = { present: true, value: cloneValue(values[widgetId]) };
    } else {
      widgetIds[widgetId] = { present: false };
    }

    if (typeof storeDataPath === 'string') {
      addPath(storeDataPath);
    }
  });

  return { dataPaths, widgetIds };
}

export function applySectionEditSnapshot(
  currentValues: Record<string, any>,
  snapshot: SectionEditSnapshot
): Record<string, any> {
  let result = currentValues;

  for (const { path, value } of snapshot.dataPaths) {
    result = setValueByPath(result, path, cloneValue(value));
  }

  for (const [widgetId, entry] of Object.entries(snapshot.widgetIds)) {
    if (entry.present) {
      result = { ...result, [widgetId]: cloneValue(entry.value) };
    } else {
      const { [widgetId]: _removed, ...rest } = result;
      result = rest;
    }
  }

  return result;
}
