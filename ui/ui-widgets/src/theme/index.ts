import React from 'react';

/**
 * Theme color tokens for the widget library.
 * All properties are optional — omitted values fall back to built-in defaults.
 *
 * Default palette derived from OpenG2P brand colours:
 *   Gold #F5BB1A · Orange #F07B1A · Purple #88498F
 *   Grey #C4C4C4 · Dark Navy #011627 · Light Grey #F6F6F6
 */
export interface WidgetThemeColors {
  /** Main brand colour (default: #F5BB1A — Gold) */
  primary?: string;
  /** Darker brand accent (default: #F07B1A — Orange) */
  primaryDark?: string;
  /** Light brand tint for backgrounds (default: #FBE6AA — Gold +62.5%) */
  primaryLight?: string;
  /** Secondary accent used in edit-mode borders (default: #EE7C22 — Orange 0% shade) */
  primaryAccent?: string;
  /** Standard border colour (default: #C4C4C4 — Grey) */
  border?: string;
  /** Lighter border colour (default: #E4E4E4 — Grey +62.5%) */
  borderLight?: string;
  /** Default background (default: #FFFFFF) */
  background?: string;
  /** Alternate/muted background (default: #F6F6F6 — Light Grey) */
  backgroundAlt?: string;
  /** Primary text colour (default: #011627 — Dark Navy) */
  text?: string;
  /** Secondary / muted text colour (default: #727474 — Grey -37.5%) */
  textMuted?: string;
  /** Success green (default: #16A34A) */
  success?: string;
  /** Success dark green (default: #047857) */
  successDark?: string;
  /** Light success surface for badges / highlights (default: #D1FAE5) */
  successLight?: string;
  /** Error / danger red (default: #B91C1C) */
  error?: string;
  /** Light error surface for badges / highlights (default: #FEE2E2) */
  errorLight?: string;
  /** Warning amber (default: #F59E0B) */
  warning?: string;
  /** Info / link blue (default: #2563EB) */
  info?: string;
}

export interface WidgetThemeSection {
  borderRadius?: string;
  borderColor?: string;
  backgroundColor?: string;
  titleColor?: string;
  /** Horizontal-rule / divider colour between panels (default: primary) */
  dividerColor?: string;
}

export interface WidgetThemePanel {
  /** Vertical divider colour between side-by-side panels */
  dividerColor?: string;
  backgroundColor?: string;
}

export interface WidgetThemeButton {
  primaryBg?: string;
  primaryColor?: string;
  primaryBorder?: string;
  secondaryBg?: string;
  secondaryColor?: string;
  secondaryBorder?: string;
  borderRadius?: string;
}

export interface WidgetThemeWidget {
  labelColor?: string;
  inputBorderColor?: string;
  inputFocusBorderColor?: string;
  inputBackground?: string;
  errorColor?: string;
  helpTextColor?: string;
  /** Table: header row background (default: #F6F6F6) */
  tableHeaderBg?: string;
  /** Table: header text colour (default: #727474) */
  tableHeaderColor?: string;
  /** Table: body / cell background (default: #FFFFFF) */
  tableBodyBg?: string;
  /** Table: outer border colour (default: #C4C4C4) */
  tableBorderColor?: string;
  /** Table: row divider lines (default: #E4E4E4) */
  tableRowDividerColor?: string;
  /** Table: background of a row being edited (default: #FBE6AA) */
  tableEditingRowBg?: string;
  /** Table: background of a row marked for deletion (default: #FEE2E2) */
  tableDeletedRowBg?: string;
  /** Table: empty-state text colour (default: #727474) */
  tableEmptyTextColor?: string;
  /** Table: container border radius (default: 15px) */
  tableBorderRadius?: string;
}

/**
 * Top-level theme object accepted by `<WidgetProvider theme={…}>`.
 * Every field is optional — only supply what you want to override.
 */
export interface WidgetTheme {
  colors?: WidgetThemeColors;
  section?: WidgetThemeSection;
  panel?: WidgetThemePanel;
  button?: WidgetThemeButton;
  widget?: WidgetThemeWidget;
}

/**
 * Built-in default values (matches the original hardcoded colours).
 */
export const defaultTheme: Required<{
  colors: Required<WidgetThemeColors>;
  section: Required<WidgetThemeSection>;
  panel: Required<WidgetThemePanel>;
  button: Required<WidgetThemeButton>;
  widget: Required<WidgetThemeWidget>;
}> = {
  colors: {
    primary: '#F5BB1A',
    primaryDark: '#F07B1A',
    primaryLight: '#FBE6AA',
    primaryAccent: '#EE7C22',
    border: '#C4C4C4',
    borderLight: '#E4E4E4',
    background: '#FFFFFF',
    backgroundAlt: '#F6F6F6',
    text: '#011627',
    textMuted: '#727474',
    success: '#16A34A',
    successDark: '#047857',
    successLight: '#D1FAE5',
    error: '#B91C1C',
    errorLight: '#FEE2E2',
    warning: '#F59E0B',
    info: '#2563EB',
  },
  section: {
    borderRadius: '8px',
    borderColor: '#E4E4E4',
    backgroundColor: '#FFFFFF',
    titleColor: '#011627',
    dividerColor: '#F5BB1A',
  },
  panel: {
    dividerColor: '#C4C4C4',
    backgroundColor: 'transparent',
  },
  button: {
    primaryBg: '#FFFFFF',
    primaryColor: '#011627',
    primaryBorder: '#F07B1A',
    secondaryBg: '#FFFFFF',
    secondaryColor: '#011627',
    secondaryBorder: '#C4C4C4',
    borderRadius: '6px',
  },
  widget: {
    labelColor: '#011627',
    inputBorderColor: '#C4C4C4',
    inputFocusBorderColor: '#F5BB1A',
    inputBackground: '#FFFFFF',
    errorColor: '#B91C1C',
    helpTextColor: '#727474',
    tableHeaderBg: '#F6F6F6',
    tableHeaderColor: '#727474',
    tableBodyBg: '#FFFFFF',
    tableBorderColor: '#C4C4C4',
    tableRowDividerColor: '#E4E4E4',
    tableEditingRowBg: '#FBE6AA',
    tableDeletedRowBg: '#FEE2E2',
    tableEmptyTextColor: '#727474',
    tableBorderRadius: '15px',
  },
};

