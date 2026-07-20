import { BaseWidgetConfig, SectionConfig } from '../../../types';
import { getValueByPath } from '../../../utils/pathUtils';
import { collectWidgets } from '../../../utils/sectionValidate';
import {
  extractTableRecordsFromSnapshot,
  isTableLikeWidget,
} from '../../../utils/extractTableRecordsFromSnapshot';
import { SectionChanges } from '../types';

export type SectionRecordsEditAction = 'always' | 'when-register-id';
export type SectionRecordsWhenEmpty = 'empty-array' | 'single-record' | 'raw-snapshot';

export interface BuildSectionRecordsOptions {
  sectionRegisterId?: string;
  editAction?: SectionRecordsEditAction;
  whenEmpty?: SectionRecordsWhenEmpty;
}

const collectWidgetPathSnapshot = (
  widgets: BaseWidgetConfig[],
  sourceData: Record<string, unknown>,
): { snapshot: Record<string, unknown>; hasTable: boolean } => {
  const snapshot: Record<string, unknown> = {};
  let hasTable = false;

  widgets.forEach((widget) => {
    const widgetPath = widget['widget-data-path'];
    if (!widgetPath) return;

    if (isTableLikeWidget(widget)) {
      hasTable = true;
    }

    if (typeof widgetPath === 'object') {
      Object.values(widgetPath).forEach((path: unknown) => {
        if (typeof path === 'string' && path.length > 0) {
          snapshot[path] = getValueByPath(sourceData, path);
        }
      });
    } else if (typeof widgetPath === 'string') {
      snapshot[widgetPath] = getValueByPath(sourceData, widgetPath);
    }
  });

  return { snapshot, hasTable };
};

const buildRawSnapshotRecord = (
  widgets: BaseWidgetConfig[],
  sourceData: Record<string, unknown>,
): unknown[] => {
  const { snapshot } = collectWidgetPathSnapshot(widgets, sourceData);
  return [{ ...snapshot }];
};

export const buildSectionRecords = (
  widgets: BaseWidgetConfig[],
  sourceData: Record<string, unknown>,
  {
    sectionRegisterId,
    editAction = 'when-register-id',
    whenEmpty = 'single-record',
  }: BuildSectionRecordsOptions = {},
): unknown[] => {
  if (!widgets.length) {
    if (whenEmpty === 'empty-array') return [];
    if (whenEmpty === 'raw-snapshot') return buildRawSnapshotRecord(widgets, sourceData);
    const sectionData = sectionRegisterId
      ? (sourceData[sectionRegisterId] as Record<string, unknown> | undefined) ?? {}
      : {};
    return [
      {
        ...sectionData,
        ...(editAction === 'always' || sectionRegisterId ? { edit_action: 'UPDATE' as const } : {}),
      },
    ];
  }

  const { snapshot, hasTable } = collectWidgetPathSnapshot(widgets, sourceData);

  if (!hasTable) {
    const cleanedSnapshot: Record<string, unknown> = {};
    Object.entries(snapshot).forEach(([fullPath, value]) => {
      const fieldPath = fullPath.includes('.')
        ? fullPath.split('.').slice(1).join('.')
        : fullPath;
      cleanedSnapshot[fieldPath] = value;
    });

    const sectionData = sectionRegisterId
      ? (sourceData[sectionRegisterId] as Record<string, unknown> | undefined) ?? {}
      : {};

    const includeEditAction =
      editAction === 'always' ||
      (editAction === 'when-register-id' && sectionRegisterId);

    return [
      {
        ...sectionData,
        ...cleanedSnapshot,
        ...(includeEditAction ? { edit_action: 'UPDATE' as const } : {}),
      },
    ];
  }

  return extractTableRecordsFromSnapshot(snapshot, widgets);
};

export const collectSectionSupportingFiles = (
  section: SectionConfig,
  sourceData: Record<string, unknown>,
): unknown[] => {
  const files: unknown[] = [];
  const supportingDocuments = section['section-supporting-documents'] || [];
  supportingDocuments.forEach((doc) => {
    const path = doc['document-data-path'];
    if (path) {
      files.push(getValueByPath(sourceData, path));
    }
  });
  return files;
};

/** Save flow: records for change detection and onSectionSave payloads. */
export const trackSectionChanges = (
  widgets: ReturnType<typeof collectWidgets>,
  sourceData: Record<string, unknown>,
  sectionRegisterId?: string,
): unknown[] =>
  buildSectionRecords(widgets, sourceData, {
    sectionRegisterId,
    editAction: 'always',
    whenEmpty: 'empty-array',
  });

/** Dirty-state baseline: records + supporting-document files. */
export const buildSectionSnapshot = (
  section: SectionConfig,
  sourceData: Record<string, unknown>,
  hasSupportingDocuments: boolean,
  sectionRegisterId?: string,
): { records: unknown[]; files: unknown[] } => {
  const sectionWidgets = collectWidgets(section.panels);

  const records =
    sectionWidgets.length > 0
      ? buildSectionRecords(sectionWidgets, sourceData, {
          sectionRegisterId,
          editAction: 'always',
          whenEmpty: 'empty-array',
        })
      : buildSectionRecords(sectionWidgets, sourceData, {
          whenEmpty: 'raw-snapshot',
        });

  const files = hasSupportingDocuments
    ? collectSectionSupportingFiles(section, sourceData)
    : [];

  return { records, files };
};

/** Form submit / draft: full SectionChanges payload for one section. */
export function buildSectionChanges(
  section: SectionConfig,
  storeValues: Record<string, unknown>,
  options?: { dbSectionId?: string; sectionRegisterId?: string },
): SectionChanges {
  const sectionWidgets = collectWidgets(section.panels);
  const { sectionRegisterId } = options || {};

  const records = buildSectionRecords(sectionWidgets, storeValues, {
    sectionRegisterId,
    editAction: 'when-register-id',
    whenEmpty: 'single-record',
  });

  const files = collectSectionSupportingFiles(section, storeValues);

  return {
    section_id: options?.dbSectionId ?? section['section-id'],
    section_register_id: sectionRegisterId,
    records,
    files: files.length > 0 ? files : undefined,
  };
}
