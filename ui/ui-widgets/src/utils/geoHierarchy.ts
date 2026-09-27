export interface GeoLevel {
  level_id: string;
  level_mnemonic: string;
  parent_level_id: string | null;
}

export interface GeoLevelValue {
  level_value_id: string;
  level_id: string;
  level_value_mnemonic: string;
  parent_level_value_id: string | null;
}

export interface GeoSelectOption {
  value: string;
  label: string;
}

export function normalizeApiPayload(response: unknown): unknown[] {
  if (Array.isArray(response)) {
    return response;
  }
  if (response && typeof response === 'object') {
    const body = response as Record<string, unknown>;
    if (Array.isArray(body.response_payload)) {
      return body.response_payload;
    }
    if (body.response_body && typeof body.response_body === 'object') {
      const nested = body.response_body as Record<string, unknown>;
      if (Array.isArray(nested.response_payload)) {
        return nested.response_payload;
      }
    }
  }
  return [];
}

export function getRootLevels(levels: GeoLevel[]): GeoLevel[] {
  return levels.filter((level) => !level.parent_level_id);
}

export function getChildLevels(levels: GeoLevel[], parentLevelId: string): GeoLevel[] {
  return levels.filter((level) => level.parent_level_id === parentLevelId);
}

/** Depth-first from the single root so forked child levels are all included. */
export function buildOrderedLevels(flat: GeoLevel[]): GeoLevel[] {
  if (flat.length === 0) {
    return [];
  }

  const roots = getRootLevels(flat);

  if (roots.length !== 1) {
    throw new Error(
      roots.length === 0
        ? 'Geo hierarchy has no root level'
        : 'Geo hierarchy has multiple root levels',
    );
  }

  const ordered: GeoLevel[] = [];
  const visited = new Set<string>();

  const walk = (level: GeoLevel) => {
    if (visited.has(level.level_id)) {
      throw new Error('Geo hierarchy contains a cycle');
    }
    visited.add(level.level_id);
    ordered.push(level);
    for (const child of getChildLevels(flat, level.level_id)) {
      walk(child);
    }
  };

  walk(roots[0]);

  if (ordered.length !== flat.length) {
    throw new Error('Geo hierarchy contains disconnected levels');
  }

  return ordered;
}

export const GEO_SECTION_COLUMN_SLOTS = 3;

/**
 * Suggested panel/widget column span from hierarchy depth:
 * ≤3 levels → 1, 4–5 → 2, ≥6 → 3.
 */
export function suggestedGeoColumnSpan(levelCount: number): number {
  if (levelCount <= 0) {
    return 1;
  }
  if (levelCount <= 3) {
    return 1;
  }
  if (levelCount < 6) {
    return 2;
  }
  return GEO_SECTION_COLUMN_SLOTS;
}

/** Clamp span to 1…GEO_SECTION_COLUMN_SLOTS and at most the level count. */
export function resolveGeoColumnSpan(
  levelCount: number,
  explicitSpan?: number,
): number {
  const preferred =
    explicitSpan !== undefined && explicitSpan !== null
      ? explicitSpan
      : suggestedGeoColumnSpan(levelCount);

  const clamped = Math.min(
    GEO_SECTION_COLUMN_SLOTS,
    Math.max(1, Math.floor(preferred)),
  );

  if (levelCount <= 0) {
    return clamped;
  }

  return Math.min(clamped, levelCount);
}

/** Slice ordered levels into section columns per counts, e.g. [3, 2, 0]. */
export function distributeLevelsToColumns(
  levels: GeoLevel[],
  columnCounts: number[],
): GeoLevel[][] {
  const columns: GeoLevel[][] = columnCounts.map(() => []);
  let offset = 0;

  for (let index = 0; index < columnCounts.length; index += 1) {
    const count = columnCounts[index];
    if (count > 0) {
      columns[index] = levels.slice(offset, offset + count);
      offset += count;
    }
  }

  return columns;
}

export function distributeLevelsContiguous(
  levels: GeoLevel[],
  columnCount: number,
): GeoLevel[][] {
  const safeCount = Math.max(columnCount, 1);
  const rowsPerColumn = Math.ceil(levels.length / safeCount);
  const columns: GeoLevel[][] = Array.from({ length: safeCount }, () => []);

  if (rowsPerColumn === 0) {
    return columns;
  }

  for (let index = 0; index < safeCount; index += 1) {
    columns[index] = levels.slice(index * rowsPerColumn, (index + 1) * rowsPerColumn);
  }

  return columns;
}

