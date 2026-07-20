import { SectionConfig } from '../../../types';
import { UseBaseWidgetOptions } from '../../../hooks/useBaseWidget';
import { DataSourceRequestHandler } from '../../../types';
import { SectionMode } from '../../SectionsContainer';
import { rightArrowIcon } from '../../../assets';
import { useWidgetContext } from '../../WidgetProvider';
import { tSchema } from '../../../utils/tSchema';
import { PanelGrid } from './PanelGrid';
import { CRViewFooter } from './CRViewFooter';

export interface RegistryViewLayoutProps {
  mode: SectionMode;
  section: SectionConfig;
  gridId: string;
  editableSection: SectionConfig;
  dataSourceRequestHandler?: DataSourceRequestHandler;
  schemaData?: UseBaseWidgetOptions['schemaData'];
  onValueChange?: UseBaseWidgetOptions['onValueChange'];
  changeRequestType?: 'new' | 'old';
  showChangeRequestLabel?: boolean;
  crViewData: {
    createdBy?: unknown;
    createdDate?: unknown;
    approvedBy?: unknown;
    approvedDate?: unknown;
  } | null;
  effectiveHideEditButton: boolean;
  isEditMode: boolean;
  onEdit: () => void;
}

export const RegistryViewLayout = ({
  mode,
  section,
  gridId,
  editableSection,
  dataSourceRequestHandler,
  schemaData,
  onValueChange,
  changeRequestType,
  showChangeRequestLabel = true,
  crViewData,
  effectiveHideEditButton,
  isEditMode,
  onEdit,
}: RegistryViewLayoutProps) => {
  const { t } = useWidgetContext();
  const sectionTitle = section['section-title'];

  return (
    <>
      {sectionTitle && (
        <div
          style={{
            marginTop: '35px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <h2 className="text-xl font-semibold" style={{ margin: 0 }}>
            {tSchema(t, sectionTitle)}
          </h2>
          {mode === 'CRView' && changeRequestType && showChangeRequestLabel && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 12px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                backgroundColor:
                  changeRequestType === 'new'
                    ? 'var(--owt-color-success, #16A34A)'
                    : 'var(--owt-color-error-light, #FEE2E2)',
                color:
                  changeRequestType === 'new'
                    ? 'var(--owt-color-bg, #FFFFFF)'
                    : 'var(--owt-color-error, #B91C1C)',
                whiteSpace: 'nowrap',
                boxShadow:
                  changeRequestType === 'new' ? '0 2px 4px rgba(40, 167, 69, 0.3)' : 'none',
              }}
            >
              {changeRequestType === 'new' ? 'New' : 'Old'}
            </span>
          )}
        </div>
      )}
      <div
        id={gridId}
        className="section-panels"
        style={mode === 'RegistryView' && effectiveHideEditButton ? { paddingBottom: '30px' } : {}}
      >
        <PanelGrid
          panels={editableSection.panels}
          dataSourceRequestHandler={dataSourceRequestHandler}
          schemaData={schemaData}
          onValueChange={onValueChange}
          wrapInContainer={false}
        />
        {mode === 'CRView' && crViewData && (
          <CRViewFooter
            createdBy={crViewData.createdBy}
            createdDate={crViewData.createdDate}
            approvedBy={crViewData.approvedBy}
            approvedDate={crViewData.approvedDate}
          />
        )}
        {mode === 'RegistryView' && !effectiveHideEditButton && (
          <hr
            className="w-full"
            style={{
              height: '1px',
              marginTop: !isEditMode ? '10px' : 0,
              marginBottom: '14px',
              border: 'none',
              backgroundColor: 'var(--owt-color-border, #C4C4C4)',
            }}
          />
        )}
        {mode === 'RegistryView' && !isEditMode && !effectiveHideEditButton && (
          <div className="flex justify-center items-center" style={{ marginBottom: '20px' }}>
            <button
              onClick={onEdit}
              className="font-normal inline-flex items-center gap-2 bg-transparent border-0 p-0 cursor-pointer hover:opacity-80"
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '16px',
                color: 'var(--owt-color-text-muted, #727474)',
              }}
            >
              {t?.('common.editDetails') || 'Edit Details'}
              <img src={rightArrowIcon} alt="right-arrow" className="w-3.5 h-3.5 brightness-0 opacity-50" />
            </button>
          </div>
        )}
      </div>
    </>
  );
};
