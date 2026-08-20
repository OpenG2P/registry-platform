import { useEffect, useCallback, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { BaseWidgetConfig, DataSourceRequestHandler } from '../types';
import { WidgetRootState } from '../store';
import { setValue, setValues, setError, setTouched, setLoading, setDataSource } from '../store/widgetSlice';
import { getWidgetValue, setWidgetValue } from '../utils/pathUtils';
import { validateDocsWidget, validateWidget } from '../utils/validation';
import { shouldShowWidget, shouldEnableWidget, evaluateWidgetConditions, hasVisibilityRules } from '../utils/conditions';
import { formatValue } from '../utils/formatting';
import {
  getStaticDataSource,
  getApiDataSource,
  getCachedApiDataSource,
  getSchemaDataSource,
  transformDataSourceOptions,
} from '../utils/dataSource';
import { useWidgetEventBus } from './useWidgetEventBus';
import { useWidgetContext } from '../components/WidgetProvider';

export interface UseBaseWidgetOptions {
  config: BaseWidgetConfig;
  dataSourceRequestHandler?: DataSourceRequestHandler; // Required for widgets with API data sources
  schemaData?: Record<string, any>;
  onValueChange?: (widgetId: string, value: any) => void;
}

const EMPTY_ERRORS: string[] = [];
const EMPTY_DATA_SOURCE: any[] = [];

export const useBaseWidget = (options: UseBaseWidgetOptions) => {
  const { config, dataSourceRequestHandler: propHandler, schemaData, onValueChange } = options;
  const dispatch = useDispatch();
  const context = useWidgetContext();
  const eventBus = useWidgetEventBus();
  const widgetId = config['widget-id'];

  const dataSourceRequestHandler = propHandler || context.dataSourceRequestHandler;

  const values = useSelector((state: WidgetRootState) => state.widget.values);
  const errors = useSelector((state: WidgetRootState) => state.widget.errors[widgetId] ?? EMPTY_ERRORS);
  const touched = useSelector((state: WidgetRootState) => state.widget.touched[widgetId] || false);
  const loading = useSelector((state: WidgetRootState) => state.widget.loading[widgetId] || false);
  const dataSourceOptions = useSelector(
    (state: WidgetRootState) => state.widget.dataSources[widgetId] ?? EMPTY_DATA_SOURCE
  );

  const isLayoutWidget = config['widget-type'] === 'layout';
  const isDocsWidget = config.widget === 'docs';

  const userHasSetValueRef = useRef(false);

  const valuesRef = useRef(values);
  const loadingRef = useRef(loading);
  const dataSourceOptionsRef = useRef(dataSourceOptions);
  useEffect(() => {
    valuesRef.current = values;
    loadingRef.current = loading;
    dataSourceOptionsRef.current = dataSourceOptions;
  }, [values, loading, dataSourceOptions]);

  const lastDispatchedValueRef = useRef<any>(null);

  const extractValueFromObject = useCallback((obj: any): any => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return obj;
    }

    if ('value' in obj) {
      return obj.value;
    }
    if ('id' in obj) {
      return obj.id;
    }
    if ('label' in obj) {
      return obj.label;
    }
    if ('name' in obj) {
      return obj.name;
    }

    return undefined;
  }, []);

  const currentValue = useMemo(() => {
    if (isLayoutWidget) {
      return undefined; // Layout widgets don't have values
    }

    if (isDocsWidget) {
      let docsValue = values[widgetId];
      if (docsValue === undefined && config['widget-data-path']) {
        docsValue = getWidgetValue(values, config['widget-data-path'], widgetId);
      }
      if (userHasSetValueRef.current) {
        return docsValue;
      }
      if (docsValue === null) {
        return null;
      }
      return docsValue !== undefined ? docsValue : config['widget-data-default'];
    }

    let value = values[widgetId];

    if (value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
      value = extractValueFromObject(value);
    }

    if (value === undefined && config['widget-data-path']) {
      value = getWidgetValue(values, config['widget-data-path'], widgetId);

      if (value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
        value = extractValueFromObject(value);
      }
    }

    if (value === undefined && userHasSetValueRef.current && values[widgetId] !== undefined) {
      value = values[widgetId];
      if (value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
        value = extractValueFromObject(value);
      }
    }

    if (value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
      value = extractValueFromObject(value);
    }

    if (userHasSetValueRef.current) {
      return value;
    }

    if (value === null) {
      return null; // User explicitly cleared it, don't use default
    }

    return value !== undefined ? value : config['widget-data-default'];
  }, [values, config, widgetId, isLayoutWidget, isDocsWidget, extractValueFromObject]);

  const lastMirroredValueRef = useRef<any>(null);

  // Mirror value from dataPath to widgetId in Redux state if it's not already there.
  // This is essential for widgets that depend on this widget via 'dependsOn' using its widgetId,
  // CRITICAL: This ensures that dependencies are resolved correctly when entering Edit mode.
  useEffect(() => {
    if (isLayoutWidget || isDocsWidget || !config['widget-data-path']) {
      return;
    }

    const rawValue = getWidgetValue(values, config['widget-data-path'], widgetId);
    if (rawValue !== undefined && rawValue !== null) {
      const extractedValue = extractValueFromObject(rawValue);
      if (
        values[widgetId] === undefined &&
        extractedValue !== undefined &&
        extractedValue !== null &&
        lastMirroredValueRef.current !== extractedValue
      ) {
        lastMirroredValueRef.current = extractedValue;
        dispatch(setValue({ widgetId, value: extractedValue }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, config['widget-data-path'], widgetId, isLayoutWidget]);

  useEffect(() => {
    if (isLayoutWidget) {
      return;
    }
    if (!userHasSetValueRef.current && config['widget-data-default'] !== undefined && currentValue === undefined) {
      handleChange(config['widget-data-default'], false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLayoutWidget]); // Only run once on mount

  const resolveIsRequired = useCallback(
    (currentValues: Record<string, any>) => {
      if (isLayoutWidget) {
        return false;
      }
      if (config['widget-readonly']) {
        return false;
      }
      return evaluateWidgetConditions(
        config['widget-data-options'],
        currentValues,
        config['widget-required'] ?? false,
      ).required;
    },
    [config, isLayoutWidget],
  );

  // CRITICAL: Don't include 'values' in dependency array - it causes the callback to be recreated
  const handleChange = useCallback(
    (newValue: any, validate: boolean = true) => {
      const currentValues = valuesRef.current;
      const currentValue = currentValues[widgetId] || getWidgetValue(currentValues, config['widget-data-path'], widgetId);

      // CRITICAL: Prevent setting the same value (avoids unnecessary dispatches and potential loops)
      if (currentValue === newValue) {
        return;
      }

      // CRITICAL FIX: Ignore auto-clears (empty string or undefined) from UI components 
      // when the widget's data source is currently loading OR if options are empty.
      // This prevents data disappearance when switching to Edit mode and components 
      // incorrectly clear values before options load or if handler is temporarily missing.
      if (newValue === '' || newValue === null || newValue === undefined) {
        const allowEmptyClear =
          config.widget === 'register-lookup' || config.widget === 'parent-lookup';
        if (!allowEmptyClear) {
          if (loadingRef.current) {
            console.warn(`[useBaseWidget] Ignoring empty value for ${widgetId} because data source is loading`);
            return;
          }
          if (config['widget-data-source']?.type === 'api' && dataSourceOptionsRef.current.length === 0) {
            console.warn(`[useBaseWidget] Ignoring empty value for ${widgetId} because API options are empty`);
            return;
          }
        }
      }

      if (newValue !== config['widget-data-default'] || userHasSetValueRef.current) {
        userHasSetValueRef.current = true;
      }

      // CRITICAL FIX: If there's no dataPath, just set the value directly
      if (!config['widget-data-path']) {
        // CRITICAL: Check if we just dispatched this value to prevent duplicate dispatches
        if (lastDispatchedValueRef.current === newValue) {
          return;
        }
        lastDispatchedValueRef.current = newValue;
        dispatch(setValue({ widgetId, value: newValue }));
      } else {
        const currentValuesWithUpdate = {
          ...valuesRef.current,
          [widgetId]: newValue,
        };
        const updatedValues = setWidgetValue(
          currentValuesWithUpdate,
          config['widget-data-path'],
          widgetId,
          newValue
        );
        dispatch(setValues(updatedValues));
      }

      if (validate) {
        const validationErrors = isDocsWidget
          ? validateDocsWidget(newValue, config['documents'])
          : validateWidget(
              newValue,
              config['widget-data-validation'],
              resolveIsRequired(currentValues)
            );
        dispatch(setError({ widgetId, errors: validationErrors }));
      }

      if (onValueChange) {
        onValueChange(widgetId, newValue);
      }

      if (eventBus) {
        eventBus.publish({
          type: 'widget:change',
          widgetId,
          value: newValue,
          timestamp: Date.now(),
        });
      }
    },
    [config, widgetId, dispatch, onValueChange, eventBus, resolveIsRequired, isDocsWidget]
  );

  const handleBlur = useCallback(() => {
    dispatch(setTouched({ widgetId, touched: true }));
    const latestValues = valuesRef.current;
    const valueToValidate = isDocsWidget
      ? latestValues[widgetId] ?? getWidgetValue(latestValues, config['widget-data-path'], widgetId)
      : currentValue;
    const validationErrors = isDocsWidget
      ? validateDocsWidget(valueToValidate, config['documents'])
      : validateWidget(
          valueToValidate,
          config['widget-data-validation'],
          resolveIsRequired(latestValues)
        );
    dispatch(setError({ widgetId, errors: validationErrors }));

    if (eventBus) {
      eventBus.publish({
        type: 'widget:blur',
        widgetId,
        value: currentValue,
        timestamp: Date.now(),
      });
    }
  }, [currentValue, config, widgetId, dispatch, eventBus, resolveIsRequired, isDocsWidget]);

  const getFieldValue = useCallback(
    (path: string) => {
      return getWidgetValue(values, path, '');
    },
    [values]
  );

  const isVisible = useMemo(() => {
    if (isLayoutWidget && !hasVisibilityRules(config['widget-data-options'])) {
      return true;
    }
    return shouldShowWidget(config['widget-data-options'], values);
  }, [config['widget-data-options'], values, isLayoutWidget]);

  const isEnabled = useMemo(() => {
    if (isLayoutWidget) {
      return true;
    }
    if (config['widget-readonly']) {
      return false;
    }
    return shouldEnableWidget(config['widget-data-options'], values);
  }, [config['widget-readonly'], config['widget-data-options'], values, isLayoutWidget]);

  const isRequired = useMemo(
    () => resolveIsRequired(values),
    [resolveIsRequired, values],
  );

  const formattedValue = useMemo(() => {
    if (!config['widget-data-format']) {
      return currentValue;
    }
    return formatValue(currentValue, config['widget-data-format'], config.widget);
  }, [currentValue, config]);

  const isReadonly = config['widget-readonly'] ?? false;

  useEffect(() => {
    if (config['widget-readonly']) {
      userHasSetValueRef.current = false;
      lastMirroredValueRef.current = null;
      lastDispatchedValueRef.current = null;
    }
  }, [config['widget-readonly']]);
  const dataSource = config['widget-data-source'];

  const handlerRef = useRef(dataSourceRequestHandler);
  useEffect(() => {
    handlerRef.current = dataSourceRequestHandler;
  }, [dataSourceRequestHandler]);

  const apiService = dataSource?.type === 'api' ? (dataSource as any).service : '';
  const apiEndpoint = dataSource?.type === 'api' ? (dataSource as any).endpoint : '';
  const configKey = `${widgetId}-${isReadonly}-${dataSource?.type || 'none'}-${apiService}-${apiEndpoint}`;

  const schemaDataKey = useMemo(
    () => (schemaData ? JSON.stringify(schemaData) : ''),
    [schemaData],
  );

  const dependencyValue = useSelector((state: WidgetRootState) => {
    if (dataSource?.type !== 'api' || !dataSource.dependsOn) {
      return null;
    }
    if (dataSource.dependsOn.includes('.')) {
      return getWidgetValue(state.widget.values, dataSource.dependsOn, '');
    }
    return state.widget.values[dataSource.dependsOn];
  });

  useEffect(() => {
    if (!dataSource) {
      return;
    }

    const loadApiInReadonly = ['select', 'radio', 'checkbox', 'multi-select'].includes(config.widget);
    if (dataSource.type === 'api' && isReadonly && !loadApiInReadonly) {
      return;
    }

    if (dataSource.type === 'api' && dataSource.dependsOn) {
      let depValue: any = null;
      if (dataSource.dependsOn.includes('.')) {
        depValue = getWidgetValue(values, dataSource.dependsOn, '');
      } else {
        depValue = values[dataSource.dependsOn];

        if (
          (depValue === undefined || depValue === null || depValue === '') &&
          typeof config['widget-data-path'] === 'string' &&
          config['widget-data-path'].includes('.')
        ) {
          const pathParts = config['widget-data-path'].split('.');
          pathParts.pop(); // Remove current field name
          const prefix = pathParts.join('.');
          const tryPath = `${prefix}.${dataSource.dependsOn}`;
          depValue = getWidgetValue(values, tryPath, '');
        }
      }

      if (depValue === null || depValue === undefined || depValue === '') {
        return;
      }
    }

    const loadDataSource = async () => {
      const currentHandler = handlerRef.current || dataSourceRequestHandler;

      try {
        if (dataSource.type === 'api' && !currentHandler) {
          return;
        }

        const resolveOptionKeys = () => {
          if (dataSource.type === 'static') {
            return { valueKey: undefined, labelKey: undefined };
          }
          return { valueKey: dataSource.valueKey, labelKey: dataSource.labelKey };
        };

        if (dataSource.type === 'api') {
          const cached = getCachedApiDataSource(dataSource, valuesRef.current);
          if (cached) {
            const { valueKey, labelKey } = resolveOptionKeys();
            dispatch(setDataSource({
              widgetId,
              data: transformDataSourceOptions(cached, valueKey, labelKey),
            }));
            return;
          }
        }

        dispatch(setLoading({ widgetId, loading: true }));

        let data: any[] = [];

        if (dataSource.type === 'static') {
          data = getStaticDataSource(dataSource);
        } else if (dataSource.type === 'api') {
          if (!currentHandler) {
            dispatch(setLoading({ widgetId, loading: false }));
            dispatch(setDataSource({ widgetId, data: [] }));
            return;
          }
          data = await getApiDataSource(dataSource, valuesRef.current, currentHandler);
        } else if (dataSource.type === 'schema') {
          data = getSchemaDataSource(dataSource, schemaData || {});
        }

        const { valueKey, labelKey } = resolveOptionKeys();
        const transformed = transformDataSourceOptions(
          data,
          valueKey,
          labelKey
        );

        dispatch(setDataSource({ widgetId, data: transformed }));
      } catch (error) {
        console.error(
          `[useBaseWidget] ERROR loading data source for widget "${widgetId}" (type="${dataSource.type}"):`,
          error,
          '\nWidget config:', config,
          '\ndataSourceRequestHandler provided:', Boolean(dataSourceRequestHandler),
        );
        dispatch(setDataSource({ widgetId, data: [] }));
      } finally {
        dispatch(setLoading({ widgetId, loading: false }));
      }
    };

    loadDataSource();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey, dependencyValue, dataSourceRequestHandler, schemaDataKey, widgetId, dispatch]);

  return {
    widgetId,
    value: currentValue,
    formattedValue,
    error: errors,
    touched,
    loading,
    isVisible,
    isEnabled,
    isRequired,
    onChange: handleChange,
    onBlur: handleBlur,
    setError: (errors: string[]) => dispatch(setError({ widgetId, errors })),
    getFieldValue,
    dataSourceOptions,
    config,
  };
};