export function resolveGeoLevelColumns(
  levels: GeoLevel[],
  layout?: {
    distribution?: 'fixed';
    columns?: number[];
    columnSpan?: number;
  },
): { columnCounts: number[]; columns: GeoLevel[][]; columnSpan: number } {
  if (layout?.columns?.length) {
    const columnCounts =
      layout.distribution === 'fixed'
        ? padColumnCounts(layout.columns, GEO_SECTION_COLUMN_SLOTS)
        : layout.columns;

    const columns = distributeLevelsToColumns(levels, columnCounts);
    const occupied = columns.filter((column) => column.length > 0).length;

    return {
      columnCounts,
      columns,
      columnSpan: resolveGeoColumnSpan(
        levels.length,
        layout.columnSpan ?? occupied,
      ),
    };
  }

  // Distribute top-to-bottom across the allotted column span so order stays
  // correct when columns stack on small screens.
  const columnSpan = resolveGeoColumnSpan(levels.length, layout?.columnSpan);
  const columns = distributeLevelsContiguous(levels, columnSpan);

  return {
    columnCounts: columns.map((column) => column.length),
    columns,
    columnSpan,
  };
}

function padColumnCounts(counts: number[], slotCount: number): number[] {
  if (counts.length >= slotCount) {
    return counts.slice(0, slotCount);
  }
  return [...counts, ...Array.from({ length: slotCount - counts.length }, () => 0)];
}

export function formatLevelLabel(mnemonic: string): string {
  return mnemonic
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function transformGeoValueOptions(values: GeoLevelValue[]): GeoSelectOption[] {
  return values.map((item) => ({
    value: item.level_value_id,
    label: formatLevelLabel(item.level_value_mnemonic || item.level_value_id),
  }));
}

export interface GeoHierarchyJsonEntry {
  level_id?: string;
  /** Alias of level_mnemonic on some backend payloads. */
  level?: string;
  level_mnemonic?: string;
  level_value_id: string;
  level_value_mnemonic?: string;
}

export interface GeoHierarchyJson {
  hierarchy?: GeoHierarchyJsonEntry[];
  lowest_level_value_id?: string;
}

/** Read path for geo_code_hierarchy_json from explicit widget config only. */
export function resolveHierarchyJsonPath(
  dataPath: string | Record<string, string> | undefined,
  hierarchyPath?: string,
): string | null {
  if (hierarchyPath) {
    return hierarchyPath;
  }

  if (dataPath && typeof dataPath === 'object' && typeof dataPath.hierarchy === 'string') {
    return dataPath.hierarchy;
  }

  return null;
}

export function parseHierarchyJson(raw: unknown): GeoHierarchyJsonEntry[] {
  const body = parseHierarchyRaw(raw);
  if (Array.isArray(body?.hierarchy)) {
    return body.hierarchy;
  }

  return [];
}

function parseHierarchyRaw(raw: unknown): GeoHierarchyJson | null {
  if (!raw) {
    return null;
  }

  let parsed: unknown = raw;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  return parsed as GeoHierarchyJson;
}

export function normalizeGeoId(id: string): string {
  return id.trim().toLowerCase();
}

export function geoIdsMatch(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right) {
    return false;
  }
  return normalizeGeoId(left) === normalizeGeoId(right);
}

function buildChainEntryFromLevel(
  level: GeoLevel,
  chain: GeoLevelValue[],
  entry: GeoHierarchyJsonEntry,
): GeoLevelValue {
  return {
    level_value_id: entry.level_value_id,
    level_id: level.level_id,
    level_value_mnemonic: entry.level_value_mnemonic || '',
    parent_level_value_id: chain.length > 0 ? chain[chain.length - 1].level_value_id : null,
  };
}

