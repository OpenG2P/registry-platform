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
            borderRadius: 'var(--owt-btn-border-radius)',
            border: '1px solid var(--owt-btn-secondary-border)',
            backgroundColor: 'var(--owt-btn-secondary-bg)',
            color: 'var(--owt-btn-secondary-color)',
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
            borderRadius: 'var(--owt-btn-border-radius)',
            border: '1px solid var(--owt-btn-primary-border)',
            backgroundColor: 'var(--owt-color-primary)',
            color: 'var(--owt-color-bg)',
          }}
        >
          {t?.('common.save') || 'Save'}
        </button>
      </div>
    </div>
  );
};
