import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { BaseWidgetConfig, isGeoHierarchyDataSource } from '../types';
import { useBaseWidget } from './useBaseWidget';
import { useWidgetContext } from '../components/WidgetProvider';
import { WidgetRootState } from '../store';
import { getValueByPath } from '../utils/pathUtils';
import {
  GeoLevel,
  GeoLevelValue,
  GeoSelectOption,
  buildHierarchyJson,
  buildOrderedLevels,
  buildReadonlyPath,
  chainMatchesStoredValue,
  clearDescendants,
  formatHierarchyForPersist,
  resolveHierarchyJsonPath,
  formatLevelLabel,
  getDeepestSelectedValue,
  isLevelEnabled,
  mapChainToSelections,
  mapHierarchyToChain,
  normalizeApiPayload,
  parseHierarchyJson,
  resolveGeoLevelColumns,
  transformGeoValueOptions,
} from '../utils/geoHierarchy';

interface UseGeoHierarchyOptions {
  config: BaseWidgetConfig;
}

const sharedLevelsCache: { current: GeoLevel[] | null } = { current: null };
const sharedValuesCache = new Map<string, GeoLevelValue[]>();
const sharedValuesInflight = new Map<string, Promise<GeoLevelValue[]>>();

function resolveHierarchyPath(config: BaseWidgetConfig): string | null {
  return resolveHierarchyJsonPath(
    config['widget-data-path'],
    config['widget-geo-hierarchy-path'],
  );
}

function resolveDataPath(config: BaseWidgetConfig): string | null {
  const dataPath = config['widget-data-path'];
  if (typeof dataPath === 'string') {
    return dataPath;
  }
  if (dataPath && typeof dataPath === 'object' && typeof dataPath.value === 'string') {
    return dataPath.value;
  }
  return null;
}

function readPathValue(source: Record<string, unknown> | undefined, path: string | null): unknown {
  if (!source || !path) {
    return undefined;
  }
  return getValueByPath(source, path);
}