/**
 * Merge a user-supplied (partial) theme with the built-in defaults.
 */
export function resolveTheme(theme?: WidgetTheme): typeof defaultTheme {
  if (!theme) return defaultTheme;
  return {
    colors: { ...defaultTheme.colors, ...theme.colors },
    section: { ...defaultTheme.section, ...theme.section },
    panel: { ...defaultTheme.panel, ...theme.panel },
    button: { ...defaultTheme.button, ...theme.button },
    widget: { ...defaultTheme.widget, ...theme.widget },
  };
}

/**
 * Convert a resolved theme into a flat Record of CSS custom properties.
 * These are set on the provider wrapper element so every descendant can
 * reference them with `var(--owt-…)`.
 *
 * Prefix: `--owt-` (OpenG2P Widget Theme).
 */
export function themeToCSSVariables(
  resolved: ReturnType<typeof resolveTheme>,
): React.CSSProperties {
  return {
    // --- colors ---
    '--owt-color-primary': resolved.colors.primary,
    '--owt-color-primary-dark': resolved.colors.primaryDark,
    '--owt-color-primary-light': resolved.colors.primaryLight,
    '--owt-color-primary-accent': resolved.colors.primaryAccent,
    '--owt-color-border': resolved.colors.border,
    '--owt-color-border-light': resolved.colors.borderLight,
    '--owt-color-bg': resolved.colors.background,
    '--owt-color-bg-alt': resolved.colors.backgroundAlt,
    '--owt-color-text': resolved.colors.text,
    '--owt-color-text-muted': resolved.colors.textMuted,
    '--owt-color-success': resolved.colors.success,
    '--owt-color-success-dark': resolved.colors.successDark,
    '--owt-color-success-light': resolved.colors.successLight,
    '--owt-color-error': resolved.colors.error,
    '--owt-color-error-light': resolved.colors.errorLight,
    '--owt-color-warning': resolved.colors.warning,
    '--owt-color-info': resolved.colors.info,
    // --- section ---
    '--owt-section-border-radius': resolved.section.borderRadius,
    '--owt-section-border-color': resolved.section.borderColor,
    '--owt-section-bg': resolved.section.backgroundColor,
    '--owt-section-title-color': resolved.section.titleColor,
    '--owt-section-divider-color': resolved.section.dividerColor,
    // --- panel ---
    '--owt-panel-divider-color': resolved.panel.dividerColor,
    '--owt-panel-bg': resolved.panel.backgroundColor,
    // --- button ---
    '--owt-btn-primary-bg': resolved.button.primaryBg,
    '--owt-btn-primary-color': resolved.button.primaryColor,
    '--owt-btn-primary-border': resolved.button.primaryBorder,
    '--owt-btn-secondary-bg': resolved.button.secondaryBg,
    '--owt-btn-secondary-color': resolved.button.secondaryColor,
    '--owt-btn-secondary-border': resolved.button.secondaryBorder,
    '--owt-btn-border-radius': resolved.button.borderRadius,
    // --- widget ---
    '--owt-widget-label-color': resolved.widget.labelColor,
    '--owt-widget-input-border': resolved.widget.inputBorderColor,
    '--owt-widget-input-focus-border': resolved.widget.inputFocusBorderColor,
    '--owt-widget-input-bg': resolved.widget.inputBackground,
    '--owt-widget-error-color': resolved.widget.errorColor,
    '--owt-widget-helptext-color': resolved.widget.helpTextColor,
    // --- widget / table ---
    '--owt-widget-table-header-bg': resolved.widget.tableHeaderBg,
    '--owt-widget-table-header-color': resolved.widget.tableHeaderColor,
    '--owt-widget-table-body-bg': resolved.widget.tableBodyBg,
    '--owt-widget-table-border-color': resolved.widget.tableBorderColor,
    '--owt-widget-table-row-divider': resolved.widget.tableRowDividerColor,
    '--owt-widget-table-editing-row-bg': resolved.widget.tableEditingRowBg,
    '--owt-widget-table-deleted-row-bg': resolved.widget.tableDeletedRowBg,
    '--owt-widget-table-empty-color': resolved.widget.tableEmptyTextColor,
    '--owt-widget-table-border-radius': resolved.widget.tableBorderRadius,
  } as React.CSSProperties;
}
