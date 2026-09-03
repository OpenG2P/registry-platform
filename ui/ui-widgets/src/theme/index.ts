import React from 'react';

export interface WidgetThemeColors {
  primary?: string;
  primaryDark?: string;
  primaryLight?: string;
  primaryAccent?: string;
  border?: string;
  borderLight?: string;
  background?: string;
  backgroundAlt?: string;
  text?: string;
  textMuted?: string;
  success?: string;
  successDark?: string;
  successLight?: string;
  error?: string;
  errorLight?: string;
  warning?: string;
  info?: string;
}

export interface WidgetThemeSection {
  borderRadius?: string;
  borderColor?: string;
  backgroundColor?: string;
  titleColor?: string;
  dividerColor?: string;
}

export interface WidgetThemePanel {
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
  tableHeaderBg?: string;
  tableHeaderColor?: string;
  tableBodyBg?: string;
  tableBorderColor?: string;
  tableRowDividerColor?: string;
  tableEditingRowBg?: string;
  tableDeletedRowBg?: string;
  tableEmptyTextColor?: string;
  tableBorderRadius?: string;
}

/** Top-level theme object accepted by `<WidgetProvider theme={…}>`. */
export interface WidgetTheme {
  colors?: WidgetThemeColors;
  section?: WidgetThemeSection;
  panel?: WidgetThemePanel;
  button?: WidgetThemeButton;
  widget?: WidgetThemeWidget;
}


export function themeToCSSVariables(theme?: WidgetTheme): React.CSSProperties {
  const c = theme?.colors;
  const s = theme?.section;
  const p = theme?.panel;
  const b = theme?.button;
  const w = theme?.widget;

  return {
    '--owt-color-primary': c?.primary ?? '#EABB13',
    '--owt-color-primary-dark': c?.primaryDark ?? '#ED7C22',
    '--owt-color-primary-light': c?.primaryLight ?? '#F3F1F4',
    '--owt-color-primary-accent': c?.primaryAccent ?? '#ED7C22',
    '--owt-color-border': c?.border ?? '#A1A1A1',
    '--owt-color-border-light': c?.borderLight ?? '#E1E1E1',
    '--owt-color-bg': c?.background ?? '#FFFFFF',
    '--owt-color-bg-alt': c?.backgroundAlt ?? '#F3F1F4',
    '--owt-color-text': c?.text ?? '#000000',
    '--owt-color-text-muted': c?.textMuted ?? '#A1A1A1',
    '--owt-color-success': c?.success ?? '#28A745',
    '--owt-color-success-dark': c?.successDark ?? '#28A745',
    '--owt-color-success-light': c?.successLight ?? '#F3F1F4',
    '--owt-color-error': c?.error ?? '#DC3545',
    '--owt-color-danger': c?.error ?? '#DC3545',
    '--owt-color-error-light': c?.errorLight ?? '#F3F1F4',
    '--owt-color-warning': c?.warning ?? '#FFC107',
    '--owt-color-info': c?.info ?? '#007BFF',
    '--owt-section-border-radius': s?.borderRadius ?? '8px',
    '--owt-section-border-color': s?.borderColor ?? '#E1E1E1',
    '--owt-section-bg': s?.backgroundColor ?? '#FFFFFF',
    '--owt-section-title-color': s?.titleColor ?? '#000000',
    '--owt-section-divider-color': s?.dividerColor ?? '#EABB13',
    '--owt-panel-divider-color': p?.dividerColor ?? '#A1A1A1',
    '--owt-panel-bg': p?.backgroundColor ?? 'transparent',
    '--owt-btn-primary-bg': b?.primaryBg ?? '#FFFFFF',
    '--owt-btn-primary-color': b?.primaryColor ?? '#000000',
    '--owt-btn-primary-border': b?.primaryBorder ?? '#ED7C22',
    '--owt-btn-secondary-bg': b?.secondaryBg ?? '#FFFFFF',
    '--owt-btn-secondary-color': b?.secondaryColor ?? '#000000',
    '--owt-btn-secondary-border': b?.secondaryBorder ?? '#A1A1A1',
    '--owt-btn-border-radius': b?.borderRadius ?? '6px',
    '--owt-widget-label-color': w?.labelColor ?? '#000000',
    '--owt-widget-input-border': w?.inputBorderColor ?? '#A1A1A1',
    '--owt-widget-input-focus-border': w?.inputFocusBorderColor ?? '#EABB13',
    '--owt-widget-input-bg': w?.inputBackground ?? '#FFFFFF',
    '--owt-widget-error-color': w?.errorColor ?? '#DC3545',
    '--owt-widget-helptext-color': w?.helpTextColor ?? '#A1A1A1',
    '--owt-widget-table-header-bg': w?.tableHeaderBg ?? '#F3F1F4',
    '--owt-widget-table-header-color': w?.tableHeaderColor ?? '#A1A1A1',
    '--owt-widget-table-body-bg': w?.tableBodyBg ?? '#FFFFFF',
    '--owt-widget-table-border-color': w?.tableBorderColor ?? '#A1A1A1',
    '--owt-widget-table-row-divider': w?.tableRowDividerColor ?? '#E1E1E1',
    '--owt-widget-table-editing-row-bg': w?.tableEditingRowBg ?? '#F3F1F4',
    '--owt-widget-table-deleted-row-bg': w?.tableDeletedRowBg ?? '#F3F1F4',
    '--owt-widget-table-empty-color': w?.tableEmptyTextColor ?? '#A1A1A1',
    '--owt-widget-table-border-radius': w?.tableBorderRadius ?? '15px',
    '--owt-widget-card-border-radius': '20px',
    '--owt-color-overlay': 'color-mix(in srgb, var(--owt-color-text) 50%, transparent)',
    '--owt-color-shadow': 'color-mix(in srgb, var(--owt-color-text) 20%, transparent)',
  } as React.CSSProperties;
}