/** Map geo_code_hierarchy_json entries onto levels by id/mnemonic (path may stop before a fork's unused branch). */
export function mapHierarchyToChain(
  orderedLevels: GeoLevel[],
  hierarchy: GeoHierarchyJsonEntry[],
): GeoLevelValue[] {
  if (orderedLevels.length === 0 || hierarchy.length === 0) {
    return [];
  }

  const chain: GeoLevelValue[] = [];

  for (const entry of hierarchy) {
    if (!entry?.level_value_id) {
      break;
    }
    const level = orderedLevels.find((item) => matchesGeoLevel(entry, item));
    if (!level) {
      break;
    }
    chain.push(buildChainEntryFromLevel(level, chain, entry));
  }

  return chain;
}

/** True when the resolved chain matches the stored leaf id (or hierarchy lowest_level_value_id). */
export function chainMatchesStoredValue(
  chain: GeoLevelValue[],
  levelValueId: string,
  hierarchyRaw?: unknown,
): boolean {
  if (chain.length === 0) {
    return false;
  }

  const leaf = chain[chain.length - 1];
  const document = parseHierarchyRaw(hierarchyRaw);
  const lowestId = document?.lowest_level_value_id;

  if (
    geoIdsMatch(leaf.level_value_id, levelValueId) ||
    geoIdsMatch(leaf.level_value_mnemonic, levelValueId) ||
    (lowestId &&
      (geoIdsMatch(leaf.level_value_id, lowestId) ||
        geoIdsMatch(leaf.level_value_mnemonic, lowestId)))
  ) {
    return true;
  }

  return chain.some(
    (entry) =>
      geoIdsMatch(entry.level_value_id, levelValueId) ||
      geoIdsMatch(entry.level_value_mnemonic, levelValueId),
  );
}

function matchesGeoLevel(entry: GeoHierarchyJsonEntry, level: GeoLevel): boolean {
  return (
    entry.level_id === level.level_id ||
    entry.level_mnemonic === level.level_mnemonic ||
    entry.level === level.level_mnemonic ||
    entry.level === level.level_id
  );
}

export function getSelectedPath(
  orderedLevels: GeoLevel[],
  selectedValues: Record<string, string>,
): GeoLevel[] {
  const roots = getRootLevels(orderedLevels);
  if (roots.length !== 1) {
    return [];
  }

  const path: GeoLevel[] = [];
  let current: GeoLevel | undefined = roots[0];

  while (current && selectedValues[current.level_id]) {
    path.push(current);
    const children = getChildLevels(orderedLevels, current.level_id);
    const next = children.find((child) => selectedValues[child.level_id]);
    current = next;
  }

  return path;
}

export function collectDescendantLevelIds(
  orderedLevels: GeoLevel[],
  parentLevelId: string,
): string[] {
  const ids: string[] = [];
  const walk = (levelId: string) => {
    for (const child of getChildLevels(orderedLevels, levelId)) {
      ids.push(child.level_id);
      walk(child.level_id);
    }
  };
  walk(parentLevelId);
  return ids;
}

export function getDeepestSelectedValue(
  orderedLevels: GeoLevel[],
  selectedValues: Record<string, string>,
): string | null {
  const path = getSelectedPath(orderedLevels, selectedValues);
  if (path.length === 0) {
    return null;
  }
  return selectedValues[path[path.length - 1].level_id] ?? null;
}

/**
 * Complete when the selected path reaches a leaf:
 * no child levels, or every child level has an empty option list for this parent
 * (city with no subdistricts). Sibling forks require exactly one filled branch.
 */
export function isGeoHierarchyComplete(
  orderedLevels: GeoLevel[],
  selectedValues: Record<string, string>,
  options: Record<string, GeoSelectOption[]> = {},
): boolean {
  const roots = getRootLevels(orderedLevels);
  if (roots.length !== 1) {
    return false;
  }

  const isCompleteAt = (level: GeoLevel): boolean => {
    if (!selectedValues[level.level_id]) {
      return false;
    }
    const children = getChildLevels(orderedLevels, level.level_id);
    if (children.length === 0) {
      return true;
    }
    if (children.some((child) => options[child.level_id] === undefined)) {
      return false;
    }
    const withOptions = children.filter(
      (child) => (options[child.level_id]?.length ?? 0) > 0,
    );
    if (withOptions.length === 0) {
      return true;
    }
    const chosen = children.filter((child) => selectedValues[child.level_id]);
    if (chosen.length !== 1) {
      return false;
    }
    return isCompleteAt(chosen[0]);
  };

  return isCompleteAt(roots[0]);
}

