import React from 'react';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';

/**
 * Select/Dropdown widget with data source support
 * 
 * Usage in schema:
 * {
 *   "widget": "select",
 *   "widget-type": "input",
 *   "widget-label": "Country",
 *   "widget-id": "country",
 *   "widget-data-path": "address.country",
 *   "widget-data-source": {
 *     "type": "static" | "api" | "schema",
 *     ...
 *   }
 * }
 */
interface SelectWidgetProps {
  config: BaseWidgetConfig;
}

export const SelectWidget = ({ config }: SelectWidgetProps) => {
  const {
    value,
    error,
    touched,
    isEnabled,
    isRequired,
    onChange,
    onBlur,
    dataSourceOptions,
    loading,
    config: widgetConfig,
  } = useBaseWidget({ config });

  const { translate, translateConfig } = useWidgetTranslation();

  // For readonly mode, render as display text showing only the selected label
  if (widgetConfig['widget-readonly']) {
    const label = translateConfig(widgetConfig['widget-label']);
    // Find the selected option's label
    const selectedOption = dataSourceOptions.find((option) => option.value === value);
    const displayValue = selectedOption ? selectedOption.label : (value || '-');
    
    return (
      <div className="mb-[10px] SelectDisplayWidget flex flex-col sm:flex-row sm:items-start">
        {label && (
          <div className="text-base text-gray-600 font-medium md:min-w-[120px] sm:pr-4 mb-1 sm:mb-0" style={{ fontFamily: 'Roboto, sans-serif' }} title={label}>
            {label}:
          </div>
        )}
        <div className="flex-1">
          <div className="text-base text-gray-900 font-medium" title={String(displayValue ?? '')}>
            {displayValue}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-[10px]">
      <div className="flex flex-col sm:flex-row sm:items-start">
        <label className="text-base font-medium text-gray-700 md:min-w-[120px] sm:pr-4 sm:pt-1 mb-1 sm:mb-0" style={{ fontFamily: 'Roboto, sans-serif' }} title={translateConfig(widgetConfig['widget-label'])}>
          {translateConfig(widgetConfig['widget-label'])}
          {isRequired && (
            <span className="text-red-500 ml-1">*</span>
          )}
        </label>
        <div className="flex-1 min-w-0">
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
            onBlur={onBlur}
            disabled={!isEnabled || loading || widgetConfig['widget-readonly']}
            className={`w-full sm:w-[180px] max-w-full h-[30px] px-3 border shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              (touched && error.length > 0) || (widgetConfig['widget-required'] && (!value || value === ''))
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300'
            } ${!isEnabled || loading || widgetConfig['widget-readonly'] ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
            style={{ borderRadius: '10px' }}
            title={translateConfig(widgetConfig['widget-data-tooltip'])}
          >
            <option value="">{translate('common.select')}</option>
            {dataSourceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {loading && (
            <p className="text-sm text-gray-500 mt-1">{translate('common.loadingOptions')}</p>
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
      </div>
    </div>
  );
};
