/**
 * Geo Hierarchy Builder
 * Manages geo hierarchy state and builds hierarchy JSON structure
 */

import { getWidgetValue, setWidgetValue } from './pathUtils';

export interface GeoLevelData {
  level: string;
  level_value_id: string;
  level_value_mnemonic: string;
}

export interface GeoLevelConfig {
  level: string;
}

function extractLevelValueFromStored(
  value: any,
  geoConfig: GeoLevelConfig
): any {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const hierarchy = value.hierarchy || value.geo_code_hierarchy_json?.hierarchy;
  if (Array.isArray(hierarchy)) {
    const levelData = hierarchy.find((l: any) => l.level === geoConfig.level);
    if (levelData) {
      return levelData.level_value_id;
    }
    // Level absent from hierarchy (e.g. cleared by upstream cascade) — do not use lowest-level fallback
    return undefined;
  }

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

  return undefined;
}

/**
 * Resolve the display value for a geo level widget.
 * When widgetId is explicitly set in Redux (including cleared undefined/null), do not
 * fall back to shared hierarchy dataPath — that stale path was keeping grandchildren visible.
 */
export function resolveGeoWidgetLevelValue(
  values: Record<string, any>,
  widgetId: string,
  dataPath: string | Record<string, string> | undefined,
  geoConfig: GeoLevelConfig
): any {
  if (Object.prototype.hasOwnProperty.call(values, widgetId)) {
    let value = values[widgetId];
    if (value === undefined || value === null || value === '') {
      return value;
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
      return extractLevelValueFromStored(value, geoConfig);
    }
    return value;
  }

  if (!dataPath) {
    return undefined;
  }

  let value = getWidgetValue(values, dataPath, widgetId);
  if (value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
    value = extractLevelValueFromStored(value, geoConfig);
  }
  return value;
}

/**
 * Write the in-memory geo hierarchy builder state into Redux at the shared dataPath.
 */
export function applySharedGeoHierarchyToValues(
  baseValues: Record<string, any>,
  groupId: string,
  dataPath: string | Record<string, string> | undefined,
  widgetId: string
): Record<string, any> {
  const hierarchyJson = geoHierarchyBuilder.buildHierarchyJson(groupId);
  if (!dataPath || typeof dataPath !== 'string') {
    return baseValues;
  }

  const inner = hierarchyJson?.geo_code_hierarchy_json;
  const lowestId = hierarchyJson?.geo_lowest_level_value_id;

  if (dataPath.endsWith('.geo_code_hierarchy_json')) {
    const prefix = dataPath.substring(0, dataPath.lastIndexOf('.'));
    let finalUpdatedValues = setWidgetValue(baseValues, dataPath, widgetId, inner);
    finalUpdatedValues = setWidgetValue(
      finalUpdatedValues,
      `${prefix}.geo_lowest_level_value_id`,
      widgetId,
      lowestId
    );
    return finalUpdatedValues;
  }

  return setWidgetValue(baseValues, dataPath, widgetId, inner);
}

interface HierarchyState {
  levels: Map<string, GeoLevelData>; // level -> GeoLevelData
  order: string[]; // Ordered list of levels
}

class GeoHierarchyBuilder {
  private hierarchies: Map<string, HierarchyState> = new Map();

  /**
   * Get or create hierarchy state for a group
   */
  private getHierarchy(groupId: string = 'default'): HierarchyState {
    if (!this.hierarchies.has(groupId)) {
      this.hierarchies.set(groupId, {
        levels: new Map(),
        order: [],
      });
    }
    return this.hierarchies.get(groupId)!;
  }

  /**
   * Add a level to the hierarchy
   */
  addLevel(
    level: string,
    level_value_id: string,
    level_value_mnemonic: string,
    groupId: string = 'default'
  ): void {
    const hierarchy = this.getHierarchy(groupId);
    
    // If level already exists, remove it and everything after it
    const existingIndex = hierarchy.order.indexOf(level);
    if (existingIndex >= 0) {
      // Remove this level and all subsequent levels
      const levelsToRemove = hierarchy.order.slice(existingIndex);
      levelsToRemove.forEach((l) => {
        hierarchy.levels.delete(l);
        hierarchy.order = hierarchy.order.filter((o) => o !== l);
      });
    }

    // Add new level
    hierarchy.levels.set(level, {
      level,
      level_value_id,
      level_value_mnemonic,
    });
    hierarchy.order.push(level);
  }

  /**
   * Remove a level and all levels below it
   */
  removeLevelAndBelow(level: string, groupId: string = 'default'): void {
    const hierarchy = this.getHierarchy(groupId);
    const index = hierarchy.order.indexOf(level);
    
    if (index >= 0) {
      // Remove this level and all subsequent levels
      const levelsToRemove = hierarchy.order.slice(index);
      levelsToRemove.forEach((l) => {
        hierarchy.levels.delete(l);
        hierarchy.order = hierarchy.order.filter((o) => o !== l);
      });
    }
  }