export function useGeoHierarchy({ config }: UseGeoHierarchyOptions) {
  const isReadonly = Boolean(config['widget-readonly']);
  const base = useBaseWidget({ config });
  const { dataSourceRequestHandler, schemaData } = useWidgetContext();
  const values = useSelector((state: WidgetRootState) => state.widget.values);

  const geoDataSource = isGeoHierarchyDataSource(config['widget-data-source'])
    ? config['widget-data-source']
    : undefined;

  const geoLayout = config['widget-geo-layout'];
  const hierarchyJsonPath = useMemo(() => resolveHierarchyPath(config), [config]);
  const dataPath = useMemo(() => resolveDataPath(config), [config]);

  /**
   * Approved hierarchy for hydrate/display: schema first, then store.
   * Edits persist draft hierarchy into store values for save; schema keeps approved.
   */
  const baseHierarchyJson = useMemo(() => {
    if (!hierarchyJsonPath) {
      return null;
    }
    const fromSchema = readPathValue(schemaData, hierarchyJsonPath);
    if (fromSchema !== undefined && fromSchema !== null) {
      return fromSchema;
    }
    return getValueByPath(values, hierarchyJsonPath);
  }, [hierarchyJsonPath, schemaData, values]);

  const baseStoredValue = useMemo(() => {
    if (!dataPath) {
      return base.value;
    }
    const fromSchema = readPathValue(schemaData, dataPath);
    if (fromSchema !== undefined && fromSchema !== null && String(fromSchema).trim() !== '') {
      return fromSchema;
    }
    return base.value;
  }, [base.value, dataPath, schemaData]);

  const [levels, setLevels] = useState<GeoLevel[]>([]);
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<Record<string, GeoSelectOption[]>>({});
  const [resolvedLabels, setResolvedLabels] = useState<Record<string, string>>({});
  const [loadingLevels, setLoadingLevels] = useState(false);
  const [loadingLevelId, setLoadingLevelId] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  const lastInitializedKeyRef = useRef<string | undefined>(undefined);
  const initializingRef = useRef(false);
  const hydratingRef = useRef(false);
  const selfPersistedValueRef = useRef<string | null>(null);
  const baseHierarchyRef = useRef(baseHierarchyJson);
  const baseStoredValueRef = useRef(baseStoredValue);

  useEffect(() => {
    baseHierarchyRef.current = baseHierarchyJson;
  }, [baseHierarchyJson]);

  useEffect(() => {
    baseStoredValueRef.current = baseStoredValue;
  }, [baseStoredValue]);

  const requestApi = useCallback(
    async (endpoint: string, params: Record<string, unknown>) => {
      if (!dataSourceRequestHandler || !geoDataSource) {
        throw new Error('Geo hierarchy data source handler is not configured');
      }

      const response = await dataSourceRequestHandler(
        geoDataSource.service,
        endpoint,
        geoDataSource.method || 'POST',
        params,
      );

      return normalizeApiPayload(response);
    },
    [dataSourceRequestHandler, geoDataSource],
  );

  const fetchLevels = useCallback(async () => {
    if (!geoDataSource) {
      return [];
    }
    if (sharedLevelsCache.current) {
      return sharedLevelsCache.current;
    }

    const payload = await requestApi(geoDataSource.levelsEndpoint, {
      current_page: 1,
      page_size: 100,
    });
    const ordered = buildOrderedLevels(payload as GeoLevel[]);
    sharedLevelsCache.current = ordered;
    return ordered;
  }, [geoDataSource, requestApi]);

  const fetchRawValues = useCallback(
    async (params: Record<string, unknown>) => {
      if (!geoDataSource) {
        return [];
      }

      const cacheKey = JSON.stringify(params);
      const cached = sharedValuesCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const inflight = sharedValuesInflight.get(cacheKey);
      if (inflight) {
        return inflight;
      }

      const fetchPromise = (async () => {
        const payload = await requestApi(geoDataSource.valuesEndpoint, {
          current_page: 1,
          page_size: 500,
          ...params,
        });
        const nextValues = payload as GeoLevelValue[];
        sharedValuesCache.set(cacheKey, nextValues);
        return nextValues;
      })();

      sharedValuesInflight.set(cacheKey, fetchPromise);
      try {
        return await fetchPromise;
      } finally {
        sharedValuesInflight.delete(cacheKey);
      }
    },
    [geoDataSource, requestApi],
  );

  const fetchValues = useCallback(
    async (levelId: string, parentLevelValueId: string) => {
      const payload = await fetchRawValues({
        level_id: levelId,
        parent_level_value_id: parentLevelValueId,
      });
      return transformGeoValueOptions(payload);
    },
    [fetchRawValues],
  );

  /** Persist leaf id + current hierarchy structure for save (schema approved value stays preferred for read). */
  const persistDeepestValue = useCallback(
    (
      nextSelectedValues: Record<string, string>,
      orderedLevels: GeoLevel[],
      nextOptions: Record<string, GeoSelectOption[]>,
      nextResolvedLabels: Record<string, string>,
    ) => {
      if (initializingRef.current || hydratingRef.current || isReadonly) {
        return;
      }

      const deepest = getDeepestSelectedValue(orderedLevels, nextSelectedValues);
      selfPersistedValueRef.current = deepest ? String(deepest) : '';

      const hierarchyDocument = buildHierarchyJson(
        orderedLevels,
        nextSelectedValues,
        nextOptions,
        nextResolvedLabels,
      );
      const hierarchyPayload = formatHierarchyForPersist(
        hierarchyDocument,
        baseHierarchyRef.current,
      );

      const rawDataPath = config['widget-data-path'];
      const nextValue = deepest ?? null;
      if (rawDataPath && typeof rawDataPath === 'object') {
        const payload: Record<string, unknown> = { value: nextValue };
        if ('hierarchy' in rawDataPath) {
          payload.hierarchy = hierarchyPayload;
        }
        base.onChange(payload);
      } else {
        base.onChange(nextValue);
      }
    },
    [base, config, isReadonly],
  );

  const loadOptionsForLevel = useCallback(
    async (orderedLevels: GeoLevel[], levelIndex: number, parentValueId: string) => {
      const level = orderedLevels[levelIndex];
      setLoadingLevelId(level.level_id);
      try {
        const levelOptions = await fetchValues(level.level_id, parentValueId);
        setOptions((current) => ({
          ...current,
          [level.level_id]: levelOptions,
        }));
        return levelOptions;
      } finally {
        setLoadingLevelId((current) => (current === level.level_id ? null : current));
      }
    },
    [fetchValues],
  );

  const loadOptionsAlongChain = useCallback(
    async (orderedLevels: GeoLevel[], chain: GeoLevelValue[]) => {
      const nextOptions: Record<string, GeoSelectOption[]> = {};
      let parentValueId = '';

      for (let index = 0; index < orderedLevels.length; index += 1) {
        const level = orderedLevels[index];
        nextOptions[level.level_id] = await fetchValues(level.level_id, parentValueId);
        parentValueId = chain[index]?.level_value_id || parentValueId;
      }

      return nextOptions;
    },
    [fetchValues],
  );

  const resolveStoredChain = useCallback(
    (orderedLevels: GeoLevel[], levelValueId: string): GeoLevelValue[] => {
      const hierarchyRaw = baseHierarchyRef.current;
      const hierarchy = parseHierarchyJson(hierarchyRaw);
      const chain = mapHierarchyToChain(orderedLevels, hierarchy);

      if (!chainMatchesStoredValue(chain, levelValueId, hierarchyRaw)) {
        return [];
      }

      return chain;
    },
    [],
  );

  const hydrateFromStoredValue = useCallback(
    async (orderedLevels: GeoLevel[], levelValueId: string): Promise<boolean> => {
      hydratingRef.current = true;

      try {
        const chain = resolveStoredChain(orderedLevels, levelValueId);
        if (chain.length === 0) {
          return false;
        }

        const nextSelectedValues = mapChainToSelections(orderedLevels, chain);
        const labelMap: Record<string, string> = {};
        chain.forEach((entry) => {
          if (entry.level_value_id && entry.level_value_mnemonic) {
            labelMap[entry.level_value_id] = formatLevelLabel(entry.level_value_mnemonic);
          }
        });

        const nextOptions = await loadOptionsAlongChain(orderedLevels, chain);

        setSelectedValues(nextSelectedValues);
        setOptions(nextOptions);
        setResolvedLabels(labelMap);
        return true;
      } finally {
        hydratingRef.current = false;
      }
    },
    [loadOptionsAlongChain, resolveStoredChain],
  );

  const initialize = useCallback(async () => {
    if (!geoDataSource || !dataSourceRequestHandler || initializingRef.current) {
      if (!geoDataSource || !dataSourceRequestHandler) {
        setGeoError('Geo hierarchy widget requires a configured data source handler');
      }
      return;
    }

    initializingRef.current = true;
    setLoadingLevels(true);
    setGeoError(null);

    try {
      const orderedLevels = await fetchLevels();
      setLevels(orderedLevels);

      const storedValue = baseStoredValueRef.current;
      const hasStoredValue =
        storedValue !== null && storedValue !== undefined && String(storedValue).trim() !== '';

      if (hasStoredValue) {
        const hydrated = await hydrateFromStoredValue(orderedLevels, String(storedValue));
        if (hydrated) {
          return;
        }
      }

      setSelectedValues({});
      setOptions({});
      setResolvedLabels({});
      if (orderedLevels.length > 0) {
        await loadOptionsForLevel(orderedLevels, 0, '');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load geo hierarchy';
      setGeoError(message);
    } finally {
      initializingRef.current = false;
      setLoadingLevels(false);
    }
  }, [
    dataSourceRequestHandler,
    fetchLevels,
    geoDataSource,
    hydrateFromStoredValue,
    loadOptionsForLevel,
  ]);

  useEffect(() => {
    const normalizedValue =
      baseStoredValue === null || baseStoredValue === undefined || baseStoredValue === ''
        ? ''
        : String(baseStoredValue);

    const hierarchyKey =
      baseHierarchyJson && typeof baseHierarchyJson === 'object'
        ? JSON.stringify(baseHierarchyJson)
        : String(baseHierarchyJson ?? '');

    const initKey = `${isReadonly ? 'view' : 'edit'}|${normalizedValue}|${hierarchyKey}`;

    if (lastInitializedKeyRef.current === initKey) {
      return;
    }

    if (
      selfPersistedValueRef.current !== null &&
      normalizedValue === selfPersistedValueRef.current
    ) {
      lastInitializedKeyRef.current = initKey;
      return;
    }

    lastInitializedKeyRef.current = initKey;
    void initialize();
  }, [baseHierarchyJson, baseStoredValue, initialize, isReadonly]);

  const handleLevelChange = useCallback(
    async (levelIndex: number, nextValue: string | undefined) => {
      if (!levels.length || initializingRef.current || hydratingRef.current || isReadonly) {
        return;
      }

      const level = levels[levelIndex];
      let nextSelectedValues = { ...selectedValues };

      if (!nextValue) {
        delete nextSelectedValues[level.level_id];
      } else {
        nextSelectedValues[level.level_id] = nextValue;
      }

      const cleared = clearDescendants(levels, levelIndex, nextSelectedValues, options);
      nextSelectedValues = cleared.selectedValues;

      setSelectedValues(nextSelectedValues);
      setOptions(cleared.options);

      persistDeepestValue(
        nextSelectedValues,
        levels,
        cleared.options,
        resolvedLabels,
      );

      if (!nextValue || levelIndex >= levels.length - 1) {
        return;
      }

      try {
        setGeoError(null);
        await loadOptionsForLevel(levels, levelIndex + 1, nextValue);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to load child geo level values';
        setGeoError(message);
      }
    },
    [
      isReadonly,
      levels,
      selectedValues,
      options,
      resolvedLabels,
      persistDeepestValue,
      loadOptionsForLevel,
    ],
  );

  const readonlyPath = useMemo(
    () => buildReadonlyPath(levels, selectedValues, options, resolvedLabels),
    [levels, selectedValues, options, resolvedLabels],
  );

  const { columnCounts, columns: levelColumns } = useMemo(
    () => resolveGeoLevelColumns(levels, geoLayout),
    [levels, geoLayout],
  );

  const visibleColumns = useMemo(() => {
    const columnIndex = geoLayout?.columnIndex;
    if (columnIndex === undefined || columnIndex === null) {
      return levelColumns
        .map((columnLevels, index) => ({ index, levels: columnLevels }))
        .filter((column) => column.levels.length > 0);
    }

    const columnLevels = levelColumns[columnIndex] ?? [];
    return columnLevels.length > 0 ? [{ index: columnIndex, levels: columnLevels }] : [];
  }, [levelColumns, geoLayout?.columnIndex]);

  return {
    ...base,
    levels,
    selectedValues,
    options,
    resolvedLabels,
    columnCounts,
    visibleColumns,
    loadingLevels,
    loadingLevelId,
    geoError,
    readonlyPath,
    handleLevelChange,
    isLevelEnabled: (levelIndex: number) => isLevelEnabled(levels, levelIndex, selectedValues),
    formatLevelLabel,
  };
};
