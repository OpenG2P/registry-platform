// Types
export * from './types';
export type { DataSourceRequestHandler } from './types';

// Store
export { createWidgetStore } from './store';
export type { WidgetStore, WidgetRootState, WidgetDispatch } from './store';
export * from './store/widgetSlice';

// Hooks
export { useBaseWidget } from './hooks/useBaseWidget';
export type { UseBaseWidgetOptions } from './hooks/useBaseWidget';
export { useWidgetEventBus } from './hooks/useWidgetEventBus';
export { useWidgetCascade } from './hooks/useWidgetCascade';
export { useGeoWidgetCascade } from './hooks/useGeoWidgetCascade';

// Components
export { WidgetRenderer } from './components/WidgetRenderer';
export { WidgetProvider, useWidgetContext } from './components/WidgetProvider';
export { PanelRenderer } from './components/PanelRenderer';
export { SectionRenderer } from './components/SectionRenderer';
export type { SectionChanges, SectionRendererProps } from './components/SectionRenderer';
export { SectionsContainer } from './components/SectionsContainer';
export type { SectionMode, SectionsContainerProps, SectionsFormHandle } from './components/SectionsContainer';

// Section Builder Components
export { SectionBuilder } from './components/SectionBuilder';
export type { SectionBuilderProps } from './components/SectionBuilder';
export { JSONEditorPanel } from './components/SectionBuilder';
export { VisualBuilderPanel } from './components/SectionBuilder';
export { SectionTree } from './components/SectionBuilder';
export type { TreeNode, TreeNodeType } from './components/SectionBuilder';
export { PropertyEditor } from './components/SectionBuilder';

// Registry (import defaultWidgets to auto-register widgets)
import './registry/defaultWidgets';
export { widgetRegistry } from './registry/WidgetRegistry';
export type { WidgetRegistryEntry } from './types';
export { registerDefaultWidgets } from './registry/defaultWidgets';

// Widgets (for custom registration or direct use)
export * from './widgets';

// Utils
export * from './utils/pathUtils';
export * from './utils/validation';
export * from './utils/formatting';
export * from './utils/conditions';
export * from './utils/dataSource';
export * from './utils/textInput';
export * from './utils/numberInput';
export * from './utils/geoHierarchy';

// Events
export { WidgetEventBus } from './events/WidgetEventBus';
export type { WidgetEventType, WidgetEvent } from './events/WidgetEventBus';

// Theme
export type {
  WidgetTheme,
  WidgetThemeColors,
  WidgetThemeSection,
  WidgetThemePanel,
  WidgetThemeButton,
  WidgetThemeWidget,
} from './theme';
export { defaultTheme, resolveTheme } from './theme';
export { useWidgetTheme } from './hooks/useWidgetTheme';

// i18n
export { initI18n } from './i18n/config';
export { useWidgetTranslation } from './hooks/useWidgetTranslation';
export { default as i18n } from './i18n/config';
export { translateUISchema, translateWidgetConfig, translatePanelConfig } from './utils/schemaTranslation';

