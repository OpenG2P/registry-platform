import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useStore, useDispatch } from 'react-redux';
import { SectionConfig, DataSourceRequestHandler } from '../types';
import { UseBaseWidgetOptions } from '../hooks/useBaseWidget';
import { SectionRenderer, SectionChanges } from './SectionRenderer';
import { useWidgetContext } from './WidgetProvider';
import { sectionValidate } from '../utils/sectionValidate';
import { buildSectionChanges } from './SectionRenderer/utils/sectionSnapshot';

export type SectionMode = 'RegistryView' | 'CRView' | 'IntakeForm';

export interface SectionsFormHandle {
  validate(): Promise<boolean>;
  getFormData(): Record<string, unknown>;
  validateAndGetData(): Promise<SectionChanges[]>;
  getStructuredData(): SectionChanges[];
  hasUnsavedChanges(): boolean;
}

export interface SectionsContainerProps {
  sections: SectionConfig[];
  dataSourceRequestHandler?: DataSourceRequestHandler;
  schemaData?: UseBaseWidgetOptions['schemaData'];
  onValueChange?: UseBaseWidgetOptions['onValueChange'];
  className?: string;
  onSectionSave?: (changes: SectionChanges) => Promise<void> | void;
  hideEditButton?: boolean;
  mode?: SectionMode;
  isDraft?: boolean;
  onSectionDirtyChange?: (sectionId: string, isDirty: boolean) => void;
  onFormReady?: (handle: SectionsFormHandle) => void;
}

