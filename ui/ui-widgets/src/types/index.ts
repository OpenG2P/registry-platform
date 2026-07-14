import { z } from 'zod';

export type WidgetDataPath = string | Record<string, string>;

export type DataSourceType = 'static' | 'api' | 'schema';

export interface StaticDataSource {
  type: 'static';
  options: Array<{ value: string | number; label: string }>;
}

/** Called by widgets to request data; the host app handles API calls, formatting, CORS, and auth. */
export type DataSourceRequestHandler = (
  service: string,
  endpoint: string,
  method: string,
  params: Record<string, any>,
  options?: {
    headers?: Record<string, string>;
  }
) => Promise<any>;

export interface ApiDataSource {
  type: 'api';
  service: string;
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  dependsOn?: string;
  valueKey?: string;
  labelKey?: string;
  params?: Record<string, any>;
  [key: string]: any;
  /** @deprecated Use `service` + `endpoint` instead. */
  url?: string;
}

export interface SchemaDataSource {
  type: 'schema';
  path: string;
  valueKey?: string;
  labelKey?: string;
}

export interface GeoHierarchyDataSource {
  type: 'api';
  service: string;
  method?: 'POST';
  /** e.g. get-all-g2p-geo-levels (matches /api/master-data/...) */
  levelsEndpoint: string;
  /** e.g. geo-level-values (matches /api/master-data/...) */
  valuesEndpoint: string;
}

export type DataSource = StaticDataSource | ApiDataSource | SchemaDataSource;

/** Configuration for a single upload slot inside a `docs` widget. */
export interface DocsWidgetDocumentConfig {
  'document-key': string;
  'document-label': string;
  'document-required'?: boolean;
  'document-accept': string;
  'document-max-size': number;
}

export interface GeoHierarchyLayout {
  distribution?: 'fixed';
  columns?: number[];
  columnIndex?: number;
}

/** Optional read path for edit-mode hydration (defaults from widget-data-path). */
export type GeoHierarchyDataPath = string | {
  value: string;
  hierarchy: string;
};

export function isGeoHierarchyDataSource(
  dataSource: unknown,
): dataSource is GeoHierarchyDataSource {
  return Boolean(
    dataSource &&
      typeof dataSource === 'object' &&
      (dataSource as GeoHierarchyDataSource).type === 'api' &&
      'levelsEndpoint' in dataSource &&
      'valuesEndpoint' in dataSource,
  );
}

export type CharacterType =
  | 'any'
  | 'alphabetic'
  | 'alphanumeric'
  | 'numeric'
  | 'numeric-decimal'
  | 'custom';

export type CaseControl =
  | 'none'
  | 'lowercase'
  | 'uppercase'
  | 'capitalize';

export interface InputMask {
  pattern: string;
  type?: 'static' | 'phone' | 'national-id' | 'custom';
  placeholder?: string;
}

export type ValidationType =
  | 'email'
  | 'phone'
  | 'url';

export interface WidgetValidation {
  required?: boolean;
  validationType?: ValidationType;
  /** Pattern takes precedence over `validationType` when both are set. */
  pattern?: string;
  patternMessage?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  custom?: string;
  zodSchema?: z.ZodSchema;
}

export type NumericType =
  | 'integer'
  | 'decimal';

export type RoundingMode =
  | 'round'
  | 'truncate';

export type TextAlign =
  | 'left'
  | 'right';

export type BooleanRepresentation =
  | 'true-false'
  | 'yes-no'
  | 'on-off'
  | 'custom';

export type BooleanControlType =
  | 'checkbox'
  | 'radio'
  | 'toggle';

export interface WidgetFormat {
  dateFormat?: string;
  currency?: string;
  locale?: string;
  decimals?: number;
  pattern?: string;
  inputType?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search' | 'file';
  characterType?: CharacterType;
  customCharset?: string;
  caseControl?: CaseControl;
  mask?: InputMask;
  showCharCounter?: boolean;
  rows?: number;
  numericType?: NumericType;
  decimalPlaces?: number;
  roundingMode?: RoundingMode;
  thousandSeparator?: string;
  decimalSeparator?: string;
  textAlign?: TextAlign;
  allowSigned?: boolean;
  formatOnBlur?: boolean;
  booleanRepresentation?: BooleanRepresentation;
  booleanControlType?: BooleanControlType;
  booleanTrueLabel?: string;
  booleanFalseLabel?: string;
  booleanUnsetLabel?: string;
  allowUnset?: boolean;
  layout?: 'vertical' | 'horizontal' | 'grid';
  sortOptions?: boolean;
  inputMethod?: 'picker' | 'manual' | 'hybrid';
  dateConstraint?: 'any' | 'past-only' | 'future-only';
  dateTimeFormat?: string;
  dateTimeConstraint?: 'any' | 'past-only' | 'future-only';
}

export type ConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'notEmpty'
  | 'empty'
  | 'greaterThan'
  | 'lessThan'
  | 'contains'
  | 'notContains';

export interface WidgetCondition {
  field: string;
  operator: ConditionOperator;
  value?: any;
}

