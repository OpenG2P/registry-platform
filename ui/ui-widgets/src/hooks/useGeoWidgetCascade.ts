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
  registerGeoWidgetParent,
  unregisterGeoWidgetParent,
  isUpstreamGeoAncestor,
  seedGeoHierarchyFromValues,
} from '../utils/geoHierarchy';
import { getWidgetValue } from '../utils/pathUtils';

export interface UseGeoWidgetCascadeOptions {
  config: BaseWidgetConfig;
  dataSourceRequestHandler?: DataSourceRequestHandler;
  values: Record<string, any>;
}

// Define stable empty array to avoid selector reference issues
const EMPTY_DATA_SOURCE: any[] = [];

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

  // Keep refs updated
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
  const dataSourceOptions = useSelector((state: WidgetRootState) => 
    state.widget.dataSources[widgetId] ?? EMPTY_DATA_SOURCE
  );

  // Register parent chain for upstream-ancestor detection (grandparent → grandchild reset)
  useEffect(() => {
    if (!geoConfig) {
      return;
    }
    registerGeoWidgetParent(widgetId, geoConfig.parentWidgetId);
    return () => unregisterGeoWidgetParent(widgetId);
  }, [widgetId, geoConfig]);

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

      // Grandparent (or higher) changed: clear this level; only immediate parent drives reload
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

  // Handle value changes to build hierarchy
  useEffect(() => {
    if (!geoConfig) {
      return;
    }

    // Skip if value is undefined (it might still be loading or rehydrating)
    // ONLY clear hierarchy if the value is explicitly null or empty string (user action)
    if (currentValue === null || currentValue === '') {
      const { level, isLastLevel } = geoConfig;
      geoHierarchyBuilder.removeLevelAndBelow(level, groupId);
      
      // If we have a dataPath, we need to update Redux with the cleared hierarchy
      if (dataPath) {
        dispatch(
          setValues(
            applySharedGeoHierarchyToValues(valuesRef.current, groupId, dataPath, widgetId)
          )
        );
      }
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
      return; // Skip if undefined (still initializing)
    }

    const { level, isLastLevel } = geoConfig;
    
    // Check if hierarchy is already built to prevent endless loops
    if (dataPath) {
      const currentHierarchy = getWidgetValue(valuesRef.current, dataPath, widgetId);
      // If hierarchy JSON is already set and matches current value, skip rebuilding
      if (currentHierarchy && typeof currentHierarchy === 'object') {
        // Check if this specific level's value matches the hierarchy
        const hierarchyArray = currentHierarchy.hierarchy || currentHierarchy.geo_code_hierarchy_json?.hierarchy;
        
        if (Array.isArray(hierarchyArray)) {
          const currentLevelValue = typeof currentValue === 'object' 
            ? (currentValue.level_value_id || currentValue.id || currentValue.value)
            : currentValue;
          
          const levelData = hierarchyArray.find((l: any) => l.level === geoConfig.level);
          
          // If this level is already correctly represented in the hierarchy, skip rebuilding
          // String conversion ensures comparison works for mixed types
          if (levelData && String(levelData.level_value_id) === String(currentLevelValue)) {
            return;
          }
        }
      }
    }

    // Extract level_value_id and level_value_mnemonic from current value
    // The value could be the ID itself or an object with id/name
    let level_value_id: string;
    let level_value_mnemonic: string;

    if (typeof currentValue === 'string' || typeof currentValue === 'number') {
      // Value is just the ID, need to find mnemonic from data source
      level_value_id = String(currentValue);
      // Try to get mnemonic from data source options
      const option = dataSourceOptions.find((opt: any) => opt.value === currentValue);
      level_value_mnemonic = option?.label || String(currentValue);
    } else if (currentValue && typeof currentValue === 'object') {
      level_value_id = currentValue.level_value_id || currentValue.id || currentValue.value;
      level_value_mnemonic = currentValue.level_value_mnemonic || currentValue.name || currentValue.label;
    } else {
      return;
    }

    // When a widget's own value changes, remove this level and all below from hierarchy first
    geoHierarchyBuilder.removeLevelAndBelow(level, groupId);
    
    // Add level to hierarchy
    geoHierarchyBuilder.addLevel(level, level_value_id, level_value_mnemonic, groupId);

    // Build and store hierarchy JSON on every change
    if (dataPath && geoHierarchyBuilder.buildHierarchyJson(groupId)) {
      dispatch(
        setValues(
          applySharedGeoHierarchyToValues(valuesRef.current, groupId, dataPath, widgetId)
        )
      );
    }
  }, [geoConfig, currentValue, widgetId, dataPath, dispatch, dataSourceOptions, groupId]);
};
