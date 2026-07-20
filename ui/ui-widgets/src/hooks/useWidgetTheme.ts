import { createContext, useContext } from 'react';
import { defaultTheme, resolveTheme } from '../theme';

export type ResolvedTheme = ReturnType<typeof resolveTheme>;

export const ThemeContext = createContext<ResolvedTheme>(defaultTheme);

export function useWidgetTheme(): ResolvedTheme {
  return useContext(ThemeContext);
}
