import { BaseWidgetConfig, SectionConfig } from '../../../types';
import { getValueByPath } from '../../../utils/pathUtils';
import { collectWidgets } from '../../../utils/sectionValidate';
import {
  extractTableRecordsFromSnapshot,
  isTableLikeWidget,
} from '../../../utils/extractTableRecordsFromSnapshot';
import { SectionChanges } from '../types';
import {
  collectAllSectionFilesSync,
  fingerprintSectionFiles,
  getProfileImageUrlPaths,
  getSectionFileBlobPaths,
  stripSectionFileBlobs,
} from './sectionFiles';
import { isSerializedFile } from '../../../utils/fileSerialization';
import { isStoredDocumentRef } from '../../../utils/storedDocument';

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

    const includeEditAction =
      editAction === 'always' ||
      (editAction === 'when-register-id' && sectionRegisterId);

    return [
      {
        ...cleanedSnapshot,
        ...(includeEditAction ? { edit_action: 'UPDATE' as const } : {}),
      },
    ];
  }

  return extractTableRecordsFromSnapshot(snapshot, widgets);
};

export { getProfileImageUrlPaths } from './sectionFiles';

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

/** Dirty-state baseline: records + all section files. */
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

  const files = fingerprintSectionFiles(
    collectAllSectionFilesSync(section, sourceData, {
      includeSupportingDocuments: hasSupportingDocuments,
    }),
  );

  return { records, files };
};

/** Form submit / draft: full SectionChanges payload for one section. */
export function buildSectionChanges(
  section: SectionConfig,
  storeValues: Record<string, unknown>,
  options?: {
    dbSectionId?: string;
    sectionRegisterId?: string;
    includeSupportingDocuments?: boolean;
  },
): SectionChanges {
  const sectionWidgets = collectWidgets(section.panels);
  const { sectionRegisterId, includeSupportingDocuments = true } = options || {};
  const fileOptions = { includeSupportingDocuments };

  const records = stripSectionFileBlobs(
    buildSectionRecords(sectionWidgets, storeValues, {
      sectionRegisterId,
      editAction: 'when-register-id',
      whenEmpty: 'single-record',
    }),
    getSectionFileBlobPaths(section, fileOptions),
  );

  // Fresh uploads (serialized) + unchanged stored document refs.
  const sectionFiles = collectAllSectionFilesSync(section, storeValues, fileOptions)
    .filter(
      (raw) => isSerializedFile(raw.value) || isStoredDocumentRef(raw.value),
    )
    .map(({ value, tag, label, field, document_key }) => {
      if (isStoredDocumentRef(value)) {
        return {
          label: value.label,
          document_id: value.document_id,
          presigned_url: value.presigned_url,
          ...(value.source_filename
            ? { source_filename: value.source_filename }
            : {}),
          tag,
          ...(field ? { field } : {}),
          ...(document_key ? { document_key } : {}),
        };
      }

      return {
        ...value,
        tag,
        ...(label ? { label } : {}),
        ...(field ? { field } : {}),
        ...(document_key ? { document_key } : {}),
      };
    });

  return {
    section_id: options?.dbSectionId ?? section['section-id'],
    section_register_id: sectionRegisterId,
    records,
    ...(sectionFiles.length > 0 ? { section_files: sectionFiles } : {}),
  };
}
