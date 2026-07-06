import React from 'react';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';


interface DisplayWidgetProps {
  config: BaseWidgetConfig;
}

export const DisplayWidget = ({ config }: DisplayWidgetProps) => {
  const {
    value,
    formattedValue,
    config: widgetConfig,
  } = useBaseWidget({ config });

  const { translateConfig } = useWidgetTranslation();

  const getDisplayValue = (val: any): string => {
    if (val === null || val === undefined) {
      return '';
    }
    
    if (typeof val === 'string' || typeof val === 'number') {
      return String(val);
    }
    
    if (typeof val === 'object' && !Array.isArray(val)) {
      if ('geo_lowest_level_value_id' in val) {
        return String(val.geo_lowest_level_value_id || '');
      }
      if ('value' in val) {
        return String(val.value || '');
      }
      if ('id' in val) {
        return String(val.id || '');
      }
      return '';
    }
    
    if (Array.isArray(val)) {
      return val.length > 0 ? val.map(String).join(', ') : '';
    }
    
    return String(val);
  };

  const displayValue = formattedValue !== undefined 
    ? (typeof formattedValue === 'object' ? getDisplayValue(formattedValue) : String(formattedValue))
    : getDisplayValue(value);
  const label = translateConfig(widgetConfig['widget-label']);

  if (!label || label.trim() === '') {
    return (
      <div
        className="DisplayFieldWidget mb-3 min-w-0 w-full overflow-hidden text-ellipsis whitespace-nowrap text-base text-gray-700"
        title={String(displayValue ?? '')}
      >
        {displayValue}
      </div>
    );
  }

  return (
    <div className="mb-[10px] DisplayFieldWidget flex flex-col sm:flex-row sm:items-start">
      <div className="text-base text-gray-600 font-medium md:min-w-[120px] sm:pr-4 mb-1 sm:mb-0" style={{ fontFamily: 'Roboto, sans-serif' }} title={label}>
        {label}:
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-base text-gray-900 font-medium" title={String(displayValue ?? '')}>
          {displayValue}
        </div>
      </div>
    </div>
  );
};
