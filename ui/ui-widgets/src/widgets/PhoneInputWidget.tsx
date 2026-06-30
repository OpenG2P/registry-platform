import React from 'react';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';
import { WidgetFieldLabel } from '../components/WidgetFieldLabel';


interface PhoneInputWidgetProps {
  config: BaseWidgetConfig;
}

export const PhoneInputWidget = ({ config }: PhoneInputWidgetProps) => {
  const {
    value,
    formattedValue,
    error,
    touched,
    isEnabled,
    isRequired,
    onChange,
    onBlur,
    config: widgetConfig,
  } = useBaseWidget({ config });

  const { translateConfig } = useWidgetTranslation();

  const displayValue = formattedValue !== undefined && formattedValue !== value 
    ? formattedValue 
    : (value || '');

  if (widgetConfig['widget-readonly']) {
    const label = translateConfig(widgetConfig['widget-label']);
    return (
      <div className="mb-[10px] PhoneDisplayWidget flex flex-col sm:flex-row sm:items-start">
        {label && (
          <div className="text-base text-gray-600 font-medium md:min-w-[120px] sm:pr-4 mb-1 sm:mb-0" style={{ fontFamily: 'Roboto, sans-serif' }} title={label}>
            {label}:
          </div>
        )}
        <div className="flex-1">
          <div className="text-base text-gray-900 font-medium" title={String(displayValue || '')}>
            {displayValue || '-'}
          </div>
          
        </div>
      </div>
    );
  }

  return (
    <div className="mb-[10px]">
      <div className="flex flex-col sm:flex-row sm:items-start">
        <WidgetFieldLabel
          className="text-base font-medium text-gray-700 md:min-w-[120px] sm:pr-4 sm:pt-1 mb-1 sm:mb-0"
          label={translateConfig(widgetConfig['widget-label'])}
          required={isRequired}
        />
        <div className="flex-1 min-w-0">
          <input
            type="tel"
            value={displayValue}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            disabled={!isEnabled || widgetConfig['widget-readonly']}
            placeholder={translateConfig(widgetConfig['widget-data-placeholder'])}
            className={`w-full sm:w-[180px] max-w-full h-[30px] px-3 border shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              (touched && error.length > 0) || (widgetConfig['widget-required'] && (!value || value === ''))
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300'
            } ${!isEnabled || widgetConfig['widget-readonly'] ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
            style={{ borderRadius: '10px' }}
            title={translateConfig(widgetConfig['widget-data-tooltip'])}
          />
          {touched && error.length > 0 && (
            <p className="text-red-500 text-sm mt-1">{error[0]}</p>
          )}
          
        </div>
      </div>
    </div>
  );
};