export type GeoFormStep =
  | {
      kind: 'single';
      key: string;
      level: GeoLevel;
      parentValueId: string;
    }
  | {
      kind: 'fork';
      key: string;
      levels: GeoLevel[];
      parentLevel: GeoLevel;
      parentValueId: string;
    };

function childLevelsToShow(
  children: GeoLevel[],
  selectedValues: Record<string, string>,
  options: Record<string, GeoSelectOption[]>,
): GeoLevel[] {
  return children.filter(
    (child) =>
      selectedValues[child.level_id] ||
      options[child.level_id] === undefined ||
      (options[child.level_id]?.length ?? 0) > 0,
  );
}

/**
 * One form control per hop. A parent with several child levels (city vs
 * subdistrict) is a single grouped dropdown, not parallel fields.
 */
export function buildGeoFormSteps(
  orderedLevels: GeoLevel[],
  selectedValues: Record<string, string>,
  options: Record<string, GeoSelectOption[]> = {},
): GeoFormStep[] {
  const roots = getRootLevels(orderedLevels);
  if (roots.length !== 1) {
    return orderedLevels.map((level) => ({
      kind: 'single' as const,
      key: level.level_id,
      level,
      parentValueId: '',
    }));
  }

  const steps: GeoFormStep[] = [
    { kind: 'single', key: roots[0].level_id, level: roots[0], parentValueId: '' },
  ];

  let current = roots[0];
  while (selectedValues[current.level_id]) {
    const children = getChildLevels(orderedLevels, current.level_id);
    if (children.length === 0) {
      break;
    }
    const toShow = childLevelsToShow(children, selectedValues, options);
    if (toShow.length === 0) {
      break;
    }
    const parentValueId = selectedValues[current.level_id];
    if (toShow.length === 1) {
      const next = toShow[0];
      steps.push({
        kind: 'single',
        key: next.level_id,
        level: next,
        parentValueId,
      });
      if (!selectedValues[next.level_id]) {
        break;
      }
      current = next;
      continue;
    }

    steps.push({
      kind: 'fork',
      key: `fork:${current.level_id}`,
      levels: toShow,
      parentLevel: current,
      parentValueId,
    });
    const chosen = toShow.find((child) => selectedValues[child.level_id]);
    if (!chosen) {
      break;
    }
    current = chosen;
  }

  return steps;
}

export function visibleLevelsForSelection(
  orderedLevels: GeoLevel[],
  selectedValues: Record<string, string>,
  options: Record<string, GeoSelectOption[]> = {},
): GeoLevel[] {
  const seen = new Set<string>();
  const levels: GeoLevel[] = [];
  for (const step of buildGeoFormSteps(orderedLevels, selectedValues, options)) {
    const stepLevels = step.kind === 'single' ? [step.level] : step.levels;
    for (const level of stepLevels) {
      if (!seen.has(level.level_id)) {
        seen.add(level.level_id);
        levels.push(level);
      }
    }
  }
  return levels;
}

export function encodeGeoSelectValue(levelId: string, valueId: string): string {
  return `${levelId}::${valueId}`;
}

export function parseGeoSelectValue(
  raw: string,
): { levelId: string; valueId: string } | null {
  const separator = raw.indexOf('::');
  if (separator <= 0) {
    return null;
  }
  const levelId = raw.slice(0, separator);
  const valueId = raw.slice(separator + 2);
  if (!levelId || !valueId) {
    return null;
  }
  return { levelId, valueId };
}

/** Build geo_code_hierarchy_json document from the selected path (not unused forks). */
export function buildHierarchyJson(
  orderedLevels: GeoLevel[],
  selectedValues: Record<string, string>,
  options: Record<string, GeoSelectOption[]>,
  resolvedLabels: Record<string, string> = {},
): GeoHierarchyJson | null {
  const hierarchy: GeoHierarchyJsonEntry[] = [];
  const path = getSelectedPath(orderedLevels, selectedValues);

  for (const level of path) {
    const levelValueId = selectedValues[level.level_id];
    if (!levelValueId) {
      break;
    }

    const optionLabel = options[level.level_id]?.find((item) => item.value === levelValueId)?.label;
    const mnemonic = optionLabel || resolvedLabels[levelValueId] || levelValueId;

    hierarchy.push({
      level_id: level.level_id,
      level: level.level_mnemonic,
      level_mnemonic: level.level_mnemonic,
      level_value_id: levelValueId,
      level_value_mnemonic: mnemonic,
    });
  }

  if (hierarchy.length === 0) {
    return null;
  }

  return {
    hierarchy,
    lowest_level_value_id: hierarchy[hierarchy.length - 1].level_value_id,
  };
}

