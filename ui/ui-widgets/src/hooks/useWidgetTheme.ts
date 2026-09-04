import { createContext, useContext, useMemo } from 'react';
import type { WidgetTheme } from '../theme';
import { owtThemeRootProps } from '../theme';

export const ThemeContext = createContext<WidgetTheme | undefined>(undefined);

export function useWidgetTheme(): WidgetTheme | undefined {
  return useContext(ThemeContext);
}

export function useOwtThemeRootProps() {
  const theme = useWidgetTheme();
  return useMemo(() => owtThemeRootProps(theme), [theme]);
}
