import React from 'react';
import { tSchema } from '../utils/tSchema';
import { useWidgetContext } from '../components/WidgetProvider';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { WidgetFieldLabel } from '../components/WidgetFieldLabel';
import { owtFieldInputClass } from '../theme';


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

  const { t } = useWidgetContext();

  const displayValue = formattedValue !== undefined && formattedValue !== value 
    ? formattedValue 
    : (value || '');

  if (widgetConfig['widget-readonly']) {
    const label = tSchema(t, widgetConfig['widget-label']);
    return (
      <div className="mb-[10px] PhoneDisplayWidget flex flex-col sm:flex-row sm:items-start">
        {label && (
          <div className="text-base owt-text-muted font-medium md:min-w-[120px] sm:pr-4 mb-1 sm:mb-0" style={{ fontFamily: 'Roboto, sans-serif' }} title={label}>
            {label}:
          </div>
        )}
        <div className="flex-1">
          <div className="text-base owt-text font-medium" title={String(displayValue || '')}>
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
          className="text-base font-medium owt-text md:min-w-[120px] sm:pr-4 sm:pt-1 mb-1 sm:mb-0"
          label={tSchema(t, widgetConfig['widget-label'])}
          required={isRequired}
        />
        <div className="flex-1 min-w-0">
          <input
            type="tel"
            value={displayValue}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            disabled={!isEnabled || widgetConfig['widget-readonly']}
            placeholder={tSchema(t, widgetConfig['widget-data-placeholder'])}
            className={owtFieldInputClass({
              error: (touched && error.length > 0) || (widgetConfig['widget-required'] && (!value || value === '')),
              disabled: !isEnabled || widgetConfig['widget-readonly'],
              className: 'w-full sm:w-[180px] max-w-full h-[30px] px-3 owt-shadow-sm',
            })}
            style={{ borderRadius: '10px' }}
            title={tSchema(t, widgetConfig['widget-data-tooltip'])}
          />
          {touched && error.length > 0 && (
            <p className="owt-field-error text-sm mt-1">{error[0]}</p>
          )}
          
        </div>
      </div>
    </div>
  );
};
