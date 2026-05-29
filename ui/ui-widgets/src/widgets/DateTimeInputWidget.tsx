import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';
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

/**
 * DateTime input widget with advanced features
 * 
 * Features:
 * - Configurable datetime format (DD/MM/YYYY HH:mm, MM/DD/YYYY HH:mm:ss, etc.)
 * - Default value (none / now)
 * - DateTime constraints (minDateTime, maxDateTime, any/past only/future only)
 * - Required vs optional
 * - Input method (datetime picker / manual / hybrid)
 * - Placeholder text
 * - Read-only & disabled
 * - Canonical stored format (ISO 8601 with time)
 * 
 * Usage in schema:
 * {
 *   "widget": "datetime",
 *   "widget-type": "input",
 *   "widget-label": "Appointment Time",
 *   "widget-id": "appointment",
 *   "widget-data-path": "appointment.datetime",
 *   "widget-data-default": "now",
 *   "widget-data-format": {
 *     "dateTimeFormat": "DD/MM/YYYY HH:mm",
 *     "inputMethod": "picker",
 *     "dateTimeConstraint": "future-only"
 *   },
 *   "widget-data-options": {
 *     "minDateTime": "2024-01-01T00:00",
 *     "maxDateTime": "now"
 *   },
 *   "widget-data-validation": {},
 *   "widget-required": true,
 *   "widget-data-placeholder": "DD/MM/YYYY HH:mm"
 * }
 */
interface DateTimeInputWidgetProps {
  config: BaseWidgetConfig;
}

export const DateTimeInputWidget = ({ config }: DateTimeInputWidgetProps) => {
  const {
    value,
    formattedValue,
    error,
    touched,
    isEnabled,
    onChange,
    onBlur,
    config: widgetConfig,
  } = useBaseWidget({ config });

  const { translate, translateConfig } = useWidgetTranslation();

  const formatConfig = widgetConfig['widget-data-format'];
  const optionsConfig = widgetConfig['widget-data-options'];
  const dateTimeFormat = formatConfig?.dateTimeFormat || 'YYYY-MM-DDTHH:mm';
  const inputMethod = formatConfig?.inputMethod || 'picker'; // Default to picker for better UX
  const dateTimeConstraint = formatConfig?.dateTimeConstraint || 'any';
  const minDateTime = optionsConfig?.minDateTime;
  const maxDateTime = optionsConfig?.maxDateTime;
  const defaultToNow = widgetConfig['widget-data-default'] === 'now';

  // Track manual input value (for manual/hybrid modes)
  const [manualInputValue, setManualInputValue] = useState<string>('');
  const [isFocused, setIsFocused] = useState<boolean>(false);

  // Initialize default value to now if configured
  useEffect(() => {
    if (defaultToNow && (value === null || value === undefined || value === '')) {
      const nowISO = formatDateTimeToISO(new Date());
      onChange(nowISO);
    }
  }, [defaultToNow, value, onChange]);

  // Get effective min/max datetimes
  const effectiveMinDateTime = useMemo(() => {
    return getMinDateTime(dateTimeConstraint, minDateTime);
  }, [dateTimeConstraint, minDateTime]);

  const effectiveMaxDateTime = useMemo(() => {
    return getMaxDateTime(dateTimeConstraint, maxDateTime);
  }, [dateTimeConstraint, maxDateTime]);

  // Convert ISO value to display format
  const getDisplayValue = useCallback((): string => {
    // For picker mode, always use YYYY-MM-DDTHH:mm
    if (inputMethod === 'picker') {
      if (!value) return '';
      return formatDateTimeToLocalISO(value);
    }
    
    // For manual/hybrid modes, use custom format
    if (isFocused && manualInputValue) {
      return manualInputValue;
    }
    
    if (!value) return '';
    
    if (dateTimeFormat === 'YYYY-MM-DDTHH:mm' || dateTimeFormat === 'YYYY-MM-DDTHH:mm:ss') {
      return formatDateTimeToLocalISO(value);
    }
    
    return formatDateTimeToString(value, dateTimeFormat);
  }, [value, inputMethod, dateTimeFormat, isFocused, manualInputValue]);

  // Initialize manual input value
  useEffect(() => {
    if (!isFocused && value) {
      if (dateTimeFormat === 'YYYY-MM-DDTHH:mm' || dateTimeFormat === 'YYYY-MM-DDTHH:mm:ss') {
        setManualInputValue(formatDateTimeToLocalISO(value));
      } else {
        setManualInputValue(formatDateTimeToString(value, dateTimeFormat));
      }
    }
  }, [value, dateTimeFormat, isFocused]);

  // Handle input change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    if (inputMethod === 'picker') {
      // Picker mode: input is always YYYY-MM-DDTHH:mm
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
      // Manual/hybrid mode: parse custom format
      setManualInputValue(inputValue);
      
      if (inputValue) {
        const date = parseDateTimeFromFormat(inputValue, dateTimeFormat);
        if (date) {
          // Validate constraints
          const constraintError = validateDateTimeConstraints(
            date,
            minDateTime,
            maxDateTime,
            dateTimeConstraint
          );
          
          if (!constraintError) {
            onChange(formatDateTimeToISO(date));
          } else {
            // Still update the value but validation will catch it
            onChange(formatDateTimeToISO(date));
          }
        }
      } else {
        onChange('');
      }
    }
  }, [inputMethod, dateTimeFormat, onChange, minDateTime, maxDateTime, dateTimeConstraint]);

  // Handle blur - validate and format
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    
    if (inputMethod !== 'picker' && manualInputValue) {
      const date = parseDateTimeFromFormat(manualInputValue, dateTimeFormat);
      if (date) {
        // Format the value according to the format
        const formatted = formatDateTimeToString(date, dateTimeFormat);
        setManualInputValue(formatted);
        onChange(formatDateTimeToISO(date));
      } else {
        // Invalid datetime, clear it
        setManualInputValue('');
        onChange('');
      }
    }
    
    onBlur();
  }, [inputMethod, manualInputValue, dateTimeFormat, onChange, onBlur]);

  // Handle focus
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

  // Determine placeholder
  const placeholder = useMemo(() => {
    const hasValue = getDisplayValue() && getDisplayValue().trim().length > 0;
    const placeholderText = translateConfig(widgetConfig['widget-data-placeholder']);
    return hasValue ? undefined : (placeholderText || dateTimeFormat);
  }, [getDisplayValue, widgetConfig, translateConfig, dateTimeFormat]);

  // Determine input type
  const inputType = inputMethod === 'picker' ? 'datetime-local' : 'text';

  // For readonly mode, render as display text
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
          {/* {widgetConfig['widget-data-helptext'] && (
            <p className="text-gray-500 text-sm mt-1">
              {translateConfig(widgetConfig['widget-data-helptext'])}
            </p>
          )} */}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-[10px]">
      <div className="flex flex-col sm:flex-row sm:items-start">
        <label className="text-base font-medium text-gray-700 md:min-w-[120px] sm:pr-4 sm:pt-1 mb-1 sm:mb-0" style={{ fontFamily: 'Roboto, sans-serif' }} title={translateConfig(widgetConfig['widget-label'])}>
          {translateConfig(widgetConfig['widget-label'])}
          {widgetConfig['widget-required'] && (
            <span className="text-red-500 ml-1">*</span>
          )}
        </label>
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


