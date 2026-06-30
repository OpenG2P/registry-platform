import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useWidgetEventBus } from './useWidgetEventBus';
import { BaseWidgetConfig, DataSourceRequestHandler } from '../types';
import { setValue, setValues, setDataSource } from '../store/widgetSlice';
import { getApiDataSource, transformDataSourceOptions } from '../utils/dataSource';
import { WidgetRootState } from '../store';
import {
  geoHierarchyBuilder,
  applySharedGeoHierarchyToValues,
  resolveGeoWidgetLevelValue,
  GEO_LEVEL_CLEARED,
  registerGeoWidget,
  unregisterGeoWidget,
  isUpstreamGeoAncestor,
  seedGeoHierarchyFromValues,
  rebuildGeoHierarchyFromRegistrations,
  getGeoWidgetRegistrationsInGroup,
  createGeoLevelMnemonicResolver,
} from '../utils/geoHierarchy';
import { getWidgetValue } from '../utils/pathUtils';

export interface UseGeoWidgetCascadeOptions {
  config: BaseWidgetConfig;
  dataSourceRequestHandler?: DataSourceRequestHandler;
  values: Record<string, any>;
}


/**
 * Hook for geo widget cascade functionality
 * Handles geo hierarchy building and cascade behavior
 */
export const useGeoWidgetCascade = (options: UseGeoWidgetCascadeOptions) => {
  const { config, dataSourceRequestHandler, values } = options;
  const dispatch = useDispatch();
  const eventBus = useWidgetEventBus();
  const widgetId = config['widget-id'];
  const geoConfig = config['widget-geo-config'];
  const dataSource = config['widget-data-source'];
  const dataPath = config['widget-data-path'];
  const groupId = typeof dataPath === 'string' && dataPath.includes('.') 
    ? dataPath.split('.').slice(0, -1).join('.') 
    : 'default';

  const valuesRef = useRef(values);
  const handlerRef = useRef(dataSourceRequestHandler);
  const lastCascadePublishRef = useRef<string | null | undefined>(undefined);
  const lastDirectParentValueRef = useRef<any>(undefined);

  useEffect(() => {
    valuesRef.current = values;
    handlerRef.current = dataSourceRequestHandler;
  }, [values, dataSourceRequestHandler]);

  // Get current value and data source options
  const currentValue = useSelector((state: WidgetRootState) =>
    geoConfig
      ? resolveGeoWidgetLevelValue(state.widget.values, widgetId, dataPath, geoConfig)
      : state.widget.values[widgetId]
  );

  // Memoize selector to avoid returning new array reference
  const allDataSources = useSelector((state: WidgetRootState) => state.widget.dataSources);

  // Register parent chain for upstream-ancestor detection (grandparent → grandchild reset)
  useEffect(() => {
    if (!geoConfig || typeof dataPath !== 'string') {
      return;
    }
    registerGeoWidget(widgetId, geoConfig, dataPath);
    return () => unregisterGeoWidget(widgetId);
  }, [widgetId, geoConfig, dataPath]);

  // Keep in-memory builder in sync with persisted hierarchy (reload, cancel→re-edit, etc.)
  useEffect(() => {
    if (!geoConfig || typeof dataPath !== 'string') {
      return;
    }
    seedGeoHierarchyFromValues(values, dataPath, widgetId, groupId);
  }, [geoConfig, dataPath, widgetId, groupId, values]);

  useEffect(() => {
    if (!geoConfig || !eventBus || !dataSource || dataSource.type !== 'api') {
      return;
    }

    const { level, isLastLevel, parentWidgetId: rawParentWidgetId } = geoConfig;
    const parentWidgetId = rawParentWidgetId || null;

    if (!parentWidgetId) {
      return;
    }

    const clearThisLevel = (baseValues: Record<string, any>) => {
      geoHierarchyBuilder.removeLevelAndBelow(level, groupId);
      if (dataPath) {
        dispatch(
          setValues(applySharedGeoHierarchyToValues(baseValues, groupId, dataPath, widgetId))
        );
      }
      dispatch(setValue({ widgetId, value: GEO_LEVEL_CLEARED }));
      if (!isLastLevel) {
        eventBus.publish({
          type: 'widget:change',
          widgetId,
          value: GEO_LEVEL_CLEARED,
          timestamp: Date.now(),
        });
      }
      dispatch(setDataSource({ widgetId, data: [] }));
    };

    const handleParentChange = async (event: any) => {
      const isDirectParent = event.widgetId === parentWidgetId;
      const isAncestor = isUpstreamGeoAncestor(event.widgetId, widgetId, parentWidgetId);
      if (!isDirectParent && !isAncestor) {
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 0));

      const currentValues = valuesRef.current;
      const currentHandler = handlerRef.current;

      if (isAncestor && !isDirectParent) {
        clearThisLevel(currentValues);
        return;
      }

      const parentCleared =
        event.value === undefined ||
        event.value === null ||
        event.value === '' ||
        event.value === GEO_LEVEL_CLEARED;

      const isFirstParentEvent = lastDirectParentValueRef.current === undefined;
      const parentValueChanged =
        !isFirstParentEvent &&
        lastDirectParentValueRef.current !== event.value;
      lastDirectParentValueRef.current = event.value;

      if (!parentCleared && !parentValueChanged && !isFirstParentEvent) {
        return;
      }

      let parentValue = event.value;
      if (!parentCleared && (parentValue === undefined || parentValue === null)) {
        parentValue = currentValues[parentWidgetId];
        if (parentValue === undefined && dataSource.dependsOn) {
          parentValue = getWidgetValue(currentValues, dataSource.dependsOn, '');
        }
      }

      clearThisLevel(currentValues);

      if (currentHandler && parentValue !== null && parentValue !== undefined && parentValue !== '') {
        try {
          const updatedValues = {
            ...currentValues,
            [parentWidgetId]: parentValue,
          };
          const levelId = geoConfig.level;
          const data = await getApiDataSource(dataSource, updatedValues, currentHandler!, levelId);
          const valueKey = dataSource.valueKey || 'level_value_id';
          const labelKey = dataSource.labelKey || 'level_value_mnemonic';
          const transformed = transformDataSourceOptions(data, valueKey, labelKey);
          dispatch(setDataSource({ widgetId, data: transformed }));
        } catch (error) {
          console.error('Error reloading geo data source:', error);
          dispatch(setDataSource({ widgetId, data: [] }));
        }
      }
    };

    const unsubscribe = eventBus.subscribe('widget:change', handleParentChange);
    return () => {
      unsubscribe();
    };
  }, [geoConfig, eventBus, dataSource, widgetId, dataPath, dispatch, groupId]);

  useEffect(() => {
    if (!geoConfig || typeof dataPath !== 'string') {
      return;
    }

    const { level, isLastLevel } = geoConfig;
    const groupRegistrations = getGeoWidgetRegistrationsInGroup(groupId);

    const applyGroupRebuild = () => {
      const resolveMnemonic = createGeoLevelMnemonicResolver(valuesRef.current, allDataSources);
      rebuildGeoHierarchyFromRegistrations(
        groupId,
        valuesRef.current,
        groupRegistrations,
        resolveMnemonic
      );
      dispatch(
        setValues(
          applySharedGeoHierarchyToValues(valuesRef.current, groupId, dataPath, widgetId)
        )
      );
    };

    if (currentValue === null || currentValue === '') {
      geoHierarchyBuilder.removeLevelAndBelow(level, groupId);
      applyGroupRebuild();

      if (!isLastLevel && eventBus && lastCascadePublishRef.current !== GEO_LEVEL_CLEARED) {
        lastCascadePublishRef.current = GEO_LEVEL_CLEARED;
        eventBus.publish({
          type: 'widget:change',
          widgetId,
          value: GEO_LEVEL_CLEARED,
          timestamp: Date.now(),
        });
      }
      return;
    }

    if (currentValue === undefined) {
      const hasOwnValue = Object.prototype.hasOwnProperty.call(valuesRef.current, widgetId);
      if (!hasOwnValue) {
        return;
      }
    }

    applyGroupRebuild();
  }, [geoConfig, currentValue, widgetId, dataPath, dispatch, allDataSources, groupId, eventBus]);
};
