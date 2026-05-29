import React from 'react';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';

/**
 * Display widget for readonly text display
 * Used for displaying information in a card layout
 */
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

  // Helper to safely convert value to display string
  const getDisplayValue = (val: any): string => {
    if (val === null || val === undefined) {
      return '';
    }
    
    // If it's already a string or number, return as string
    if (typeof val === 'string' || typeof val === 'number') {
      return String(val);
    }
    
    // If it's an object (like geo hierarchy), try to extract a meaningful value
    if (typeof val === 'object' && !Array.isArray(val)) {
      // For geo hierarchy objects, try to extract the actual value
      if ('geo_lowest_level_value_id' in val) {
        return String(val.geo_lowest_level_value_id || '');
      }
      if ('value' in val) {
        return String(val.value || '');
      }
      if ('id' in val) {
        return String(val.id || '');
      }
      // If no extractable value, return empty string to avoid rendering object
      return '';
    }
    
    // For arrays, join them or return empty
    if (Array.isArray(val)) {
      return val.length > 0 ? val.map(String).join(', ') : '';
    }
    
    // Fallback: convert to string
    return String(val);
  };

  // Use formatted value if available, otherwise safely convert raw value
  const displayValue = formattedValue !== undefined 
    ? (typeof formattedValue === 'object' ? getDisplayValue(formattedValue) : String(formattedValue))
    : getDisplayValue(value);
  const label = translateConfig(widgetConfig['widget-label']);

  // If no label, render as paragraph text
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

  // With label, render as key-value pair (structure matches other readonly widgets for SectionRenderer ellipsis)
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
