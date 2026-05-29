import { SectionConfig, PanelConfig, BaseWidgetConfig } from '../types';

/**
 * Namespace a data path by adding a namespace prefix
 */
const namespaceDataPath = (
  dataPath: string | Record<string, string> | undefined,
  namespace: string
): string | Record<string, string> | undefined => {
  if (!dataPath) return dataPath;
  
  if (typeof dataPath === 'string') {
    // Add namespace prefix to the data path
    return `${namespace}.${dataPath}`;
  }
  
  // Multi-path: namespace each path
  const namespaced: Record<string, string> = {};
  for (const [key, path] of Object.entries(dataPath)) {
    namespaced[key] = `${namespace}.${path}`;
  }
  return namespaced;
};

/**
 * Recursively namespace widget IDs and data paths in a widget configuration
 * This ensures unique widget IDs and data paths when the same section is rendered multiple times
 */
const namespaceWidgetConfig = (
  widgetConfig: BaseWidgetConfig,
  namespace: string
): BaseWidgetConfig => {
  const namespaced: BaseWidgetConfig = { ...widgetConfig };

  // Namespace the widget-id
  if (namespaced['widget-id']) {
    namespaced['widget-id'] = `${namespace}__${namespaced['widget-id']}`;
  }

  // Namespace the widget-data-path to ensure values are stored separately
  if (namespaced['widget-data-path']) {
    namespaced['widget-data-path'] = namespaceDataPath(
      namespaced['widget-data-path'],
      namespace
    );
  }

  // Recursively namespace nested widgets (for layout widgets)
  if (namespaced.widgets && Array.isArray(namespaced.widgets)) {
    namespaced.widgets = namespaced.widgets.map((widget) =>
      namespaceWidgetConfig(widget, namespace)
    );
  }

  // Namespace widget-item (for array/group widgets)
  if (namespaced['widget-item']) {
    namespaced['widget-item'] = namespaceWidgetConfig(
      namespaced['widget-item'],
      namespace
    );
  }

  // Namespace widget-data-columns (for table widgets)
  if (namespaced['widget-data-columns'] && Array.isArray(namespaced['widget-data-columns'])) {
    namespaced['widget-data-columns'] = namespaced['widget-data-columns'].map((column) => {
      const namespacedColumn = { ...column };
      // Namespace column data paths if they exist (columns only support string paths, not multi-path)
      if (namespacedColumn['widget-data-path'] && typeof namespacedColumn['widget-data-path'] === 'string') {
        namespacedColumn['widget-data-path'] = namespaceDataPath(
          namespacedColumn['widget-data-path'],
          namespace
        ) as string; // Safe cast since we checked it's a string
      }
      return namespacedColumn;
    });
  }

  return namespaced;
};

/**
 * Recursively namespace widget IDs in a panel configuration
 */
const namespacePanelConfig = (
  panel: PanelConfig,
  namespace: string
): PanelConfig => {
  const namespaced: PanelConfig = { ...panel };

  // Recursively namespace nested panels
  if (namespaced.panels && Array.isArray(namespaced.panels)) {
    namespaced.panels = namespaced.panels.map((p) =>
      namespacePanelConfig(p, namespace)
    );
  }

  // Namespace widgets in panel
  if (namespaced.widgets && Array.isArray(namespaced.widgets)) {
    namespaced.widgets = namespaced.widgets.map((widget) =>
      namespaceWidgetConfig(widget, namespace)
    );
  }

  return namespaced;
};

/**
 * Namespace widget IDs and data paths in a section configuration
 * This ensures unique widget IDs and data paths when the same section is rendered multiple times
 * (e.g., in CRView mode showing old and new records side by side)
 * 
 * @param section - Section configuration to namespace
 * @param namespace - Namespace prefix to add to widget IDs and data paths (e.g., "old", "new", "instance-1")
 * @returns Namespaced section configuration
 */
export const namespaceSectionConfig = (
  section: SectionConfig,
  namespace: string
): SectionConfig => {
  const namespaced: SectionConfig = { ...section };

  // Namespace the section-id as well to ensure uniqueness
  if (namespaced['section-id']) {
    namespaced['section-id'] = `${namespace}__${namespaced['section-id']}`;
  }

  // Recursively namespace panels
  if (namespaced.panels && Array.isArray(namespaced.panels)) {
    namespaced.panels = namespaced.panels.map((panel) =>
      namespacePanelConfig(panel, namespace)
    );
  }

  // Namespace supporting documents data paths
  if (namespaced['section-supporting-documents'] && Array.isArray(namespaced['section-supporting-documents'])) {
    namespaced['section-supporting-documents'] = namespaced['section-supporting-documents'].map((doc) => ({
      ...doc,
      'document-data-path': doc['document-data-path'] 
        ? `${namespace}.${doc['document-data-path']}`
        : doc['document-data-path'],
    }));
  }

  return namespaced;
};
