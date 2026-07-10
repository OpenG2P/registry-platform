import { SectionConfig, SupportingDocumentConfig, DataSourceRequestHandler } from '../../../types';
import { tSchema } from '../../../utils/tSchema';
import { UseBaseWidgetOptions } from '../../../hooks/useBaseWidget';
import { arrowUpIcon, arrowDownIcon, arrowLeftIcon, arrowRightIcon } from '../../../assets';
import { useWidgetContext } from '../../WidgetProvider';
import { PanelGrid } from './PanelGrid';
import { SupportingDocuments } from './SupportingDocuments';

export interface IntakeFormLayoutProps {
  section: SectionConfig;
  sectionId: string;
  gridId: string;
  sectionIndex?: number;
  isExpanded: boolean;
  isAccessible: boolean;
  isDraft?: boolean;
  intakeFormSectionStatus: 'saved' | 'modified' | null;
  editableSection: SectionConfig;
  supportingDocuments: SupportingDocumentConfig[];
  hasSupportingDocuments: boolean;
  dataSourceRequestHandler?: DataSourceRequestHandler;
  schemaData?: UseBaseWidgetOptions['schemaData'];
  onValueChange?: UseBaseWidgetOptions['onValueChange'];
  onAccordionToggle: () => void;
  onPreviousSection?: (index: number) => void;
  onSave: () => void;
}

export const IntakeFormLayout = ({
  section,
  sectionId,
  gridId,
  sectionIndex,
  isExpanded,
  isAccessible,
  isDraft,
  intakeFormSectionStatus,
  editableSection,
  supportingDocuments = [],
  hasSupportingDocuments,
  dataSourceRequestHandler,
  schemaData,
  onValueChange,
  onAccordionToggle,
  onPreviousSection,
  onSave,
}: IntakeFormLayoutProps) => {
  const { t } = useWidgetContext();
  const sectionTitle = section['section-title'];

  return (
    <>
      <button
        type="button"
        id={`intake-form-accordion-header-${sectionId}`}
        className="intake-form-accordion-header"
        onClick={onAccordionToggle}
        aria-expanded={isExpanded}
        aria-controls={isExpanded ? `intake-form-accordion-content-${sectionId}` : undefined}
        data-interactive={sectionIndex === undefined || isAccessible ? 'true' : 'false'}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '16px 0',
          marginTop: '16px',
          marginBottom: 0,
          background: 'none',
          border: 'none',
          cursor: sectionIndex === undefined || isAccessible ? 'pointer' : 'default',
          textAlign: 'left',
          fontFamily: 'Roboto, sans-serif',
        }}
      >
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <h2 className="text-xl font-semibold" style={{ margin: 0 }}>
            {sectionTitle
              ? tSchema(t, sectionTitle)
              : `Section ${(sectionIndex ?? 0) + 1}`}
          </h2>
          {intakeFormSectionStatus === 'saved' && (
            <span
              style={{
                display: 'inline-block',
                padding: '4px 10px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: 500,
                backgroundColor: 'var(--owt-color-success-light, #D1FAE5)',
                color: 'var(--owt-color-success-dark, #047857)',
              }}
            >
              {t?.('common.sectionSaved') || 'Saved'}
            </span>
          )}
          {intakeFormSectionStatus === 'modified' && (
            <span
              style={{
                display: 'inline-block',
                padding: '4px 10px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: 500,
                backgroundColor: 'var(--owt-color-error-light, #FEE2E2)',
                color: 'var(--owt-color-error, #B91C1C)',
              }}
            >
              {t?.('common.sectionModified') || 'Modified and not saved'}
            </span>
          )}
        </div>
        <img
          src={isExpanded ? arrowUpIcon : arrowDownIcon}
          alt={isExpanded ? 'Collapse' : 'Expand'}
          className="w-5 h-5 transition-transform"
          style={{ flexShrink: 0, marginLeft: '12px' }}
          aria-hidden
        />
      </button>
      {isExpanded && (
        <div
          id={`intake-form-accordion-content-${sectionId}`}
          className="intake-form-accordion-content"
          role="region"
          aria-labelledby={`intake-form-accordion-header-${sectionId}`}
        >
          <div id={gridId} className="section-panels" style={{ paddingTop: '8px' }}>
            <PanelGrid
              panels={editableSection.panels}
              dataSourceRequestHandler={dataSourceRequestHandler}
              schemaData={schemaData}
              onValueChange={onValueChange}
              isEditMode={isDraft !== false}
              wrapInContainer={false}
            />
            <hr
              className="w-full"
              style={{
                height: '1px',
                backgroundColor: 'var(--owt-section-divider-color, #F5BB1A)',
                border: 'none',
                margin: '15px 0 0 0',
              }}
            />
            {hasSupportingDocuments && (
              <SupportingDocuments
                sectionId={sectionId}
                documents={supportingDocuments}
                mode="IntakeForm"
                isDraft={isDraft}
              />
            )}
            <div
              className="intake-form-edit-controls"
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '12px',
                marginTop: '10px',
                marginBottom: '10px',
                width: '100%',
              }}
            >
              {typeof sectionIndex === 'number' && sectionIndex > 0 && (
                <button
                  type="button"
                  onClick={() => onPreviousSection?.(sectionIndex)}
                  className="intake-form-prev-btn"
                  style={{
                    fontFamily: 'Roboto, sans-serif',
                    fontSize: '14px',
                    fontWeight: 400,
                    padding: '8px 24px',
                    borderRadius: 'var(--owt-btn-border-radius, 10px)',
                    border: '1px solid var(--owt-btn-primary-border, #F07B1A)',
                    background: 'var(--owt-btn-primary-bg, #FFFFFF)',
                    color: 'var(--owt-color-text-muted, #727474)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <img
                    src={arrowLeftIcon}
                    alt=""
                    aria-hidden
                    style={{ width: '14px', height: '14px', opacity: 0.5 }}
                  />
                  {t?.('common.previous') || 'Prev'}
                </button>
              )}
              <button
                type="button"
                onClick={onSave}
                className="intake-form-save-btn"
                style={{
                  fontFamily: 'Roboto, sans-serif',
                  fontSize: '14px',
                  fontWeight: 400,
                  padding: '8px 24px',
                  borderRadius: 'var(--owt-btn-border-radius, 10px)',
                  border: '1px solid var(--owt-btn-primary-border, #F07B1A)',
                  background: 'var(--owt-btn-primary-bg, #FFFFFF)',
                  color: 'var(--owt-color-text-muted, #727474)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {t?.('common.next') || 'Next'}
                <img
                  src={arrowRightIcon}
                  alt=""
                  aria-hidden
                  style={{ width: '14px', height: '14px' }}
                />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
