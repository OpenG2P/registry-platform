import { Dispatch } from '@reduxjs/toolkit';
import { SectionConfig } from '../../../types';
import { getValueByPath } from '../../../utils/pathUtils';
import { sectionValidate, collectWidgets } from '../../../utils/sectionValidate';
import {
  deserializeFile,
  isSerializedFile,
} from '../../../utils/fileSerialization';
import { SectionChanges } from '../types';
import { isTableLikeWidget } from '../../../utils/extractTableRecordsFromSnapshot';
import { diffSectionChangeRecords } from './diffSectionChangeRecords';
import { trackSectionChanges } from './sectionSnapshot';

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

const collectDocsWidgetFiles = (
  panels: SectionConfig['panels'],
  sourceData: Record<string, unknown>,
): unknown[] => {
  const files: unknown[] = [];
  const docsWidgets = collectWidgets(panels).filter((w) => w.widget === 'docs');

  docsWidgets.forEach((widget) => {
    const widgetPath = widget['widget-data-path'];
    if (!widgetPath || typeof widgetPath !== 'string') return;

    const docsValue = getValueByPath(sourceData, widgetPath);
    if (!docsValue || typeof docsValue !== 'object' || Array.isArray(docsValue)) return;

    const documents: Array<{ 'document-key': string; 'document-label'?: string }> =
      widget['documents'] || [];

    documents.forEach((doc) => {
      const key = doc['document-key'];
      const file = (docsValue as Record<string, unknown>)[key];
      if (file && isSerializedFile(file)) {
        files.push({ ...(file as object), label: doc['document-label'] ?? key });
      }
    });
  });

  return files;
};

/**
 * Strip the base-64 blobs of freshly-uploaded `docs` files from the save
 * records (they travel in `SectionChanges.files` instead) while preserving
 * already-uploaded documents that are stored as view-URL strings.
 */
const stripDocsWidgetFields = (
  records: unknown[],
  panels: SectionConfig['panels'],
): unknown[] => {
  const docsWidgets = collectWidgets(panels).filter((w) => w.widget === 'docs');
  if (docsWidgets.length === 0) return records;

  const fieldKeys = docsWidgets
    .map((w) => {
      const path = w['widget-data-path'];
      if (!path || typeof path !== 'string') return null;
      return path.includes('.') ? path.split('.').slice(1).join('.') : path;
    })
    .filter((k): k is string => k !== null);

  if (fieldKeys.length === 0) return records;

  return records.map((record) => {
    if (typeof record !== 'object' || record === null) return record;
    const copy = { ...(record as Record<string, unknown>) };
    for (const key of fieldKeys) {
      const docsObject = copy[key];
      if (!docsObject || typeof docsObject !== 'object' || Array.isArray(docsObject)) {
        delete copy[key];
        continue;
      }
      // Keep only the string URLs of already-uploaded docs; drop base-64 blobs.
      const preserved: Record<string, unknown> = {};
      for (const [docKey, docValue] of Object.entries(docsObject as Record<string, unknown>)) {
        if (typeof docValue === 'string' && docValue.length > 0) {
          preserved[docKey] = docValue;
        }
      }
      if (Object.keys(preserved).length > 0) {
        copy[key] = preserved;
      } else {
        delete copy[key];
      }
    }
    return copy;
  });
};

const extractProfileImage = (
  records: unknown[],
): { records: unknown[]; profileImage: File | null } => {
  let profileImage: File | null = null;
  const clonedRecords = records.map((record) => {
    if (typeof record !== 'object' || record === null) return record;
    const copy = { ...(record as Record<string, unknown>) };
    for (const [key, value] of Object.entries(copy)) {
      if (value instanceof File) {
        profileImage = value;
        copy[key] = '';
      } else if (isSerializedFile(value)) {
        try {
          profileImage = deserializeFile(value);
          copy[key] = '';
        } catch (err) {
          console.error('Failed to deserialize profile image:', err);
        }
      }
    }
    return copy;
  });
  return { records: clonedRecords, profileImage };
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

  const isSectionValid = sectionValidate(section, currentSchemaData, dispatch, skipRequired);
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

  const sectionFiles: unknown[] = [];
  if (hasSupportingDocuments) {
    const supportingDocuments = section['section-supporting-documents'] || [];
    supportingDocuments.forEach((doc) => {
      sectionFiles.push(getValueByPath(currentSchemaData, doc['document-data-path']));
    });
  }

  // Collect files from any docs widgets and add them to the save payload.
  const docsFiles = collectDocsWidgetFiles(section.panels, currentSchemaData);
  sectionFiles.push(...docsFiles);

  if (JSON.stringify(baselineRecords) === JSON.stringify(newSchemaData) && docsFiles.length === 0) {
    return { validated: true, saved: false, currentSchemaData };
  }

  const { records: recordsWithImage, profileImage } = extractProfileImage([...newSchemaData]);
  // Strip the docs blob objects from records — they travel in `files` instead.
  let records = stripDocsWidgetFields(recordsWithImage, section.panels);

  if (sectionFieldsOnly) {
    const baselineStripped = stripDocsWidgetFields(
      [...baselineRecords],
      section.panels,
    );
    const isTable = sectionWidgets.some((widget) => isTableLikeWidget(widget));
    records = diffSectionChangeRecords(baselineStripped, records, { isTable });

    if (records.length === 0 && sectionFiles.length === 0 && !profileImage) {
      return { validated: true, saved: false, currentSchemaData };
    }
  }

  try {
    await onSectionSave?.({
      section_id: dbSectionId ?? section['section-id'],
      section_register_id: sectionRegisterId,
      records,
      files: [...sectionFiles],
      ...(profileImage ? { image: profileImage } : {}),
    });
  } catch (error) {
    console.error('Section Changes Save failed', error);
    return { validated: true, saved: false, saveFailed: true, currentSchemaData };
  }

  return { validated: true, saved: true, currentSchemaData };
};