import {
  countVerticalPanels,
  hasTableWidget,
  getTableWidgetColumnSpan,
} from './SectionRenderer/utils/panelLayout';
export const SectionsContainer = ({
  sections,
  dataSourceRequestHandler: propDataSourceRequestHandler,
  schemaData,
  onValueChange,
  className = '',
  onSectionSave,
  hideEditButton = false,
  mode = 'RegistryView',
  isDraft,
  onSectionDirtyChange,
  onFormReady,
}: SectionsContainerProps) => {
  const store = useStore();
  const dispatch = useDispatch();

  const { dataSourceRequestHandler: contextDataSourceRequestHandler } = useWidgetContext();
  const dataSourceRequestHandler = propDataSourceRequestHandler || contextDataSourceRequestHandler;

  const [expandedSectionIndex, setExpandedSectionIndex] = useState<number | null>(0);
  const [maxVisitedIndex, setMaxVisitedIndex] = useState<number>(-1);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);

  const handleEditModeChange = useCallback((sectionId: string, editing: boolean) => {
    setEditingSectionId(editing ? sectionId : null);
  }, []);
  const safeSections = sections ?? [];
  const prevSectionsLengthRef = useRef(safeSections.length);

  const modeRef = useRef(mode);
  modeRef.current = mode;
  const setExpandedSectionIndexRef = useRef(setExpandedSectionIndex);

  const sectionDirtyMapRef = useRef<Record<string, boolean>>({});
  const handleSectionDirtyChange = useCallback((sectionId: string, isDirty: boolean) => {
    sectionDirtyMapRef.current = { ...sectionDirtyMapRef.current, [sectionId]: isDirty };
    onSectionDirtyChange?.(sectionId, isDirty);
  }, [onSectionDirtyChange]);

  const handleExpandSection = useCallback((index: number) => {
    setExpandedSectionIndex(prev => (prev === index ? null : index));
  }, []);

  const handleSectionSaveSuccess = useCallback((index: number) => {
    setMaxVisitedIndex(prev => Math.max(prev, index));
    if (index + 1 < safeSections.length) {
      setExpandedSectionIndex(index + 1);
    } else {
      setExpandedSectionIndex(null);
    }
  }, [safeSections.length]);

  const handlePreviousSection = useCallback((index: number) => {
    if (index > 0) {
      setExpandedSectionIndex(index - 1);
    }
  }, []);

  useEffect(() => {
    if (mode !== 'IntakeForm') return;
    const currentLength = safeSections.length;
    const prevLength = prevSectionsLengthRef.current;

    if (currentLength > 0 && expandedSectionIndex !== null && expandedSectionIndex >= currentLength) {
      setExpandedSectionIndex(0);
    }
    if (prevLength === 0 && currentLength > 0) {
      setExpandedSectionIndex(0);
    }

    prevSectionsLengthRef.current = currentLength;
  }, [mode, safeSections.length, expandedSectionIndex]);

  const UNSAVED_CHANGES_ERROR = 'Unsaved changes detected. Please save all sections before submitting.';

  const formHandle = useMemo<SectionsFormHandle>(() => {
    const getValues = () => (store.getState() as { widget?: { values?: Record<string, unknown> } }).widget?.values || {};

    const checkNoUnsavedChanges = () => {
      const hasDirty = Object.values(sectionDirtyMapRef.current).some(Boolean);
      if (hasDirty) {
        throw new Error(UNSAVED_CHANGES_ERROR);
      }
    };

    return {
      validate: async () => {
        if (modeRef.current !== 'IntakeForm') checkNoUnsavedChanges();
        const values = getValues() as Record<string, unknown>;
        let allValid = true;
        let firstInvalidIndex: number | null = null;
        for (let i = 0; i < safeSections.length; i++) {
          const section = safeSections[i];
          const valid = sectionValidate(section, values, dispatch);
          if (!valid) {
            if (firstInvalidIndex === null) firstInvalidIndex = i;
            allValid = false;
          }
        }
        if (!allValid && modeRef.current === 'IntakeForm' && firstInvalidIndex !== null) {
          setExpandedSectionIndexRef.current(firstInvalidIndex);
        }
        return allValid;
      },
      getFormData: () => getValues(),
      validateAndGetData: async () => {
        if (modeRef.current !== 'IntakeForm') checkNoUnsavedChanges();
        const values = getValues() as Record<string, unknown>;
        const results: SectionChanges[] = [];
        let firstInvalidIndex: number | null = null;
        for (let i = 0; i < safeSections.length; i++) {
          const section = safeSections[i];
          const valid = sectionValidate(section, values, dispatch);
          if (!valid) {
            if (firstInvalidIndex === null) firstInvalidIndex = i;
          } else {
            results.push(buildSectionChanges(section, values));
          }
        }
        if (firstInvalidIndex !== null) {
          if (modeRef.current === 'IntakeForm') {
            setExpandedSectionIndexRef.current(firstInvalidIndex);
          }
          throw new Error('Validation failed. Please fix the errors and try again.');
        }
        return results;
      },
      getStructuredData: () => {
        const values = getValues() as Record<string, unknown>;
        const results: SectionChanges[] = [];
        for (let i = 0; i < safeSections.length; i++) {
          const section = safeSections[i];
          results.push(buildSectionChanges(section, values));
        }
        return results;
      },
      hasUnsavedChanges: () => Object.values(sectionDirtyMapRef.current).some(Boolean),
    };
  }, [store, dispatch, safeSections]);

  useEffect(() => {
    if (onFormReady && safeSections.length > 0) {
      onFormReady(formHandle);
    }
  }, [onFormReady, formHandle, safeSections.length]);

  useEffect(() => {
    if (!dataSourceRequestHandler) {
      console.warn(
        '[SectionsContainer] ⚠️ dataSourceRequestHandler is not provided. ' +
        'Sections with widgets that have API data sources will not be able to load data. ' +
        'Please provide dataSourceRequestHandler prop to SectionsContainer or WidgetProvider.'
      );
    }
  }, [dataSourceRequestHandler]);

  const maxVerticalPanels = Math.max(
    ...safeSections.map(section => {
      const panelCount = countVerticalPanels(section.panels);
      const tableWidgetSpan = getTableWidgetColumnSpan(section.panels);
      return tableWidgetSpan !== null
        ? Math.max(panelCount, tableWidgetSpan)
        : hasTableWidget(section.panels, true)
          ? Math.max(panelCount, 2)
          : panelCount;
    }),
    3
  );

  const containerId = 'sections-container-grid';

  return (
    <>
      <style>{`
        #${containerId} {
          display: grid;
          grid-template-columns: repeat(${maxVerticalPanels}, minmax(200px, 1fr));
          gap: 1.5rem;
          width: 100%;
          align-items: start;
        }

        #${containerId} > .section[data-has-table="true"][data-has-explicit-span="false"] {
          grid-column: 1 / -1;
          width: 100%;
        }

        #${containerId} > .section[data-has-explicit-span="true"] {
          width: 100%;
        }

        @media (max-width: 1023px) {
          #${containerId} {
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          }
        }

        #${containerId}.sections-container-intake-form {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          grid-template-columns: unset;
        }
        #${containerId}.sections-container-intake-form > .section {
          grid-column: unset;
          width: 100%;
        }
      `}</style>
      <div
        id={containerId}
        className={`sections-container ${className}${mode === 'IntakeForm' ? ' sections-container-intake-form' : ''}`}
      >
        {safeSections.map((section, index) => {
          const hideEditForSection =
            hideEditButton || section['section-hide-edit-button'] === true;

          const intakeFormProps = mode === 'IntakeForm'
            ? {
              sectionIndex: index,
              sectionCount: safeSections.length,
              expandedSectionIndex,
              onExpandSection: handleExpandSection,
              onSectionSaveSuccess: handleSectionSaveSuccess,
              onPreviousSection: handlePreviousSection,
              isDraft,
              isAccessible: index <= maxVisitedIndex + 1,
            }
            : {};

          const registryViewEditProps = mode === 'RegistryView'
            ? {
              onEditModeChange: handleEditModeChange,
              forceExitEdit: editingSectionId !== null && editingSectionId !== section['section-id'],
            }
            : {};

          if (section['section-column-span']) {
            return (
              <SectionRenderer
                key={section['section-id']}
                section={section}
                dataSourceRequestHandler={dataSourceRequestHandler}
                schemaData={schemaData}
                onValueChange={onValueChange}
                gridColumnSpan={section['section-column-span']}
                onSectionSave={onSectionSave}
                hideEditButton={hideEditForSection}
                mode={mode}
                onSectionDirtyChange={handleSectionDirtyChange}
                {...intakeFormProps}
                {...registryViewEditProps}
              />
            );
          }

          const verticalPanelsCount = countVerticalPanels(section.panels);
          const tableWidgetColumnSpan = getTableWidgetColumnSpan(section.panels);
          const containsTable = hasTableWidget(section.panels, true);
          const columnSpan = tableWidgetColumnSpan !== null
            ? tableWidgetColumnSpan
            : (containsTable ? Math.max(verticalPanelsCount, 2) : verticalPanelsCount);
          return (
            <SectionRenderer
              key={section['section-id']}
              section={section}
              dataSourceRequestHandler={dataSourceRequestHandler}
              schemaData={schemaData}
              onValueChange={onValueChange}
              gridColumnSpan={columnSpan}
              onSectionSave={onSectionSave}
              hideEditButton={hideEditForSection}
              mode={mode}
              onSectionDirtyChange={handleSectionDirtyChange}
              {...intakeFormProps}
              {...registryViewEditProps}
            />
          );
        })}
      </div>
    </>
  );
};
