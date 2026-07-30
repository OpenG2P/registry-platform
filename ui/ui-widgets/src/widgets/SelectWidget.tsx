import React from 'react';
import { tSchema } from '../utils/tSchema';
import { useWidgetContext } from '../components/WidgetProvider';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { WidgetFieldLabel } from '../components/WidgetFieldLabel';


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

  const { t } = useWidgetContext();

  if (widgetConfig['widget-readonly']) {
    const label = tSchema(t, widgetConfig['widget-label']);
    const selectedOption = dataSourceOptions.find(
      (option) => option.value === value || String(option.value) === String(value)
    );
    const displayValue = selectedOption
      ? tSchema(t, selectedOption.label)
      : loading
        ? '-'
        : (value != null && value !== '' ? tSchema(t, String(value)) : '-');
    
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
        <WidgetFieldLabel
          className="text-base font-medium text-gray-700 md:min-w-[120px] sm:pr-4 sm:pt-1 mb-1 sm:mb-0"
          label={tSchema(t, widgetConfig['widget-label'])}
          required={isRequired}
        />
        <div className="flex-1 min-w-0">
          <select
            // value={value || ''}
            // onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
            value={value === undefined || value === null ? '' : String(value)}
            onChange={(e) => {
              const rawValue = e.target.value;

              if (rawValue === '') {
                onChange(undefined);
                return;
              }

              const selectedOption = dataSourceOptions.find(
                (option) => String(option.value) === rawValue
              );

              onChange(selectedOption ? selectedOption.value : rawValue);
            }}
            onBlur={onBlur}
            disabled={!isEnabled || loading || widgetConfig['widget-readonly']}
            className={`w-full sm:w-[180px] max-w-full h-[30px] px-3 border shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              (touched && error.length > 0) || (widgetConfig['widget-required'] && (!value || value === ''))
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300'
            } ${!isEnabled || loading || widgetConfig['widget-readonly'] ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
            style={{ borderRadius: '10px' }}
            title={tSchema(t, widgetConfig['widget-data-tooltip'])}
          >
            <option value="">{t?.('common.select')}</option>
            {dataSourceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {tSchema(t, option.label)}
              </option>
            ))}
          </select>
          {loading && (
            <p className="text-sm text-gray-500 mt-1">{t?.('common.loadingOptions')}</p>
          )}
          {touched && error.length > 0 && (
            <p className="text-red-500 text-sm mt-1">{error[0]}</p>
          )}
          
        </div>
      </div>
    </div>
  );
};
