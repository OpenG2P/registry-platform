import { Dispatch } from '@reduxjs/toolkit';
import { SectionConfig } from '../../../types';
import { getValueByPath } from '../../../utils/pathUtils';
import { sectionValidate, collectWidgets } from '../../../utils/sectionValidate';
import {
  collectGeoWidgetRegistrationsFromWidgets,
  reconcileGeoHierarchiesInValues,
} from '../../../utils/geoHierarchy';
import { setValues } from '../../../store/widgetSlice';
import { SectionChanges } from '../types';
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
  onSectionSave?: (changes: SectionChanges) => Promise<void> | void;
}

export interface ExecuteSectionSaveResult {
  validated: boolean;
  saved: boolean;
  saveFailed?: boolean;
  currentSchemaData: Record<string, unknown>;
}

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

  const geoRegistrations = collectGeoWidgetRegistrationsFromWidgets(sectionWidgets);
  if (geoRegistrations.length > 0) {
    currentSchemaData = reconcileGeoHierarchiesInValues(
      currentSchemaData,
      geoRegistrations,
      currentState.dataSources || {},
    );
    dispatch(setValues(currentSchemaData));
  }

  const isSectionValid = sectionValidate(section, currentSchemaData, dispatch, true);
  if (!isSectionValid) {
    return { validated: false, saved: false, currentSchemaData };
  }

  const oldSchemaData = schemaData || contextSchemaData;
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

  if (JSON.stringify(oldSchemaData) === JSON.stringify(newSchemaData)) {
    return { validated: true, saved: false, currentSchemaData };
  }

  const { records, profileImage } = extractProfileImage([...newSchemaData]);

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
