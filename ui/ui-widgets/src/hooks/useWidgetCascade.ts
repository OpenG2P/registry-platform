import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useWidgetEventBus } from './useWidgetEventBus';
import { BaseWidgetConfig, WidgetCascadeConfig, DataSourceRequestHandler } from '../types';
import { setValue, setDataSource } from '../store/widgetSlice';
import { getApiDataSource, transformDataSourceOptions } from '../utils/dataSource';
import { useSelector } from 'react-redux';
import { WidgetRootState } from '../store';

export interface UseWidgetCascadeOptions {
  config: BaseWidgetConfig;
  dataSourceRequestHandler?: DataSourceRequestHandler;
  values: Record<string, any>;
}

/**
 * Hook for general widget cascade functionality
 * Handles listening to parent widget changes and reloading data sources
 */
export const useWidgetCascade = (options: UseWidgetCascadeOptions) => {
  const { config, dataSourceRequestHandler, values } = options;
  const dispatch = useDispatch();
  const eventBus = useWidgetEventBus();
  const widgetId = config['widget-id'];
  const cascadeConfig = config['widget-cascade'];
  const dataSource = config['widget-data-source'];

  const valuesRef = useRef(values);
  const handlerRef = useRef(dataSourceRequestHandler);

  useEffect(() => {
    valuesRef.current = values;
    handlerRef.current = dataSourceRequestHandler;
  }, [values, dataSourceRequestHandler]);

  useEffect(() => {
    if (!cascadeConfig || !eventBus || !dataSource || dataSource.type !== 'api') {
      return;
    }

    const { listenTo, onEvent = 'widget:change', clearOnChange = true, reloadOnChange = true, debounce, throttle } = cascadeConfig;

    if (listenTo.length === 0) {
      return;
    }

    const handleEvent = async (event: any) => {
      if (!listenTo.includes(event.widgetId)) {
        return;
      }

      const currentValues = valuesRef.current;
      const currentHandler = handlerRef.current;

      if (clearOnChange) {
        dispatch(setValue({ widgetId, value: undefined }));
      }

      if (reloadOnChange && currentHandler) {
        try {
          const data = await getApiDataSource(dataSource, currentValues, currentHandler!);
          
          const valueKey = dataSource.valueKey;
          const labelKey = dataSource.labelKey;
          const transformed = transformDataSourceOptions(data, valueKey, labelKey);
          
          dispatch(setDataSource({ widgetId, data: transformed }));
        } catch (error) {
          console.error('Error reloading data source in cascade:', error);
          dispatch(setDataSource({ widgetId, data: [] }));
        }
      }
    };

    const unsubscribe = eventBus.subscribe(
      onEvent as any,
      handleEvent,
      { debounce, throttle }
    );

    return () => {
      unsubscribe();
    };
  }, [cascadeConfig, eventBus, dataSource, widgetId, dispatch]);
};
