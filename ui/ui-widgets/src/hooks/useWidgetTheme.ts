import { createContext, useContext } from 'react';
import { defaultTheme, resolveTheme } from '../theme';

export type ResolvedTheme = ReturnType<typeof resolveTheme>;

export const ThemeContext = createContext<ResolvedTheme>(defaultTheme);

/**
 * Access the resolved widget theme from any component inside `<WidgetProvider>`.
 *
 * ```tsx
 * const theme = useWidgetTheme();
 * // theme.colors.primary, theme.section.dividerColor, etc.
 * ```
 */
export function useWidgetTheme(): ResolvedTheme {
  return useContext(ThemeContext);
}