export function owtThemeRootProps(
  theme?: WidgetTheme,
  extraStyle?: React.CSSProperties,
): { className: string; style: React.CSSProperties } {
  return {
    className: 'openg2p-widget-theme-root',
    style: { ...themeToCSSVariables(theme), ...extraStyle },
  };
}

export const OWT_FIELD_STYLES = `
  .owt-text {
    color: var(--owt-color-text);
  }
  .owt-text-muted {
    color: var(--owt-color-text-muted);
  }
  .owt-bg {
    background-color: var(--owt-color-bg);
  }
  .owt-bg-alt {
    background-color: var(--owt-color-bg-alt);
  }
  .owt-border {
    border-color: var(--owt-color-border-light);
  }
  .owt-highlight {
    background-color: var(--owt-color-primary-light);
  }
  .owt-highlight-hover:hover {
    background-color: var(--owt-color-primary-light);
  }
  .owt-shadow-sm {
    box-shadow: 0 1px 2px 0 var(--owt-color-shadow);
  }
  .owt-shadow-lg {
    box-shadow: 0 10px 15px -3px var(--owt-color-shadow), 0 4px 6px -4px var(--owt-color-shadow);
  }
  .owt-field-input {
    border: 1px solid var(--owt-widget-input-border);
    background-color: var(--owt-widget-input-bg);
    color: var(--owt-color-text);
  }
  .owt-field-input:focus {
    outline: none;
    border-color: var(--owt-widget-input-focus-border);
    box-shadow: 0 0 0 1px var(--owt-widget-input-focus-border);
  }
  .owt-field-input.owt-field-input-error,
  .owt-field-input.owt-field-input-error:focus {
    border-color: var(--owt-widget-error-color);
    box-shadow: 0 0 0 1px var(--owt-widget-error-color);
  }
  .owt-field-input:disabled,
  .owt-field-input.owt-field-input-disabled {
    background-color: var(--owt-color-bg-alt);
    cursor: not-allowed;
  }
  .owt-field-check {
    accent-color: var(--owt-color-primary);
    border-color: var(--owt-widget-input-border);
  }
  .owt-field-error {
    color: var(--owt-widget-error-color);
  }
  .owt-field-help {
    color: var(--owt-widget-helptext-color);
  }
  .owt-field-required {
    color: var(--owt-widget-error-color);
  }
  .owt-boolean-chip {
    border: 1px solid var(--owt-widget-input-border);
    background-color: var(--owt-widget-input-bg);
    color: var(--owt-color-text);
  }
  .owt-boolean-chip-selected {
    border-color: var(--owt-color-primary);
    background-color: var(--owt-color-primary);
    color: var(--owt-color-text);
  }
  .owt-link {
    color: var(--owt-color-info);
  }
  .owt-chip {
    background-color: var(--owt-color-primary-light);
    color: var(--owt-color-text);
  }
`;

export function owtFieldInputClass({
  error = false,
  disabled = false,
  className = '',
}: {
  error?: boolean;
  disabled?: boolean;
  className?: string;
} = {}): string {
  return [
    'owt-field-input',
    error ? 'owt-field-input-error' : '',
    disabled ? 'owt-field-input-disabled' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}
