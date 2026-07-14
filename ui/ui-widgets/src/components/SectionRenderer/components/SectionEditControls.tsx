import { useWidgetContext } from '../../WidgetProvider';

export interface SectionEditControlsProps {
  onCancel: () => void;
  onSave: () => void;
  isDirty: boolean;
}

export const SectionEditControls = ({
  onCancel,
  onSave,
  isDirty,
}: SectionEditControlsProps) => {
  const { t } = useWidgetContext();

  return (
    <div className="edit-controls-container" style={{ marginBottom: '20px' }}>
      <div className="edit-controls-buttons">
        <button
          onClick={onCancel}
          className="text-sm font-medium px-6 py-2 transition-colors"
          style={{
            fontFamily: 'Roboto, sans-serif',
            borderRadius: 'var(--owt-btn-border-radius, 10px)',
            border: '1px solid var(--owt-btn-secondary-border, #C4C4C4)',
            backgroundColor: 'var(--owt-btn-secondary-bg, #FFFFFF)',
            color: 'var(--owt-btn-secondary-color, #011627)',
          }}
        >
          {t?.('common.cancel') || 'Cancel'}
        </button>
        <button
          onClick={onSave}
          disabled={!isDirty}
          className="text-sm font-medium px-6 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            fontFamily: 'Roboto, sans-serif',
            borderRadius: 'var(--owt-btn-border-radius, 10px)',
            border: '1px solid var(--owt-btn-primary-border, #F07B1A)',
            backgroundColor: 'var(--owt-color-primary, #F5BB1A)',
            color: 'var(--owt-color-bg, #FFFFFF)',
          }}
        >
          {t?.('common.save') || 'Save'}
        </button>
      </div>
    </div>
  );
};
