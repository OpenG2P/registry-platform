import { SectionConfig } from '../../../types';
import { UseBaseWidgetOptions } from '../../../hooks/useBaseWidget';
import { DataSourceRequestHandler } from '../../../types';
import { SectionMode } from '../../SectionsContainer';
import { rightArrowIcon } from '../../../assets';
import { useWidgetContext } from '../../WidgetProvider';
import { tSchema } from '../../../utils/tSchema';
import { PanelGrid } from './PanelGrid';

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
                    ? 'var(--owt-color-success)'
                    : 'var(--owt-color-error-light)',
                color:
                  changeRequestType === 'new'
                    ? 'var(--owt-color-bg)'
                    : 'var(--owt-color-error)',
                whiteSpace: 'nowrap',
                boxShadow:
                  changeRequestType === 'new' ? '0 2px 4px color-mix(in srgb, var(--owt-color-success) 30%, transparent)' : 'none',
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
        style={
          mode === 'CRView' || (mode === 'RegistryView' && effectiveHideEditButton)
            ? { paddingBottom: '30px' }
            : {}
        }
      >
        <PanelGrid
          panels={editableSection.panels}
          dataSourceRequestHandler={dataSourceRequestHandler}
          schemaData={schemaData}
          onValueChange={onValueChange}
          wrapInContainer={false}
        />
        {mode === 'RegistryView' && !effectiveHideEditButton && (
          <div
            className="section-divider"
            role="separator"
            style={{
              flex: '0 0 100%',
              width: '100%',
              maxWidth: '100%',
              height: '1px',
              marginTop: !isEditMode ? '10px' : 0,
              marginBottom: '14px',
              backgroundColor: 'var(--owt-color-border)',
            }}
          />
        )}
        {mode === 'RegistryView' && !isEditMode && !effectiveHideEditButton && (
          <div
            className="registry-edit-details flex justify-start items-center"
            style={{ marginBottom: '20px' }}
          >
            <button
              onClick={onEdit}
              className="font-normal inline-flex items-center gap-2 bg-transparent border-0 p-0 cursor-pointer hover:opacity-80"
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '16px',
                color: 'var(--owt-color-text-muted)',
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
