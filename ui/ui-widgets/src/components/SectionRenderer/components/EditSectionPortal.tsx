import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
import { SectionConfig, SupportingDocumentConfig } from '../../../types';
import { UseBaseWidgetOptions } from '../../../hooks/useBaseWidget';
import { DataSourceRequestHandler } from '../../../types';
import { SectionMode } from '../../SectionsContainer';
import { useWidgetContext } from '../../WidgetProvider';
import { tSchema } from '../../../utils/tSchema';
import { PanelGrid } from './PanelGrid';
import { SupportingDocuments } from './SupportingDocuments';
import { SectionEditControls } from './SectionEditControls';

export interface EditSectionPortalProps {
  mode: SectionMode;
  isEditMode: boolean;
  editSectionPosition: { top: number; left: number; width: number } | null;
  sectionClassId: string;
  sectionId: string;
  gridId: string;
  sectionTitle?: string;
  portalCSSVariables: CSSProperties;
  editableSection: SectionConfig;
  dataSourceRequestHandler?: DataSourceRequestHandler;
  schemaData?: UseBaseWidgetOptions['schemaData'];
  onValueChange?: UseBaseWidgetOptions['onValueChange'];
  supportingDocuments: SupportingDocumentConfig[];
  hasSupportingDocuments: boolean;
  isDirty: boolean;
  onCancel: () => void;
  onSave: () => void;
}

export const EditSectionPortal = ({
  mode,
  isEditMode,
  editSectionPosition,
  sectionClassId,
  sectionId,
  gridId,
  sectionTitle,
  portalCSSVariables,
  editableSection,
  dataSourceRequestHandler,
  schemaData,
  onValueChange,
  supportingDocuments,
  hasSupportingDocuments,
  isDirty,
  onCancel,
  onSave,
}: EditSectionPortalProps) => {
  const { t } = useWidgetContext();
  const [isDocumentsExpanded, setIsDocumentsExpanded] = useState(true);

  if (mode === 'IntakeForm' || !isEditMode || !editSectionPosition) return null;

  const editGridId = `${gridId}-edit`;

  return createPortal(
    <>
      <style>{`
        #${editGridId} {
          display: flex;
          flex-wrap: wrap;
          width: 100%;
        }
        #${editGridId} > .panel-wrapper {
          flex: 1 1 100%;
          min-width: 0;
        }
        @media (min-width: 640px) {
          #${editGridId} > .panel-wrapper {
            flex: 1 1 calc(50% - 0.75rem);
          }
        }
        @media (min-width: 1024px) {
          #${editGridId} > .panel-wrapper {
            flex: 1 1 calc(33.333% - 1rem);
          }
        }
        @media (min-width: 1280px) {
          #${editGridId} > .panel-wrapper {
            flex: 1 1 calc(25% - 1.125rem);
          }
        }
        @media (min-width: 1536px) {
          #${editGridId} > .panel-wrapper {
            flex: 1 1 calc(20% - 1.2rem);
          }
        }
        #${editGridId} > .panel-wrapper {
          position: relative;
        }
        #${editGridId} > .panel-wrapper:not(.last-panel-wrapper)::after {
          content: '';
          position: absolute;
          right: 0;
          top: 0;
          bottom: 5px;
          width: 1px;
          background-color: var(--owt-color-primary);
        }
        #${editGridId} > .section-divider {
          flex: 0 0 100%;
          width: 100%;
          max-width: 100%;
        }
      `}</style>
      <div
        className={`openg2p-widget-theme-root section ${sectionClassId} ${sectionClassId}-edit px-4 sm:px-6 lg:px-8`}
        data-section-id={`${sectionId}-edit`}
        style={{
          ...portalCSSVariables,
          position: 'absolute',
          top: `${editSectionPosition.top}px`,
          left: `${editSectionPosition.left}px`,
          width: `${editSectionPosition.width}px`,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {sectionTitle && (
          <h2
            className="text-xl font-semibold mb-4"
            style={{ fontFamily: 'Roboto, sans-serif', marginTop: '35px' }}
          >
            {tSchema(t, sectionTitle)}
          </h2>
        )}
        <div id={editGridId} className="section-panels">
          <PanelGrid
            panels={editableSection.panels}
            dataSourceRequestHandler={dataSourceRequestHandler}
            schemaData={schemaData}
            onValueChange={onValueChange}
            isEditMode
            wrapInContainer={false}
            getPanelWrapperClassName={(index, total) =>
              `panel-wrapper ${index === total - 1 ? 'last-panel-wrapper' : ''}`
            }
          />
          {hasSupportingDocuments && (
            <>
              <div
                className="section-divider"
                role="separator"
                style={{
                  flex: '0 0 100%',
                  width: '100%',
                  maxWidth: '100%',
                  height: '1px',
                  backgroundColor: 'var(--owt-color-primary)',
                  margin: '25px 0 0 0',
                }}
              />
              <SupportingDocuments
                sectionId={sectionId}
                documents={supportingDocuments}
                mode={mode}
                expanded={isDocumentsExpanded}
                onToggleExpanded={() => setIsDocumentsExpanded(!isDocumentsExpanded)}
                collapsible
              />
            </>
          )}
          <div
            className="section-divider"
            role="separator"
            style={{
              flex: '0 0 100%',
              width: '100%',
              maxWidth: '100%',
              height: '1px',
              backgroundColor: 'var(--owt-color-primary)',
              marginTop: hasSupportingDocuments ? '20px' : '25px',
              marginBottom: '20px',
            }}
          />
          <SectionEditControls
            onCancel={onCancel}
            onSave={onSave}
            isDirty={isDirty}
          />
        </div>
      </div>
    </>,
    document.body,
  );
};
