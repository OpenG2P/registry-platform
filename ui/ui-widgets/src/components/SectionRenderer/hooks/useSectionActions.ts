import { useCallback, type RefObject } from 'react';
import { useDispatch, useStore } from 'react-redux';
import { SectionConfig } from '../../../types';
import { SectionEditSnapshot } from '../../../utils/sectionRevert';
import { SectionMode } from '../../SectionsContainer';
import { executeSectionSave } from '../utils/executeSectionSave';
import { revertSectionValues } from '../utils/revertSectionValues';
import { SectionChanges } from '../types';

export const useSectionActions = ({
  section,
  originalSectionId,
  sectionId,
  mode,
  isDraft,
  schemaData,
  contextSchemaData,
  hasSupportingDocuments,
  dbSectionId,
  sectionRegisterId,
  onSectionSave,
  onEditModeChange,
  onSectionDirtyChange,
  onSectionSaveSuccess,
  sectionIndex,
  editEntrySnapshotRef,
  enterEditMode,
  exitEditMode,
  captureEditEntrySnapshot,
  markIntakeFormSaved,
  markIntakeFormSavedWithoutData,
}: {
  section: SectionConfig;
  originalSectionId: string;
  sectionId: string;
  mode: SectionMode;
  isDraft?: boolean;
  schemaData?: Record<string, unknown>;
  contextSchemaData?: Record<string, unknown>;
  hasSupportingDocuments: boolean;
  dbSectionId?: string;
  sectionRegisterId?: string;
  onSectionSave?: (changes: SectionChanges) => Promise<void> | void;
  onEditModeChange?: (sectionId: string, editing: boolean) => void;
  onSectionDirtyChange?: (sectionId: string, isDirty: boolean) => void;
  onSectionSaveSuccess?: (index: number) => void;
  sectionIndex?: number;
  editEntrySnapshotRef: RefObject<SectionEditSnapshot | null>;
  enterEditMode: () => void;
  exitEditMode: () => void;
  captureEditEntrySnapshot: () => void;
  markIntakeFormSaved: (currentSchemaData: Record<string, unknown>) => void;
  markIntakeFormSavedWithoutData: () => void;
}) => {
  const store = useStore();
  const dispatch = useDispatch();

  const revertToOriginalValues = useCallback(() => {
    revertSectionValues({
      section,
      store,
      dispatch,
      schemaData,
      contextSchemaData,
      hasSupportingDocuments,
      sectionId,
      editEntrySnapshot: editEntrySnapshotRef.current,
    });
  }, [
    section,
    store,
    dispatch,
    schemaData,
    contextSchemaData,
    hasSupportingDocuments,
    sectionId,
    editEntrySnapshotRef,
  ]);

  const handleEdit = useCallback(() => {
    captureEditEntrySnapshot();
    enterEditMode();
    onEditModeChange?.(originalSectionId, true);
  }, [captureEditEntrySnapshot, enterEditMode, onEditModeChange, originalSectionId]);

  const handleCancel = useCallback(() => {
    revertToOriginalValues();
    exitEditMode();
    onEditModeChange?.(originalSectionId, false);
  }, [revertToOriginalValues, exitEditMode, onEditModeChange, originalSectionId]);

  const handleSave = useCallback(async () => {
    if (!store || !onSectionSave) {
      console.warn('Missing store or onSectionSave in SectionRenderer');
      exitEditMode();
      onEditModeChange?.(originalSectionId, false);
      return;
    }

    const result = await executeSectionSave({
      store,
      dispatch,
      section,
      schemaData,
      contextSchemaData,
      hasSupportingDocuments,
      dbSectionId,
      sectionRegisterId,
      changedFieldsOnly: mode === 'RegistryView' || mode === 'CRView',
      onSectionSave,
    });

    if (!result.validated) return;

    if (mode === 'RegistryView') {
      revertToOriginalValues();
    }

    exitEditMode();
    onEditModeChange?.(originalSectionId, false);
  }, [
    store,
    onSectionSave,
    dispatch,
    section,
    schemaData,
    contextSchemaData,
    hasSupportingDocuments,
    dbSectionId,
    sectionRegisterId,
    mode,
    revertToOriginalValues,
    exitEditMode,
    onEditModeChange,
    originalSectionId,
  ]);

  const handleIntakeFormSave = useCallback(async () => {
    if (sectionIndex === undefined) return;

    if (isDraft !== false && store && onSectionSave) {
      const result = await executeSectionSave({
        store,
        dispatch,
        section,
        schemaData,
        contextSchemaData,
        hasSupportingDocuments,
        dbSectionId,
        sectionRegisterId,
        onSectionSave,
      });

      if (!result.validated) return;
      if (result.saveFailed) return;

      if (mode === 'IntakeForm') {
        markIntakeFormSaved(result.currentSchemaData);
      }
      onSectionDirtyChange?.(sectionId, false);
    } else if (mode === 'IntakeForm') {
      markIntakeFormSavedWithoutData();
    }

    onSectionSaveSuccess?.(sectionIndex);
  }, [
    sectionIndex,
    isDraft,
    store,
    onSectionSave,
    dispatch,
    section,
    schemaData,
    contextSchemaData,
    hasSupportingDocuments,
    dbSectionId,
    sectionRegisterId,
    mode,
    markIntakeFormSaved,
    onSectionDirtyChange,
    sectionId,
    markIntakeFormSavedWithoutData,
    onSectionSaveSuccess,
  ]);

  return {
    handleEdit,
    handleCancel,
    handleSave,
    handleIntakeFormSave,
  };
};