  /**
   * Build hierarchy JSON structure
   */
  buildHierarchyJson(groupId: string = 'default'): {
    geo_lowest_level_value_id: string;
    geo_code_hierarchy_json: {
      hierarchy: Array<{
        level: string;
        level_value_id: string;
        level_value_mnemonic: string;
      }>;
      lowest_level_value_id: string;
    };
  } | null {
    const hierarchy = this.getHierarchy(groupId);
    
    if (hierarchy.order.length === 0) {
      return null;
    }

    const hierarchyArray = hierarchy.order.map((level) => {
      const data = hierarchy.levels.get(level)!;
      return {
        level: data.level,
        level_value_id: data.level_value_id,
        level_value_mnemonic: data.level_value_mnemonic,
      };
    });

    const lowestLevel = hierarchy.order[hierarchy.order.length - 1];
    const lowestLevelData = hierarchy.levels.get(lowestLevel)!;

    return {
      geo_lowest_level_value_id: lowestLevelData.level_value_id,
      geo_code_hierarchy_json: {
        hierarchy: hierarchyArray,
        lowest_level_value_id: lowestLevelData.level_value_id,
      },
    };
  }

  /**
   * Clear hierarchy for a group
   */
  clear(groupId: string = 'default'): void {
    this.hierarchies.delete(groupId);
  }

  /**
   * Clear all hierarchies
   */
  clearAll(): void {
    this.hierarchies.clear();
  }

  /**
   * Get current levels for a group
   */
  getLevels(groupId: string = 'default'): GeoLevelData[] {
    const hierarchy = this.getHierarchy(groupId);
    return hierarchy.order.map((level) => hierarchy.levels.get(level)!);
  }
}

// Singleton instance
export const geoHierarchyBuilder = new GeoHierarchyBuilder();

/** Sentinel written to Redux when a geo level is cleared by cascade (distinct from "never set"). */
export const GEO_LEVEL_CLEARED = null;

export interface GeoWidgetRegistration {
  widgetId: string;
  parentWidgetId: string | null;
  level: string;
  geoConfig: GeoLevelConfig;
  dataPath: string;
  groupId: string;
}

const geoWidgetParentRegistry = new Map<string, string | null>();
const geoWidgetConfigRegistry = new Map<string, GeoWidgetRegistration>();

export function registerGeoWidgetParent(widgetId: string, parentWidgetId: string | null): void {
  geoWidgetParentRegistry.set(widgetId, parentWidgetId || null);
}

export function unregisterGeoWidgetParent(widgetId: string): void {
  geoWidgetParentRegistry.delete(widgetId);
}

export function registerGeoWidget(
  widgetId: string,
  geoConfig: GeoLevelConfig & { parentWidgetId?: string | null },
  dataPath: string
): void {
  if (typeof dataPath !== 'string') {
    return;
  }
  const parentWidgetId = geoConfig.parentWidgetId?.trim() ? geoConfig.parentWidgetId : null;
  registerGeoWidgetParent(widgetId, parentWidgetId);
  geoWidgetConfigRegistry.set(widgetId, {
    widgetId,
    parentWidgetId,
    level: geoConfig.level,
    geoConfig,
    dataPath,
    groupId: getGeoGroupId(dataPath),
  });
}

export function unregisterGeoWidget(widgetId: string): void {
  unregisterGeoWidgetParent(widgetId);
  geoWidgetConfigRegistry.delete(widgetId);
}

export function orderGeoWidgetRegistrations(
  registrations: GeoWidgetRegistration[]
): GeoWidgetRegistration[] {
  if (registrations.length <= 1) {
    return registrations;
  }

  const roots = registrations.filter((entry) => !entry.parentWidgetId);
  if (roots.length === 0) {
    return registrations;
  }

  const ordered: GeoWidgetRegistration[] = [];
  let current: GeoWidgetRegistration | undefined = roots[0];
  const visited = new Set<string>();

  while (current && !visited.has(current.widgetId)) {
    visited.add(current.widgetId);
    ordered.push(current);
    current = registrations.find((entry) => entry.parentWidgetId === current!.widgetId);
  }

  return ordered.length > 0 ? ordered : registrations;
}

function resolveLevelValueId(rawValue: any): string | null {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return null;
  }
  if (typeof rawValue === 'string' || typeof rawValue === 'number') {
    return String(rawValue);
  }
  if (typeof rawValue === 'object') {
    const id = rawValue.level_value_id || rawValue.id || rawValue.value;
    return id != null && id !== '' ? String(id) : null;
  }
  return null;
}

