import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useStore } from 'react-redux';
import { SectionConfig } from '../../../types';
import { captureSectionEditSnapshot, SectionEditSnapshot } from '../../../utils/sectionRevert';
import { WidgetRootState } from '../../../store';
import { SectionMode } from '../../SectionsContainer';
import { buildSectionSnapshot } from '../utils/sectionSnapshot';

export const useSectionDirty = ({
  mode,
  isDraft,
  isEditMode,
  section,
  sectionId,
  hasSupportingDocuments,
  storeValues,
  schemaData,
  contextSchemaData,
  onSectionDirtyChange,
  sectionRegisterId,
}: {
  mode: SectionMode;
  isDraft?: boolean;
  isEditMode: boolean;
  section: SectionConfig;
  sectionId: string;
  hasSupportingDocuments: boolean;
  storeValues: Record<string, unknown>;
  schemaData?: Record<string, unknown>;
  contextSchemaData?: Record<string, unknown>;
  onSectionDirtyChange?: (sectionId: string, isDirty: boolean) => void;
  sectionRegisterId?: string;
}) => {
  const store = useStore();
  const baselineSnapshotRef = useRef<{ records: unknown[]; files: unknown[] } | null>(null);
  const editEntrySnapshotRef = useRef<SectionEditSnapshot | null>(null);
  const [intakeFormBaselineTrigger, setIntakeFormBaselineTrigger] = useState(0);
  const [hasBeenSavedByUser, setHasBeenSavedByUser] = useState(false);

  const effectiveEditModeForDirty = mode === 'IntakeForm' ? isDraft !== false : isEditMode;

  const buildSnapshot = useCallback(
    (sourceData: Record<string, unknown>) =>
      buildSectionSnapshot(section, sourceData, hasSupportingDocuments, sectionRegisterId),
    [section, hasSupportingDocuments, sectionRegisterId],
  );

  const captureEditEntrySnapshot = useCallback(() => {
    const currentValues = (store.getState() as WidgetRootState).widget.values;
    const supportingDocuments = section['section-supporting-documents'] || [];
    editEntrySnapshotRef.current = captureSectionEditSnapshot(currentValues, section, {
      sectionId,
      supportingDocuments: hasSupportingDocuments ? supportingDocuments : [],
    });
  }, [store, section, sectionId, hasSupportingDocuments]);

  const isDirty = useMemo(() => {
    if (!effectiveEditModeForDirty) return false;
    const baseline = baselineSnapshotRef.current;
    if (!baseline) return false;
    const currentSnapshot = buildSnapshot(storeValues);
    return JSON.stringify(baseline) !== JSON.stringify(currentSnapshot);
  }, [effectiveEditModeForDirty, storeValues, buildSnapshot, intakeFormBaselineTrigger]);

  useEffect(() => {
    if (effectiveEditModeForDirty) {
      if (!editEntrySnapshotRef.current) {
        captureEditEntrySnapshot();
      }
      baselineSnapshotRef.current = buildSnapshot(
        (store.getState() as WidgetRootState).widget.values,
      );
    } else {
      baselineSnapshotRef.current = null;
      editEntrySnapshotRef.current = null;
      onSectionDirtyChange?.(sectionId, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- baseline must be captured only when effectiveEditModeForDirty toggles
  }, [effectiveEditModeForDirty]);

  useEffect(() => {
    if (effectiveEditModeForDirty && onSectionDirtyChange) {
      onSectionDirtyChange(sectionId, isDirty);
    }
  }, [effectiveEditModeForDirty, isDirty, sectionId, onSectionDirtyChange]);

  const intakeFormSectionStatus = useMemo<'saved' | 'modified' | null>(() => {
    if (mode !== 'IntakeForm' || isDraft === false) return null;
    if (isDirty) return 'modified';
    if (hasBeenSavedByUser) return 'saved';
    return null;
  }, [mode, isDirty, hasBeenSavedByUser, isDraft]);

  const markIntakeFormSaved = useCallback((currentSchemaData: Record<string, unknown>) => {
    baselineSnapshotRef.current = buildSnapshot(currentSchemaData);
    setIntakeFormBaselineTrigger((prev) => prev + 1);
    setHasBeenSavedByUser(true);
  }, [buildSnapshot]);

  const markIntakeFormSavedWithoutData = useCallback(() => {
    setHasBeenSavedByUser(true);
  }, []);

  return {
    isDirty,
    intakeFormSectionStatus,
    editEntrySnapshotRef,
    captureEditEntrySnapshot,
    markIntakeFormSaved,
    markIntakeFormSavedWithoutData,
  };
};
