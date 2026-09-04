import type { WidgetTheme } from '@openg2p/registry-widgets';
import type { Branding } from '@/app/api/_lib/client-safe-config.types';

export function brandingToWidgetTheme(branding?: Branding): WidgetTheme {
  const primary = branding?.primary_color_1;
  const primaryDark = branding?.primary_color_2;
  const surface = branding?.secondary_color_1;
  const borderLight = branding?.secondary_color_2;
  const muted = branding?.secondary_color_3;
  const text = branding?.neutral_color_1;
  const background = branding?.neutral_color_2;
  const toast = branding?.toast_color;

  return {
    colors: {
      primary,
      primaryDark,
      primaryLight: 'color-mix(in srgb, var(--owt-color-primary) 40%, var(--owt-color-bg))',
      primaryAccent: primaryDark,
      border: muted,
      borderLight,
      background,
      backgroundAlt: surface,
      text,
      textMuted: muted,
      success: toast?.toast_success_color,
      successDark: toast?.toast_success_color,
      successLight: surface,
      error: toast?.toast_failed_color,
      errorLight: surface,
      warning: toast?.toast_warning_color,
      info: toast?.toast_info_color,
    },
    section: {
      borderColor: borderLight,
      backgroundColor: background,
      titleColor: text,
      dividerColor: muted,
    },
    panel: {
      dividerColor: muted,
    },
    button: {
      primaryBg: background,
      primaryColor: text,
      primaryBorder: primaryDark,
      secondaryBg: background,
      secondaryColor: text,
      secondaryBorder: muted,
    },
    widget: {
      labelColor: text,
      inputBorderColor: muted,
      inputFocusBorderColor: primary,
      inputBackground: background,
      errorColor: toast?.toast_failed_color,
      helpTextColor: muted,
      tableHeaderBg: surface,
      tableHeaderColor: muted,
      tableBodyBg: background,
      tableBorderColor: muted,
      tableRowDividerColor: borderLight,
      tableEditingRowBg: background,
      tableDeletedRowBg: background,
      tableEmptyTextColor: muted,
    },
  };
}