export interface WidgetOptionRule {
  action: 'show' | 'hide' | 'enable' | 'disable' | 'require';
  condition?: WidgetCondition;
}

export interface WidgetOptions {
  /**`actions` for multiple sequential rules. */
  action?: 'show' | 'hide' | 'enable' | 'disable' | 'require';
  condition?: WidgetCondition;
  /** Apply enable/disable/show/hide first, then require. */
  actions?: WidgetOptionRule[];
  minDate?: string;
  maxDate?: string;
  minDateField?: string;
  maxDateField?: string;
  minDateMessage?: string;
  maxDateMessage?: string;
  showCalendar?: boolean;
  [key: string]: any;
}

export interface WidgetCascadeConfig {
  listenTo: string[];
  onEvent?: 'widget:change' | 'widget:blur' | 'widget:focus' | 'widget:reload' | 'widget:clear';
  clearOnChange?: boolean;
  reloadOnChange?: boolean;
  debounce?: number;
  throttle?: number;
}

export interface BaseWidgetConfig {
  widget: string;
  'widget-type'?: 'input' | 'layout' | 'table' | 'group';
  'widget-label'?: string;
  'widget-id': string;
  'widget-orientation'?: 'horizontal' | 'vertical';
  'widget-data-path'?: WidgetDataPath;
  'widget-data-default'?: any;
  'widget-required'?: boolean;
  'widget-readonly'?: boolean;
  'widget-data-validation'?: WidgetValidation;
  'widget-data-format'?: WidgetFormat;
  'widget-data-source'?: DataSource;
  'widget-data-options'?: WidgetOptions;
  'widget-data-placeholder'?: string;
  'widget-data-helptext'?: string;
  'widget-data-tooltip'?: string;
  'widget-cascade'?: WidgetCascadeConfig;
  /** Column layout for geo-hierarchy widget (e.g. 3 levels per column). */
  'widget-geo-layout'?: GeoHierarchyLayout;
  /**
   * Read path for geo_code_hierarchy_json (hydrate/display).
   * To also persist draft hierarchy on edit/save, use object widget-data-path with a hierarchy key.
   */
  'widget-geo-hierarchy-path'?: string;
  widgets?: BaseWidgetConfig[];
  'widget-item'?: BaseWidgetConfig;
  'widget-data-columns'?: Array<{
    'column-key': string;
    'widget-label': string;
    widget?: string;
    'widget-type'?: string;
    'widget-data-path'?: string;
    'widget-data-default'?: any;
    'widget-data-format'?: WidgetFormat;
    'widget-data-validation'?: WidgetValidation;
    'widget-data-source'?: DataSource;
    'widget-data-placeholder'?: string;
    'widget-required'?: boolean;
    'widget-readonly'?: boolean;
    [key: string]: any;
  }>;
  'widget-data-operations'?: {
    add?: boolean;
    remove?: boolean;
    edit?: boolean;
  };
  'widget-data-add-label'?: string;
  'widget-data-collapsed'?: boolean;
  'widget-column-span'?: number;
  'widget-total-docs'?: number;
  documents?: DocsWidgetDocumentConfig[];
  _comment?: string;
  [key: string]: any;
}

export interface PanelConfig {
  'panel-id': string;
  'panel-orientation'?: 'horizontal' | 'vertical';
  'panel-column-span'?: number;
  panels?: PanelConfig[];
  widgets?: BaseWidgetConfig[];
}

export interface SupportingDocumentConfig {
  'document-data-path': string;
  'document-type'?: string;
  'document-required'?: boolean;
  'document-label'?: string;
  'document-accept'?: string;
  'document-max-size'?: number;
}

export interface SectionConfig {
  'section-id': string;
  'section-title'?: string;
  'section-editable'?: boolean;
  /** When true in RegistryView, hides the "Edit Details" link for this section only. */
  'section-hide-edit-button'?: boolean;
  'section-column-span'?: number;
  'section-supporting-documents'?: SupportingDocumentConfig[];
  panels: PanelConfig[];
}

export interface UISchema {
  sections: SectionConfig[];
}

export type WidgetValue = any;

export interface WidgetState {
  values: Record<string, WidgetValue>;
  errors: Record<string, string[]>;
  touched: Record<string, boolean>;
  loading: Record<string, boolean>;
  dataSources: Record<string, any[]>;
}

export interface WidgetContextValue {
  widgetId: string;
  value: WidgetValue;
  error: string[];
  touched: boolean;
  loading: boolean;
  onChange: (value: WidgetValue) => void;
  onBlur: () => void;
  setError: (errors: string[]) => void;
  getFieldValue: (path: string) => any;
  getDataSource: (widgetId: string) => any[];
}

export type WidgetRenderFunction = (
  config: BaseWidgetConfig,
  context: WidgetContextValue
) => React.ReactNode;

export interface WidgetRegistryEntry {
  widget: string;
  component: React.ComponentType<any> | WidgetRenderFunction;
  defaultProps?: Record<string, any>;
}

export type ApiAdapter = (
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    params?: Record<string, any>;
  }
) => Promise<any>;