function resolveStoredMnemonic(
  values: Record<string, any>,
  registration: GeoWidgetRegistration,
  valueId: string
): string | undefined {
  const stored = getWidgetValue(values, registration.dataPath, registration.widgetId);
  const hierarchy = stored?.hierarchy || stored?.geo_code_hierarchy_json?.hierarchy;
  if (!Array.isArray(hierarchy)) {
    return undefined;
  }
  const levelData = hierarchy.find((entry: any) => entry.level === registration.level);
  if (levelData && String(levelData.level_value_id) === String(valueId)) {
    return levelData.level_value_mnemonic ? String(levelData.level_value_mnemonic) : undefined;
  }
  return undefined;
}

/** Resolve display mnemonic from cached dropdown options, then stored hierarchy. */
export function createGeoLevelMnemonicResolver(
  values: Record<string, any>,
  dataSources: Record<string, Array<{ value: any; label: string }>>
): (registration: GeoWidgetRegistration, valueId: string) => string | undefined {
  return (registration, valueId) => {
    const options = dataSources[registration.widgetId];
    const option = options?.find((entry) => String(entry.value) === String(valueId));
    if (option?.label) {
      return option.label;
    }
    return resolveStoredMnemonic(values, registration, valueId);
  };
}

/** Rebuild group hierarchy from widget values in parent→child order; stop at first missing level. */
export function rebuildGeoHierarchyFromRegistrations(
  groupId: string,
  values: Record<string, any>,
  registrations: GeoWidgetRegistration[],
  resolveMnemonic?: (registration: GeoWidgetRegistration, valueId: string) => string | undefined
): boolean {
  const ordered = orderGeoWidgetRegistrations(
    registrations.filter((entry) => entry.groupId === groupId)
  );
  geoHierarchyBuilder.clear(groupId);

  for (const registration of ordered) {
    const rawValue = resolveGeoWidgetLevelValue(
      values,
      registration.widgetId,
      registration.dataPath,
      registration.geoConfig
    );
    const valueId = resolveLevelValueId(rawValue);
    if (!valueId) {
      break;
    }
    const mnemonic =
      resolveMnemonic?.(registration, valueId) ??
      resolveStoredMnemonic(values, registration, valueId) ??
      valueId;
    geoHierarchyBuilder.addLevel(registration.level, valueId, mnemonic, groupId);
  }

  return geoHierarchyBuilder.buildHierarchyJson(groupId) !== null;
}

export function collectGeoWidgetRegistrationsFromWidgets(
  widgets: Array<{
    'widget-id': string;
    'widget-data-path'?: string | Record<string, string>;
    'widget-geo-config'?: GeoLevelConfig & { parentWidgetId?: string | null };
  }>,
  namespace?: string
): GeoWidgetRegistration[] {
  return widgets
    .filter((widget) => widget['widget-geo-config'] && typeof widget['widget-data-path'] === 'string')
    .map((widget) => {
      const originalWidgetId = widget['widget-id'];
      const originalDataPath = widget['widget-data-path'] as string;
      const geoConfig = widget['widget-geo-config']!;
      const widgetId = namespace ? `${namespace}__${originalWidgetId}` : originalWidgetId;
      const parentWidgetId = geoConfig.parentWidgetId?.trim()
        ? (namespace ? `${namespace}__${geoConfig.parentWidgetId}` : geoConfig.parentWidgetId)
        : null;
      const dataPath = namespace ? `${namespace}.${originalDataPath}` : originalDataPath;

      return {
        widgetId,
        parentWidgetId,
        level: geoConfig.level,
        geoConfig,
        dataPath,
        groupId: getGeoGroupId(dataPath),
      };
    });
}

/** Reconcile all geo groups in section values before save. */
export function reconcileGeoHierarchiesInValues(
  values: Record<string, any>,
  registrations: GeoWidgetRegistration[],
  dataSources: Record<string, Array<{ value: any; label: string }>> = {}
): Record<string, any> {
  const groupIds = [...new Set(registrations.map((entry) => entry.groupId))];
  let updatedValues = values;
  const resolveMnemonic = createGeoLevelMnemonicResolver(updatedValues, dataSources);

  for (const groupId of groupIds) {
    const groupRegistrations = registrations.filter((entry) => entry.groupId === groupId);
    const dataPath = groupRegistrations[0]?.dataPath;
    const widgetId = groupRegistrations[0]?.widgetId;
    if (!dataPath || !widgetId) {
      continue;
    }

    rebuildGeoHierarchyFromRegistrations(
      groupId,
      updatedValues,
      groupRegistrations,
      resolveMnemonic
    );
    updatedValues = applySharedGeoHierarchyToValues(updatedValues, groupId, dataPath, widgetId);
  }

  return updatedValues;
}