/** Preserve string vs object storage shape used by the existing hierarchy field. */
export function formatHierarchyForPersist(
  document: GeoHierarchyJson | null,
  previous: unknown,
): unknown {
  if (document === null) {
    return typeof previous === 'string' ? '' : null;
  }
  if (typeof previous === 'string') {
    return JSON.stringify(document);
  }
  return document;
}

export function clearDescendants(
  orderedLevels: GeoLevel[],
  fromIndex: number,
  selectedValues: Record<string, string>,
  options: Record<string, GeoSelectOption[]>,
): {
  selectedValues: Record<string, string>;
  options: Record<string, GeoSelectOption[]>;
} {
  const fromLevel = orderedLevels[fromIndex];
  const nextSelected = { ...selectedValues };
  const nextOptions = { ...options };

  if (!fromLevel) {
    return { selectedValues: nextSelected, options: nextOptions };
  }

  for (const levelId of collectDescendantLevelIds(orderedLevels, fromLevel.level_id)) {
    delete nextSelected[levelId];
    delete nextOptions[levelId];
  }

  return { selectedValues: nextSelected, options: nextOptions };
}

/** After choosing one sibling fork, drop the other siblings and their descendants. */
export function clearUnselectedSiblingBranches(
  orderedLevels: GeoLevel[],
  chosenLevelId: string,
  selectedValues: Record<string, string>,
  options: Record<string, GeoSelectOption[]>,
): {
  selectedValues: Record<string, string>;
  options: Record<string, GeoSelectOption[]>;
} {
  const chosen = orderedLevels.find((level) => level.level_id === chosenLevelId);
  const nextSelected = { ...selectedValues };
  const nextOptions = { ...options };
  if (!chosen?.parent_level_id) {
    return { selectedValues: nextSelected, options: nextOptions };
  }

  for (const sibling of getChildLevels(orderedLevels, chosen.parent_level_id)) {
    if (sibling.level_id === chosenLevelId) {
      continue;
    }
    delete nextSelected[sibling.level_id];
    for (const levelId of collectDescendantLevelIds(orderedLevels, sibling.level_id)) {
      delete nextSelected[levelId];
      delete nextOptions[levelId];
    }
  }

  return { selectedValues: nextSelected, options: nextOptions };
}

/** Level is enabled when it is the root, or its parent already has a selection. */
export function isLevelEnabled(
  orderedLevels: GeoLevel[],
  levelIndex: number,
  selectedValues: Record<string, string>,
): boolean {
  const level = orderedLevels[levelIndex];
  if (!level) {
    return false;
  }
  if (!level.parent_level_id) {
    return true;
  }
  return Boolean(selectedValues[level.parent_level_id]);
}

/** Map a root→leaf chain onto level_id → level_value_id selections. */
export function mapChainToSelections(
  orderedLevels: GeoLevel[],
  chain: GeoLevelValue[],
): Record<string, string> {
  const selectedValues: Record<string, string> = {};

  for (const level of orderedLevels) {
    const match = chain.find((entry) => entry.level_id === level.level_id);
    if (match?.level_value_id) {
      selectedValues[level.level_id] = match.level_value_id;
    }
  }

  return selectedValues;
}

export function buildReadonlyPath(
  orderedLevels: GeoLevel[],
  selectedValues: Record<string, string>,
  options: Record<string, GeoSelectOption[]>,
  resolvedLabels: Record<string, string>,
): string {
  const parts: string[] = [];

  for (const level of getSelectedPath(orderedLevels, selectedValues)) {
    const selected = selectedValues[level.level_id];
    if (!selected) {
      break;
    }
    const optionLabel = options[level.level_id]?.find((item) => item.value === selected)?.label;
    parts.push(optionLabel || resolvedLabels[selected] || selected);
  }

  return parts.join(' / ');
}
