import { createContext, useContext, type ReactNode, useEffect, useMemo } from 'react';
import { Provider } from 'react-redux';
import { DataSourceRequestHandler } from '../types';
import { createWidgetStore, WidgetStore } from '../store';
import { setValues } from '../store/widgetSlice';
import { WidgetEventBus } from '../events/WidgetEventBus';
import { WidgetEventBusContext } from '../hooks/useWidgetEventBus';
import { WidgetTheme, themeToCSSVariables, OWT_FIELD_STYLES } from '../theme';
import { ThemeContext } from '../hooks/useWidgetTheme';

export interface WidgetProviderProps {
  store?: WidgetStore;
  dataSourceRequestHandler?: DataSourceRequestHandler;
  schemaData?: Record<string, any>;
  hostContext?: Record<string, string | undefined>;
  t?: (key: string, options?: any) => string;
  theme?: WidgetTheme;
  children: ReactNode;
}

const WidgetContext = createContext<{
  dataSourceRequestHandler?: DataSourceRequestHandler;
  schemaData?: Record<string, any>;
  hostContext?: Record<string, string | undefined>;
  t?: (key: string, options?: any) => string;
}>({
  dataSourceRequestHandler: undefined,
  schemaData: undefined,
  hostContext: undefined,
  t: undefined,
});

export const useWidgetContext = () => {
  return useContext(WidgetContext);
};

export const WidgetProvider = ({
  store,
  dataSourceRequestHandler,
  schemaData,
  hostContext,
  t,
  theme,
  children,
}: WidgetProviderProps) => {
  const parent = useWidgetContext();
  const parentTheme = useContext(ThemeContext);
  const resolvedTheme = theme ?? parentTheme;
  const resolvedT = t ?? parent.t;
  const resolvedHandler = dataSourceRequestHandler ?? parent.dataSourceRequestHandler;
  const resolvedHostContext = hostContext ?? parent.hostContext;
  const widgetStore = useMemo(() => store || createWidgetStore(), [store]);
  const eventBus = useMemo(() => new WidgetEventBus(), []);
  const cssVariables = useMemo(() => themeToCSSVariables(resolvedTheme), [resolvedTheme]);

  const contextValue = useMemo(
    () => ({
      dataSourceRequestHandler: resolvedHandler,
      schemaData,
      hostContext: resolvedHostContext,
      t: resolvedT,
    }),
    [resolvedHandler, schemaData, resolvedHostContext, resolvedT]
  );

  useEffect(() => {
    if (!resolvedHandler) {
      console.warn(
        '[WidgetProvider] dataSourceRequestHandler is not provided. ' +
        'Widgets with API data sources will not be able to load data. ' +
        'Please provide dataSourceRequestHandler prop to WidgetProvider.'
      );
    }
  }, [resolvedHandler]);

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
              <style className="owt-field-styles">{OWT_FIELD_STYLES}</style>
              {children}
            </div>
          </WidgetEventBusContext.Provider>
        </WidgetContext.Provider>
      </ThemeContext.Provider>
    </Provider>
  );
};