export function getGeoWidgetRegistrationsInGroup(groupId: string): GeoWidgetRegistration[] {
  return orderGeoWidgetRegistrations(
    [...geoWidgetConfigRegistry.values()].filter((entry) => entry.groupId === groupId)
  );
}

/** True when changedWidgetId is any upstream geo parent of widgetId (not only immediate parent). */
export function isUpstreamGeoAncestor(
  changedWidgetId: string,
  widgetId: string,
  immediateParentWidgetId: string | null
): boolean {
  if (changedWidgetId === widgetId) {
    return false;
  }
  let cursor: string | null | undefined = immediateParentWidgetId;
  while (cursor) {
    if (cursor === changedWidgetId) {
      return true;
    }
    cursor = geoWidgetParentRegistry.get(cursor) ?? null;
  }
  return false;
}

/** Group id for geo widgets sharing the same register prefix (e.g. `{registerId}`). */
export function getGeoGroupId(
  dataPath: string | Record<string, string> | undefined
): string {
  if (typeof dataPath === 'string' && dataPath.includes('.')) {
    return dataPath.split('.').slice(0, -1).join('.');
  }
  return 'default';
}

/**
 * Resolve the human-readable label for a geo level from persisted hierarchy JSON.
 * Used in readonly mode when API options are not loaded.
 */
export function resolveGeoWidgetLevelLabel(
  values: Record<string, any>,
  widgetId: string,
  dataPath: string | Record<string, string> | undefined,
  geoConfig: GeoLevelConfig
): string | undefined {
  if (!dataPath || typeof dataPath !== 'string') {
    return undefined;
  }

  const stored = getWidgetValue(values, dataPath, widgetId);
  const hierarchy = stored?.hierarchy || stored?.geo_code_hierarchy_json?.hierarchy;
  if (!Array.isArray(hierarchy)) {
    return undefined;
  }

  const levelData = hierarchy.find((l: any) => l.level === geoConfig.level);
  if (levelData?.level_value_mnemonic) {
    return String(levelData.level_value_mnemonic);
  }
  return undefined;
}

/** All registered geo widgets that are descendants of ancestorWidgetId. */
export function getGeoDescendantWidgetIds(ancestorWidgetId: string): string[] {
  const descendants: string[] = [];
  for (const [childId, parentId] of geoWidgetParentRegistry.entries()) {
    if (isUpstreamGeoAncestor(ancestorWidgetId, childId, parentId)) {
      descendants.push(childId);
    }
  }
  return descendants;
}

function readStoredHierarchyLevels(
  values: Record<string, any>,
  dataPath: string,
  widgetId: string
): GeoLevelData[] {
  const stored = getWidgetValue(values, dataPath, widgetId);
  const hierarchy = stored?.hierarchy || stored?.geo_code_hierarchy_json?.hierarchy;
  if (!Array.isArray(hierarchy)) {
    return [];
  }
  return hierarchy.filter((entry) => entry?.level && entry.level_value_id);
}

function builderMatchesStored(
  groupId: string,
  storedLevels: GeoLevelData[]
): boolean {
  const builderLevels = geoHierarchyBuilder.getLevels(groupId);
  if (builderLevels.length !== storedLevels.length) {
    return false;
  }
  return storedLevels.every((stored, index) => {
    const built = builderLevels[index];
    return (
      built.level === stored.level &&
      String(built.level_value_id) === String(stored.level_value_id)
    );
  });
}

/** Seed in-memory builder from persisted hierarchy JSON (edit-mode rehydration). */
export function seedGeoHierarchyFromValues(
  values: Record<string, any>,
  dataPath: string | Record<string, string> | undefined,
  widgetId: string,
  groupId: string
): void {
  if (!dataPath || typeof dataPath !== 'string') {
    return;
  }
  const storedLevels = readStoredHierarchyLevels(values, dataPath, widgetId);
  if (storedLevels.length === 0) {
    return;
  }
  if (builderMatchesStored(groupId, storedLevels)) {
    return;
  }
  geoHierarchyBuilder.clear(groupId);
  storedLevels.forEach((entry) => {
    geoHierarchyBuilder.addLevel(
      entry.level,
      String(entry.level_value_id),
      entry.level_value_mnemonic || String(entry.level_value_id),
      groupId
    );
  });
}

/** Force-clear builder for a group, then seed from Redux/schema values (e.g. after Cancel). */
export function resetAndSeedGeoHierarchyFromValues(
  values: Record<string, any>,
  dataPath: string,
  widgetId: string,
  groupId: string
): void {
  geoHierarchyBuilder.clear(groupId);
  seedGeoHierarchyFromValues(values, dataPath, widgetId, groupId);
}
