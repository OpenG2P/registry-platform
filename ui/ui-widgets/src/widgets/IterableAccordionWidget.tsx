import React, { useState } from 'react';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { WidgetRenderer } from '../components/WidgetRenderer';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';
import { WidgetFieldLabel } from '../components/WidgetFieldLabel';

interface IterableAccordionWidgetProps {
  config: BaseWidgetConfig;
}

export const IterableAccordionWidget = ({ config }: IterableAccordionWidgetProps) => {
  const {
    value,
    error,
    touched,
    isEnabled,
    isRequired,
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
  const defaultCollapsed = widgetConfig['widget-data-collapsed'] ?? false;
  const isReadonly = widgetConfig['widget-readonly'] || false;

  const [collapsedItems, setCollapsedItems] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    items.forEach((_, index) => {
      initial[index] = defaultCollapsed;
    });
    return initial;
  });

  if (!itemConfig) {
    console.warn('IterableAccordionWidget: widget-item configuration is required');
    return null;
  }

  const toggleCollapse = (index: number) => {
    setCollapsedItems((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const addItem = () => {
    const defaultValue = itemConfig['widget-data-default'] || (itemConfig.widgets ? {} : '');
    const newItems = [...items, defaultValue];
    onChange(newItems);
    setCollapsedItems((prev) => ({
      ...prev,
      [newItems.length - 1]: false,
    }));
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
    const newCollapsed: Record<number, boolean> = {};
    newItems.forEach((_, i) => {
      newCollapsed[i] = collapsedItems[i < index ? i : i + 1] ?? defaultCollapsed;
    });
    setCollapsedItems(newCollapsed);
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
          label={translateConfig(widgetConfig['widget-label'])}
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
          {translate('common.noItems')}. {operations.add && !isReadonly && translate('common.clickToAdd', { label: addLabel })}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((itemValue, index) => {
            const isCollapsed = collapsedItems[index] ?? defaultCollapsed;
            const parentPath = widgetConfig['widget-data-path'];
            const childPath = itemConfig['widget-data-path'];
            let itemDataPath: string | undefined;

            if (parentPath) {
              const indexPath = `${parentPath}.${index}`;
              itemDataPath = childPath ? `${indexPath}.${childPath}` : indexPath;
            }

            const itemWidgetConfig: BaseWidgetConfig = {
              ...itemConfig,
              'widget-id': `${widgetConfig['widget-id']}-item-${index}`,
              'widget-data-path': itemDataPath,
              'widget-readonly': isReadonly || !operations.edit,
            };

            if (itemConfig.widgets) {
              return (
                <div
                  key={index}
                  className="border border-gray-300 rounded"
                >
                  <div
                    className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
                    onClick={() => toggleCollapse(index)}
                  >
                    <span className="font-medium text-sm">
                      {translateConfig(widgetConfig['widget-label'])} #{index + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      {operations.remove && !isReadonly && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeItem(index);
                          }}
                          disabled={!isEnabled}
                          className="px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50"
                          style={{ borderRadius: '15px' }}
                        >
                          {translate('common.remove')}
                        </button>
                      )}
                      <span className="text-gray-500">
                        {isCollapsed ? '▼' : '▲'}
                      </span>
                    </div>
                  </div>
                  {!isCollapsed && (
                    <div className="p-4">
                      <WidgetRenderer
                        config={itemWidgetConfig}
                        onValueChange={(widgetId, newValue) => {
                          updateItem(index, newValue);
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div
                key={index}
                className="border border-gray-300 rounded"
              >
                <div
                  className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleCollapse(index)}
                >
                  <span className="font-medium text-sm">
                    {translateConfig(itemConfig['widget-label']) || `${translate('common.item')} ${index + 1}`}
                  </span>
                  <div className="flex items-center gap-2">
                    {operations.remove && !isReadonly && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeItem(index);
                        }}
                        disabled={!isEnabled}
                        className="px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                      >
                        {translate('common.remove')}
                      </button>
                    )}
                    <span className="text-gray-500">
                      {isCollapsed ? '▼' : '▲'}
                    </span>
                  </div>
                </div>
                {!isCollapsed && (
                  <div className="p-4">
                    <WidgetRenderer
                      config={itemWidgetConfig}
                      onValueChange={(widgetId, newValue) => {
                        updateItem(index, newValue);
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {touched && error.length > 0 && (
        <p className="text-red-500 text-sm mt-1">{error[0]}</p>
      )}
      
    </div>
  );
};
