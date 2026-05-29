import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useWidgetEventBus } from './useWidgetEventBus';
import { BaseWidgetConfig, WidgetGeoConfig, DataSourceRequestHandler } from '../types';
import { setValue, setValues, setDataSource } from '../store/widgetSlice';
import { getApiDataSource, transformDataSourceOptions } from '../utils/dataSource';
import { WidgetRootState } from '../store';
import { geoHierarchyBuilder } from '../utils/geoHierarchy';
import { getWidgetValue, setWidgetValue } from '../utils/pathUtils';

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

  // Keep refs updated
  useEffect(() => {
    valuesRef.current = values;
    handlerRef.current = dataSourceRequestHandler;
  }, [values, dataSourceRequestHandler]);

  // Get current value and data source options
  const currentValue = useSelector((state: WidgetRootState) => {
    // Try to get value from widgetId first (most recent selection)
    let value = state.widget.values[widgetId];
    
    // If not found in widgetId, try dataPath
    if (value === undefined && dataPath) {
      value = getWidgetValue(state.widget.values, dataPath, widgetId);
    }

    // Extract value if it's a geo hierarchy object
    if (value && typeof value === 'object' && !Array.isArray(value) && geoConfig) {
      const hierarchy = value.hierarchy || value.geo_code_hierarchy_json?.hierarchy;
      if (Array.isArray(hierarchy)) {
        const levelData = hierarchy.find((l: any) => l.level === geoConfig.level);
        if (levelData) {
          return levelData.level_value_id;
        }
      }
      
      // Extended fallbacks (matching useBaseWidget)
      if ('geo_lowest_level_value_id' in value) {
        return value.geo_lowest_level_value_id;
      }
      if ('lowest_level_value_id' in value) {
        return value.lowest_level_value_id;
      }
      if (value.geo_code_hierarchy_json?.lowest_level_value_id) {
        return value.geo_code_hierarchy_json.lowest_level_value_id;
      }
      if (value.geo_code_hierarchy_json?.geo_lowest_level_value_id) {
        return value.geo_code_hierarchy_json.geo_lowest_level_value_id;
      }
    }

    return value;
  });

  // Memoize selector to avoid returning new array reference
  const dataSourceOptions = useSelector((state: WidgetRootState) => 
    state.widget.dataSources[widgetId] ?? EMPTY_DATA_SOURCE
  );

  useEffect(() => {
    if (!geoConfig || !eventBus || !dataSource || dataSource.type !== 'api') {
      return;
    }

    const { level, isLastLevel, parentWidgetId } = geoConfig;

    // Listen to parent widget changes
    if (parentWidgetId) {
      const handleParentChange = async (event: any) => {
        if (event.widgetId !== parentWidgetId) {
          return;
        }

        // CRITICAL: Use a small delay to ensure Redux state has been updated
        // This prevents reading stale values from valuesRef
        await new Promise(resolve => setTimeout(resolve, 0));

        const currentValues = valuesRef.current;
        const currentHandler = handlerRef.current;

        // CRITICAL: Try to get parent value from event first, then from Redux
        let parentValue = event.value;
        if (parentValue === undefined || parentValue === null) {
          parentValue = currentValues[parentWidgetId];
          
          // If not found in top-level values, try to find it via dataPath or dependsOn
          if (parentValue === undefined && dataSource.dependsOn) {
            parentValue = getWidgetValue(currentValues, dataSource.dependsOn, '');
          }
        }

        // Remove this level and all below from hierarchy
        geoHierarchyBuilder.removeLevelAndBelow(level, groupId);

        // Clear this widget's value
        // CRITICAL: Only dispatch setValue for THIS widget, not for parent or other widgets
        // setWidgetValue returns the entire updated state, but we only want to update this widget
        if (dataPath) {
          const updatedValues = setWidgetValue(currentValues, dataPath, widgetId, undefined);
          // Only dispatch setValue for this widget's widgetId, not for parent or other widgets
          // This prevents accidentally overwriting the parent widget's value
          // The setWidgetValue function updates the nested structure, but we only want to
          // update the top-level widgetId key, not other keys that might be in updatedValues
          const newWidgetValue = updatedValues[widgetId];
          if (newWidgetValue !== undefined) {
            dispatch(setValue({ widgetId, value: newWidgetValue }));
          } else {
            // If widgetId is not in updatedValues, the value was set in a nested path
            // In this case, we need to use setValues to update the entire structure
            // But we need to be careful not to overwrite the parent widget's value
            // Only update keys that are related to this widget's dataPath
            const dataPathStr = typeof dataPath === 'string' ? dataPath : '';
            if (dataPathStr && !dataPathStr.startsWith(parentWidgetId + '.')) {
              // Only update if dataPath doesn't start with parentWidgetId
              // This ensures we don't accidentally overwrite the parent widget's value
              dispatch(setValue({ widgetId, value: undefined }));
            }
          }
        } else {
          dispatch(setValue({ widgetId, value: undefined }));
        }

        // Reload data source with new parent value
        // CRITICAL: Use parentValue from Redux, not event.value
        if (currentHandler && parentValue !== null && parentValue !== undefined) {
          try {
            // Merge the new parent value into current values for the API call
            // This ensures getApiDataSource can find the dependency value
            const updatedValues = {
              ...currentValues,
              [parentWidgetId]: parentValue, // Use Redux value, not event.value
            };
            
            // Extract level_id from widget-geo-config.level
            const levelId = geoConfig.level;
            const data = await getApiDataSource(dataSource, updatedValues, currentHandler!, levelId);
            
            // Transform to { value, label } format
            const valueKey = dataSource.valueKey || 'level_value_id';
            const labelKey = dataSource.labelKey || 'level_value_mnemonic';
            const transformed = transformDataSourceOptions(data, valueKey, labelKey);
            
            dispatch(setDataSource({ widgetId, data: transformed }));
          } catch (error) {
            console.error('Error reloading geo data source:', error);
            dispatch(setDataSource({ widgetId, data: [] }));
          }
        } else {
          // If parent value is cleared, clear the data source and hierarchy
          geoHierarchyBuilder.removeLevelAndBelow(level, groupId);
          dispatch(setDataSource({ widgetId, data: [] }));
        }
      };

      const unsubscribe = eventBus.subscribe('widget:change', handleParentChange);
      return () => {
        unsubscribe();
      };
    }
  }, [geoConfig, eventBus, dataSource, widgetId, dataPath, dispatch]);

  // Handle value changes to build hierarchy
  useEffect(() => {
    if (!geoConfig) {
      return;
    }

    // Skip if value is undefined (it might still be loading or rehydrating)
    // ONLY clear hierarchy if the value is explicitly null or empty string (user action)
    if (currentValue === null || currentValue === '') {
      const { level } = geoConfig;
      geoHierarchyBuilder.removeLevelAndBelow(level, groupId);
      
      // If we have a dataPath, we need to update Redux with the cleared hierarchy
      if (dataPath) {
        const hierarchyJson = geoHierarchyBuilder.buildHierarchyJson(groupId);
        let finalUpdatedValues = valuesRef.current;
        
        // Use logic similar to the build section below to update the dataPath
        if (typeof dataPath === 'string' && dataPath.endsWith('.geo_code_hierarchy_json')) {
          const prefix = dataPath.substring(0, dataPath.lastIndexOf('.'));
          finalUpdatedValues = setWidgetValue(
            finalUpdatedValues,
            dataPath,
            widgetId,
            hierarchyJson?.geo_code_hierarchy_json
          );
          finalUpdatedValues = setWidgetValue(
            finalUpdatedValues,
            `${prefix}.geo_lowest_level_value_id`,
            widgetId,
            hierarchyJson?.geo_lowest_level_value_id
          );
        } else {
          finalUpdatedValues = setWidgetValue(
            finalUpdatedValues,
            dataPath,
            widgetId,
            hierarchyJson?.geo_code_hierarchy_json
          );
        }
        dispatch(setValues(finalUpdatedValues));
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
    if (dataPath) {
      const hierarchyJson = geoHierarchyBuilder.buildHierarchyJson(groupId);
      
      if (hierarchyJson) {
        // Fix: Avoid double nesting of geo_code_hierarchy_json
        // If dataPath ends with .geo_code_hierarchy_json, we want to save the content directly to it
        // and save the lowest level ID as a sibling
        let finalUpdatedValues = valuesRef.current;
        
        if (typeof dataPath === 'string' && dataPath.endsWith('.geo_code_hierarchy_json')) {
          const prefix = dataPath.substring(0, dataPath.lastIndexOf('.'));
          
          // Save hierarchy JSON content directly to dataPath (avoiding double nesting)
          finalUpdatedValues = setWidgetValue(
            finalUpdatedValues,
            dataPath,
            widgetId,
            hierarchyJson.geo_code_hierarchy_json
          );
          
          // Save lowest level ID as sibling
          finalUpdatedValues = setWidgetValue(
            finalUpdatedValues,
            `${prefix}.geo_lowest_level_value_id`,
            widgetId,
            hierarchyJson.geo_lowest_level_value_id
          );
        } else {
          // Fallback if path doesn't follow the naming convention
          finalUpdatedValues = setWidgetValue(
            finalUpdatedValues,
            dataPath,
            widgetId,
            hierarchyJson.geo_code_hierarchy_json
          );
        }

        // CRITICAL: Use setValues for deep merge instead of replacing root keys with setValue
        // setWidgetValue returns the complete updated state object with all keys preserved
        dispatch(setValues(finalUpdatedValues));
      }
    } else if (!isLastLevel) {
      // For non-last levels, the value is already stored by handleChange in useBaseWidget
      // We don't need to dispatch setValue again here - it would cause conflicts
      // The value is stored by widget-id when handleChange is called
    }
  }, [geoConfig, currentValue, widgetId, dataPath, dispatch, dataSourceOptions]);
};
