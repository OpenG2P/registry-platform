import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useWidgetTheme } from '../../hooks/useWidgetTheme';
import { themeToCSSVariables } from '../../theme';
import { useWidgetContext } from '../WidgetProvider';
import { WidgetRootState } from '../../store';
import { collectWidgets } from '../../utils/sectionValidate';
import { SectionRendererProps } from './types';
import {
  resolveSectionColumnSpan,
  buildReadonlyStyleSelectors,
  buildEditableSection,
} from './utils';
import {
  useIntakeFormAccordion,
  useSectionEditPortal,
  useSectionDirty,
  useSectionActions,
} from './hooks';
import {
  SectionStyles,
  EditSectionPortal,
  IntakeFormLayout,
  RegistryViewLayout,
} from './components';

export const SectionRenderer = ({
  section,
  dataSourceRequestHandler: propDataSourceRequestHandler,
  schemaData,
  onValueChange,
  gridColumnSpan,
  onSectionSave,
  hideEditButton = false,
  mode = 'RegistryView',
  changeRequestType,
  showChangeRequestLabel = true,
  dbSectionId,
  sectionRegisterId,
  onSectionDirtyChange,
  sectionIndex,
  expandedSectionIndex,
  onExpandSection,
  onSectionSaveSuccess,
  onPreviousSection,
  isDraft,
  isAccessible = false,
  onEditModeChange,
  forceExitEdit,
}: SectionRendererProps) => {
  const resolvedTheme = useWidgetTheme();
  const portalCSSVariables = useMemo(
    () => themeToCSSVariables(resolvedTheme),
    [resolvedTheme],
  );
  const { schemaData: contextSchemaData, dataSourceRequestHandler: contextDataSourceRequestHandler } =
    useWidgetContext();

  const dataSourceRequestHandler =
    propDataSourceRequestHandler || contextDataSourceRequestHandler;
  const storeValues = useSelector(
    (state: WidgetRootState) => state.widget?.values || {},
  );

  const originalSectionId = section['section-id'];
  const sectionId = section['section-id'];
  const gridId = `section-panels-${sectionId}`;
  const sectionClassId = `section-${sectionId}`;

  const { columnSpan, hasTable: hasTableWidget, hasExplicitTableSpan } = useMemo(
    () => resolveSectionColumnSpan(section.panels, gridColumnSpan),
    [section.panels, gridColumnSpan],
  );

  const readonlyStyles = useMemo(
    () => buildReadonlyStyleSelectors(sectionClassId),
    [sectionClassId],
  );

  const supportingDocuments = section['section-supporting-documents'] || [];
  const hasSupportingDocuments = supportingDocuments.length > 0;

  const { isExpanded, handleAccordionToggle } = useIntakeFormAccordion(
    mode,
    sectionIndex,
    expandedSectionIndex,
    isAccessible,
    onExpandSection,
  );

  const {
    isEditMode,
    sectionRef,
    sectionHeight,
    editSectionPosition,
    enterEditMode,
    exitEditMode,
  } = useSectionEditPortal(forceExitEdit);

  const widgetsEditable = mode === 'IntakeForm' ? isDraft !== false : isEditMode;
  const editableSection = useMemo(
    () => buildEditableSection(section, widgetsEditable),
    [section, widgetsEditable],
  );

  const effectiveHideEditButton =
    hideEditButton ||
    section['section-hide-edit-button'] === true ||
    !collectWidgets(section.panels || []).some(
      (w) => section['section-editable'] === true || w['widget-readonly'] !== true,
    );

  const {
    isDirty,
    intakeFormSectionStatus,
    editEntrySnapshotRef,
    captureEditEntrySnapshot,
    markIntakeFormSaved,
    markIntakeFormSavedWithoutData,
  } = useSectionDirty({
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
  });

  const { handleEdit, handleCancel, handleSave, handleIntakeFormSave } = useSectionActions({
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
  });

  return (
    <>
      <EditSectionPortal
        mode={mode}
        isEditMode={isEditMode}
        editSectionPosition={editSectionPosition}
        sectionClassId={sectionClassId}
        sectionId={sectionId}
        gridId={gridId}
        sectionTitle={section['section-title']}
        portalCSSVariables={portalCSSVariables}
        editableSection={editableSection}
        dataSourceRequestHandler={dataSourceRequestHandler}
        schemaData={schemaData}
        onValueChange={onValueChange}
        supportingDocuments={supportingDocuments}
        hasSupportingDocuments={hasSupportingDocuments}
        isDirty={isDirty}
        onCancel={handleCancel}
        onSave={handleSave}
      />
      <SectionStyles
        sectionClassId={sectionClassId}
        gridId={gridId}
        columnSpan={columnSpan}
        hasTableWidget={hasTableWidget}
        readonlyValueRowRootsCss={readonlyStyles.readonlyValueRowRootsCss}
        readonlyValueRowFlex1Css={readonlyStyles.readonlyValueRowFlex1Css}
        readonlySingleLineValueTextCss={readonlyStyles.readonlySingleLineValueTextCss}
      />
      <div
        ref={sectionRef}
        className={`section ${sectionClassId} px-4 sm:px-6 lg:px-8 border-2 ${mode === 'IntakeForm' ? 'intake-form-accordion-item' : ''}`}
        data-section-id={sectionId}
        data-has-table={hasTableWidget ? 'true' : 'false'}
        data-has-explicit-span={hasExplicitTableSpan ? 'true' : 'false'}
        data-edit-mode={isEditMode ? 'true' : 'false'}
        data-section-dirty={isEditMode && isDirty ? 'true' : 'false'}
        data-column-span={columnSpan}
        data-change-request-type={changeRequestType}
        data-intake-form-expanded={
          mode === 'IntakeForm' ? (isExpanded ? 'true' : 'false') : undefined
        }
        style={{
          gridColumn: `span ${columnSpan}`,
          width: '100%',
          borderRadius: 'var(--owt-section-border-radius, 10px)',
          borderColor: 'var(--owt-color-bg, #FFFFFF)',
          ...(mode === 'IntakeForm' && isExpanded
            ? {
                backgroundColor: 'var(--owt-color-primary-light, #FBE6AA)',
                border: '1px dashed var(--owt-color-primary-dark, #F07B1A)',
              }
            : {
                backgroundColor: 'var(--owt-section-bg, #FFFFFF)',
              }),
          ...(isEditMode && sectionHeight
            ? { height: `${sectionHeight}px`, minHeight: `${sectionHeight}px` }
            : { minHeight: 'auto', height: 'auto' }),
        }}
      >
        {mode === 'IntakeForm' ? (
          <IntakeFormLayout
            section={section}
            sectionId={sectionId}
            gridId={gridId}
            sectionIndex={sectionIndex}
            isExpanded={isExpanded}
            isAccessible={isAccessible}
            isDraft={isDraft}
            intakeFormSectionStatus={intakeFormSectionStatus}
            editableSection={editableSection}
            supportingDocuments={supportingDocuments}
            hasSupportingDocuments={hasSupportingDocuments}
            dataSourceRequestHandler={dataSourceRequestHandler}
            schemaData={schemaData}
            onValueChange={onValueChange}
            onAccordionToggle={handleAccordionToggle}
            onPreviousSection={onPreviousSection}
            onSave={handleIntakeFormSave}
          />
        ) : (
          <RegistryViewLayout
            mode={mode}
            section={section}
            gridId={gridId}
            editableSection={editableSection}
            dataSourceRequestHandler={dataSourceRequestHandler}
            schemaData={schemaData}
            onValueChange={onValueChange}
            changeRequestType={changeRequestType}
            showChangeRequestLabel={showChangeRequestLabel}
            effectiveHideEditButton={effectiveHideEditButton}
            isEditMode={isEditMode}
            onEdit={handleEdit}
          />
        )}
      </div>
    </>
  );
};
