import { useBaseWidget } from '../hooks/useBaseWidget';
import { tSchema } from '../utils/tSchema';
import { useWidgetContext } from '../components/WidgetProvider';
import { BaseWidgetConfig } from '../types';
import { WidgetFieldLabel } from '../components/WidgetFieldLabel';

interface ArrayWidgetProps {
  config: BaseWidgetConfig;
}

export const ArrayWidget = ({ config }: ArrayWidgetProps) => {
  const {
    value,
    error,
    touched,
    isEnabled,
    isRequired,
    onChange,
    config: widgetConfig,
  } = useBaseWidget({ config });

  const { t } = useWidgetContext();

  const items: any[] = Array.isArray(value) ? value : [];
  const itemConfig = widgetConfig['widget-item'];
  const operations = widgetConfig['widget-data-operations'] || {};
  const addLabel = (widgetConfig['widget-data-add-label'] ? tSchema(t, widgetConfig['widget-data-add-label']) : t?.('common.addItem'));
  const isReadonly = widgetConfig['widget-readonly'] || false;

  if (!itemConfig) {
    console.warn('ArrayWidget: widget-item configuration is required');
    return null;
  }

  const addItem = () => {
    const defaultValue = itemConfig['widget-data-default'] || '';
    onChange([...items, defaultValue]);
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  const updateItem = (index: number, newValue: any) => {
    const newItems = [...items];
    newItems[index] = newValue;
    onChange(newItems);
  };

  return (
    <div className="mb-[10px]">
      <div className="flex flex-col sm:flex-row sm:items-start mb-2">
        <WidgetFieldLabel
          className="text-base font-medium text-gray-700 md:min-w-[120px] sm:pr-4 sm:pt-1 mb-1 sm:mb-0"
          label={tSchema(t, widgetConfig['widget-label'])}
          required={isRequired}
        />
        <div className="flex-1 min-w-0 flex justify-between items-center">
          <div className="flex-1"></div>
          {operations.add && !isReadonly && isEnabled && (
            <button
              type="button"
              onClick={addItem}
              className="px-3 py-1 text-sm bg-blue-500 text-white hover:bg-blue-600"
              style={{ borderRadius: '15px' }}
            >
              {addLabel}
            </button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-gray-500 text-sm py-4 text-center border border-gray-300 rounded">
          {t?.('common.noItems')}. {operations.add && !isReadonly && t?.('common.clickToAdd', { label: addLabel })}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((itemValue, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 border border-gray-300 rounded"
              >
                <div className="flex-1">
                  <input
                    type="text"
                    value={itemValue || ''}
                    onChange={(e) => updateItem(index, e.target.value)}
                    disabled={isReadonly || !operations.edit || !isEnabled}
                    placeholder={tSchema(t, itemConfig['widget-data-placeholder']) || tSchema(t, itemConfig['widget-label'])}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {operations.remove && !isReadonly && (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    disabled={!isEnabled}
                    className="px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-50"
                    style={{ borderRadius: '15px' }}
                  >
                    {t?.('common.remove')}
                  </button>
                )}
              </div>
          ))}
        </div>
      )}

      {touched && error.length > 0 && (
        <p className="text-red-500 text-sm mt-1">{error[0]}</p>
      )}
      
    </div>
  );
};
