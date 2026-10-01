import { Dispatch } from '@reduxjs/toolkit';
import { SectionConfig } from '../../../types';
import { sectionValidate, collectWidgets } from '../../../utils/sectionValidate';
import { SectionChanges } from '../types';
import { isTableLikeWidget } from '../../../utils/extractTableRecordsFromSnapshot';
import { diffSectionChangeRecords } from './diffSectionChangeRecords';
import { trackSectionChanges } from './sectionSnapshot';
import {
  collectAllSectionFiles,
  collectAllSectionFilesSync,
  fingerprintSectionFiles,
  getSectionFileBlobPaths,
  stripSectionFileBlobs,
} from './sectionFiles';

export interface ExecuteSectionSaveParams {
  store: { getState: () => unknown };
  dispatch: Dispatch;
  section: SectionConfig;
  schemaData?: Record<string, unknown>;
  contextSchemaData?: Record<string, unknown>;
  hasSupportingDocuments: boolean;
  dbSectionId?: string;
  sectionRegisterId?: string;
  /**
   * Registry / CR: skip no-op saves. Form sections emit every section field
   * (once anything changed). Table sections emit only touched rows.
   * Intake keeps full records.
   */
  sectionFieldsOnly?: boolean;
  /**
   * Intake Save/Next can skip required checks so drafts can be stored.
   * RegistryView change-request save must validate required fields.
   */
  skipRequired?: boolean;
  onSectionSave?: (changes: SectionChanges) => Promise<void> | void;
}

export interface ExecuteSectionSaveResult {
  validated: boolean;
  saved: boolean;
  saveFailed?: boolean;
  currentSchemaData: Record<string, unknown>;
}

const readSectionInternalRecordId = (
  source: Record<string, unknown>,
  sectionRegisterId?: string,
): string | undefined => {
  if (!sectionRegisterId) return undefined;
  const sectionData = source[sectionRegisterId];
  if (!sectionData || typeof sectionData !== 'object' || Array.isArray(sectionData)) {
    return undefined;
  }
  const id = (sectionData as Record<string, unknown>).internal_record_id;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
};

export const executeSectionSave = async ({
  store,
  dispatch,
  section,
  schemaData,
  contextSchemaData,
  hasSupportingDocuments,
  dbSectionId,
  sectionRegisterId,
  sectionFieldsOnly = false,
  skipRequired = false,
  onSectionSave,
}: ExecuteSectionSaveParams): Promise<ExecuteSectionSaveResult> => {
  const sectionWidgets = collectWidgets(section.panels);
  const currentState = (store.getState() as {
    widget: {
      values?: Record<string, unknown>;
      dataSources?: Record<string, { value: unknown; label: string }[]>;
    };
  }).widget;
  let currentSchemaData = currentState.values || {};
  const fileOptions = { includeSupportingDocuments: hasSupportingDocuments };

  const isSectionValid = sectionValidate(
    section,
    currentSchemaData,
    dispatch,
    skipRequired,
    hasSupportingDocuments,
  );
  if (!isSectionValid) {
    return { validated: false, saved: false, currentSchemaData };
  }

  const baselineSource = (schemaData || contextSchemaData || {}) as Record<string, unknown>;
  const baselineRecords = trackSectionChanges(
    sectionWidgets,
    baselineSource,
    sectionRegisterId,
  );
  const newSchemaData = trackSectionChanges(
    sectionWidgets,
    currentSchemaData,
    sectionRegisterId,
  );

  const sectionFiles = await collectAllSectionFiles(
    section,
    currentSchemaData,
    fileOptions,
  );
  const blobPaths = getSectionFileBlobPaths(section, fileOptions);
  const filesChanged =
    JSON.stringify(
      fingerprintSectionFiles(
        collectAllSectionFilesSync(section, baselineSource, fileOptions),
      ),
    ) !==
    JSON.stringify(
      fingerprintSectionFiles(
        collectAllSectionFilesSync(section, currentSchemaData, fileOptions),
      ),
    );

  if (
    JSON.stringify(baselineRecords) === JSON.stringify(newSchemaData) &&
    !filesChanged
  ) {
    return { validated: true, saved: false, currentSchemaData };
  }

  // Strip file fields from records — they travel only in `section_files`.
  let records = stripSectionFileBlobs([...newSchemaData], blobPaths);
  const fullCurrentRecords = records;

  if (sectionFieldsOnly) {
    const baselineStripped = stripSectionFileBlobs([...baselineRecords], blobPaths);
    const isTable = sectionWidgets.some((widget) => isTableLikeWidget(widget));
    const internalRecordId =
      readSectionInternalRecordId(baselineSource, sectionRegisterId) ??
      readSectionInternalRecordId(currentSchemaData, sectionRegisterId);

    let tableColumnKeys: string[] | undefined;
    if (isTable) {
      const tableWidget = sectionWidgets.find(isTableLikeWidget);
      const columns = (tableWidget as any)?.['widget-data-columns'];
      if (Array.isArray(columns)) {
        tableColumnKeys = columns
          .map((column: any) => column['column-key'] ?? column['widget-data-path'])
          .filter((key): key is string => typeof key === 'string' && key.length > 0);
      }
    }

    records = diffSectionChangeRecords(baselineStripped, records, {
      isTable,
      internalRecordId,
      tableColumnKeys,
      hasFileChanges: filesChanged,
    });

    if (records.length === 0 && !filesChanged) {
      return { validated: true, saved: false, currentSchemaData };
    }

    if (records.length === 0 && filesChanged) {
      const currentRecord = fullCurrentRecords.find(
        (record) => typeof record === 'object' && record !== null,
      ) as Record<string, unknown> | undefined;
      records = [
        {
          ...(currentRecord ?? {}),
          edit_action: 'UPDATE',
          ...(internalRecordId ? { internal_record_id: internalRecordId } : {}),
        },
      ];
    }
  }

  try {
    await onSectionSave?.({
      section_id: dbSectionId ?? section['section-id'],
      section_register_id: sectionRegisterId,
      records,
      ...(sectionFiles.length > 0 ? { section_files: sectionFiles } : {}),
    });
  } catch (error) {
    console.error('Section Changes Save failed', error);
    return { validated: true, saved: false, saveFailed: true, currentSchemaData };
  }

  return { validated: true, saved: true, currentSchemaData };
};
