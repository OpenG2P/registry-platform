import { createContext, useContext, type ReactNode, useEffect, useMemo } from 'react';
import { Provider } from 'react-redux';
import { DataSourceRequestHandler } from '../types';
import { createWidgetStore, WidgetStore } from '../store';
import { setValues } from '../store/widgetSlice';
import { WidgetEventBus } from '../events/WidgetEventBus';
import { WidgetEventBusContext } from '../hooks/useWidgetEventBus';
import { WidgetTheme, resolveTheme, themeToCSSVariables } from '../theme';
import { ThemeContext } from '../hooks/useWidgetTheme';

export interface WidgetProviderProps {
  store?: WidgetStore;
  dataSourceRequestHandler?: DataSourceRequestHandler;
  schemaData?: Record<string, any>;
  t?: (key: string, options?: any) => string;
  theme?: WidgetTheme;
  children: ReactNode;
}

const WidgetContext = createContext<{
  dataSourceRequestHandler?: DataSourceRequestHandler;
  schemaData?: Record<string, any>;
  t?: (key: string, options?: any) => string;
}>({
  dataSourceRequestHandler: undefined,
  schemaData: undefined,
  t: undefined,
});

export const useWidgetContext = () => {
  return useContext(WidgetContext);
};

export const WidgetProvider = ({
  store,
  dataSourceRequestHandler,
  schemaData,
  t,
  theme,
  children,
}: WidgetProviderProps) => {
  const widgetStore = useMemo(() => store || createWidgetStore(), [store]);
  const eventBus = useMemo(() => new WidgetEventBus(), []);
  const resolvedTheme = useMemo(() => resolveTheme(theme), [theme]);
  const cssVariables = useMemo(() => themeToCSSVariables(resolvedTheme), [resolvedTheme]);

  const contextValue = useMemo(
    () => ({
      dataSourceRequestHandler,
      schemaData,
      t,
    }),
    [dataSourceRequestHandler, schemaData, t]
  );

  useEffect(() => {
    if (!dataSourceRequestHandler) {
      console.warn(
        '[WidgetProvider] dataSourceRequestHandler is not provided. ' +
        'Widgets with API data sources will not be able to load data. ' +
        'Please provide dataSourceRequestHandler prop to WidgetProvider.'
      );
    }
  }, [dataSourceRequestHandler]);

  useEffect(() => {
    return () => {
      eventBus.clear();
    };
  }, [eventBus]);

  useEffect(() => {
    if (schemaData) {
      widgetStore.dispatch(setValues(schemaData));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemaData, widgetStore]);

  return (
    <Provider store={widgetStore}>
      <ThemeContext.Provider value={resolvedTheme}>
        <WidgetContext.Provider value={contextValue}>
          <WidgetEventBusContext.Provider value={eventBus}>
            <div className="openg2p-widget-theme-root" style={cssVariables}>
              {children}
            </div>
          </WidgetEventBusContext.Provider>
        </WidgetContext.Provider>
      </ThemeContext.Provider>
    </Provider>
  );
};
