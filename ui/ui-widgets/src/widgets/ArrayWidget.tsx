import React from 'react';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { WidgetRenderer } from '../components/WidgetRenderer';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';

/**
 * Array widget for simple repeating values
 * 
 * Usage in schema:
 * {
 *   "widget": "array-widget",
 *   "widget-type": "group",
 *   "widget-label": "Skills",
 *   "widget-id": "skills",
 *   "widget-data-path": "person.skills",
 *   "widget-item": {
 *     "widget": "text",
 *     "widget-type": "input",
 *     "widget-label": "Skill"
 *   },
 *   "widget-data-add-label": "Add Skill",
 *   "widget-data-operations": {
 *     "add": true,
 *     "remove": true
 *   }
 * }
 */
interface ArrayWidgetProps {
  config: BaseWidgetConfig;
}

export const ArrayWidget = ({ config }: ArrayWidgetProps) => {
  const {
    value,
    error,
    touched,
    isEnabled,
    onChange,
    config: widgetConfig,
  } = useBaseWidget({ config });

  const { translate, translateConfig } = useWidgetTranslation();

  const items: any[] = Array.isArray(value) ? value : [];
  const itemConfig = widgetConfig['widget-item'];
  const operations = widgetConfig['widget-data-operations'] || {};
  const addLabel = translateConfig(
    widgetConfig['widget-data-add-label'],
    translate('common.addItem')
  );
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
        <label className="text-base font-medium text-gray-700 md:min-w-[120px] sm:pr-4 sm:pt-1 mb-1 sm:mb-0" style={{ fontFamily: 'Roboto, sans-serif' }} title={translateConfig(widgetConfig['widget-label'])}>
          {translateConfig(widgetConfig['widget-label'])}
          {widgetConfig['widget-required'] && (
            <span className="text-red-500 ml-1">*</span>
          )}
        </label>
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
          {translate('common.noItems')}. {operations.add && !isReadonly && translate('common.clickToAdd', { label: addLabel })}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((itemValue, index) => {
            const itemWidgetConfig: BaseWidgetConfig = {
              ...itemConfig,
              'widget-id': `${widgetConfig['widget-id']}-item-${index}`,
              'widget-readonly': isReadonly || !operations.edit,
            };

            return (
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
                    placeholder={translateConfig(itemConfig['widget-data-placeholder']) || translateConfig(itemConfig['widget-label'])}
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
                    {translate('common.remove')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {touched && error.length > 0 && (
        <p className="text-red-500 text-sm mt-1">{error[0]}</p>
      )}
      {/* {widgetConfig['widget-data-helptext'] && (
        <p className="text-gray-500 text-sm mt-1">
          {translateConfig(widgetConfig['widget-data-helptext'])}
        </p>
      )} */}
    </div>
  );
};
