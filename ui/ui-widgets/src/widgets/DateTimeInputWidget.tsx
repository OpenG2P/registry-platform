import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';
import { WidgetFieldLabel } from '../components/WidgetFieldLabel';
import {
  parseDateTime,
  formatDateTimeToISO,
  formatDateTimeToLocalISO,
  formatDateTimeToString,
  parseDateTimeFromFormat,
  getMinDateTime,
  getMaxDateTime,
  validateDateTimeConstraints,
} from '../utils/datetimeInput';

interface DateTimeInputWidgetProps {
  config: BaseWidgetConfig;
}

export const DateTimeInputWidget = ({ config }: DateTimeInputWidgetProps) => {
  const {
    value,
    error,
    touched,
    isEnabled,
    isRequired,
    onChange,
    onBlur,
    config: widgetConfig,
  } = useBaseWidget({ config });

  const { translateConfig } = useWidgetTranslation();

  const formatConfig = widgetConfig['widget-data-format'];
  const optionsConfig = widgetConfig['widget-data-options'];
  const dateTimeFormat = formatConfig?.dateTimeFormat || 'YYYY-MM-DDTHH:mm';
  const inputMethod = formatConfig?.inputMethod || 'picker'; // Default to picker for better UX
  const dateTimeConstraint = formatConfig?.dateTimeConstraint || 'any';
  const minDateTime = optionsConfig?.minDateTime;
  const maxDateTime = optionsConfig?.maxDateTime;
  const defaultToNow = widgetConfig['widget-data-default'] === 'now';

  const [manualInputValue, setManualInputValue] = useState<string>('');
  const [isFocused, setIsFocused] = useState<boolean>(false);

  useEffect(() => {
    if (defaultToNow && (value === null || value === undefined || value === '')) {
      const nowISO = formatDateTimeToISO(new Date());
      onChange(nowISO);
    }
  }, [defaultToNow, value, onChange]);

  const effectiveMinDateTime = useMemo(() => {
    return getMinDateTime(dateTimeConstraint, minDateTime);
  }, [dateTimeConstraint, minDateTime]);

  const effectiveMaxDateTime = useMemo(() => {
    return getMaxDateTime(dateTimeConstraint, maxDateTime);
  }, [dateTimeConstraint, maxDateTime]);

  const getDisplayValue = useCallback((): string => {
    if (inputMethod === 'picker') {
      if (!value) return '';
      return formatDateTimeToLocalISO(value);
    }
    
    if (isFocused && manualInputValue) {
      return manualInputValue;
    }
    
    if (!value) return '';
    
    if (dateTimeFormat === 'YYYY-MM-DDTHH:mm' || dateTimeFormat === 'YYYY-MM-DDTHH:mm:ss') {
      return formatDateTimeToLocalISO(value);
    }
    
    return formatDateTimeToString(value, dateTimeFormat);
  }, [value, inputMethod, dateTimeFormat, isFocused, manualInputValue]);

  useEffect(() => {
    if (!isFocused && value) {
      if (dateTimeFormat === 'YYYY-MM-DDTHH:mm' || dateTimeFormat === 'YYYY-MM-DDTHH:mm:ss') {
        setManualInputValue(formatDateTimeToLocalISO(value));
      } else {
        setManualInputValue(formatDateTimeToString(value, dateTimeFormat));
      }
    }
  }, [value, dateTimeFormat, isFocused]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    if (inputMethod === 'picker') {
      if (inputValue) {
        const date = parseDateTime(inputValue);
        if (date) {
          onChange(formatDateTimeToISO(date));
        } else {
          onChange('');
        }
      } else {
        onChange('');
      }
    } else {
      setManualInputValue(inputValue);
      
      if (inputValue) {
        const date = parseDateTimeFromFormat(inputValue, dateTimeFormat);
        if (date) {
          const constraintError = validateDateTimeConstraints(
            date,
            minDateTime,
            maxDateTime,
            dateTimeConstraint
          );
          
          if (!constraintError) {
            onChange(formatDateTimeToISO(date));
          } else {
            onChange(formatDateTimeToISO(date));
          }
        }
      } else {
        onChange('');
      }
    }
  }, [inputMethod, dateTimeFormat, onChange, minDateTime, maxDateTime, dateTimeConstraint]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    
    if (inputMethod !== 'picker' && manualInputValue) {
      const date = parseDateTimeFromFormat(manualInputValue, dateTimeFormat);
      if (date) {
        const formatted = formatDateTimeToString(date, dateTimeFormat);
        setManualInputValue(formatted);
        onChange(formatDateTimeToISO(date));
      } else {
        setManualInputValue('');
        onChange('');
      }
    }
    
    onBlur();
  }, [inputMethod, manualInputValue, dateTimeFormat, onChange, onBlur]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    if (value) {
      if (dateTimeFormat === 'YYYY-MM-DDTHH:mm' || dateTimeFormat === 'YYYY-MM-DDTHH:mm:ss') {
        setManualInputValue(formatDateTimeToLocalISO(value));
      } else {
        setManualInputValue(formatDateTimeToString(value, dateTimeFormat));
      }
    }
  }, [value, dateTimeFormat]);

  const placeholder = useMemo(() => {
    const hasValue = getDisplayValue() && getDisplayValue().trim().length > 0;
    const placeholderText = translateConfig(widgetConfig['widget-data-placeholder']);
    return hasValue ? undefined : (placeholderText || dateTimeFormat);
  }, [getDisplayValue, widgetConfig, translateConfig, dateTimeFormat]);

  const inputType = inputMethod === 'picker' ? 'datetime-local' : 'text';

  if (widgetConfig['widget-readonly']) {
    const label = translateConfig(widgetConfig['widget-label']);
    let displayValue = '';
    
    if (value) {
      if (dateTimeFormat === 'YYYY-MM-DDTHH:mm' || dateTimeFormat === 'YYYY-MM-DDTHH:mm:ss') {
        displayValue = formatDateTimeToLocalISO(value);
      } else {
        displayValue = formatDateTimeToString(value, dateTimeFormat);
      }
    } else {
      displayValue = '-';
    }

    return (
      <div className="mb-[10px] DateTimeDisplayWidget flex flex-col sm:flex-row sm:items-start">
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
          label={translateConfig(widgetConfig['widget-label'])}
          required={isRequired}
        />
        <div className="flex-1 min-w-0">
          <input
            type={inputType}
            value={getDisplayValue()}
            onChange={handleChange}
            onBlur={handleBlur}
            onFocus={handleFocus}
            disabled={!isEnabled || widgetConfig['widget-readonly']}
            placeholder={placeholder}
            min={inputMethod === 'picker' ? effectiveMinDateTime : undefined}
            max={inputMethod === 'picker' ? effectiveMaxDateTime : undefined}
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


