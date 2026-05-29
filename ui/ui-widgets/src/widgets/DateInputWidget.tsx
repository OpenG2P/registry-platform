import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';
import {
  parseDate,
  formatDateToISO,
  formatDateToString,
  parseDateFromFormat,
  getMinDate,
  getMaxDate,
  validateDateConstraints,
} from '../utils/dateInput';

/**
 * Date input widget with advanced features
 * 
 * Features:
 * - Configurable date format (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, etc.)
 * - Default value (none / today)
 * - Date constraints (minDate, maxDate, any/past only/future only)
 * - Required vs optional
 * - Input method (date picker / manual / hybrid)
 * - Placeholder text
 * - Read-only & disabled
 * - Canonical stored format (ISO 8601)
 * 
 * Usage in schema:
 * {
 *   "widget": "date",
 *   "widget-type": "input",
 *   "widget-label": "Date of Birth",
 *   "widget-id": "dob",
 *   "widget-data-path": "person.dob",
 *   "widget-data-default": "today",
 *   "widget-data-format": {
 *     "dateFormat": "DD/MM/YYYY",
 *     "inputMethod": "hybrid",
 *     "dateConstraint": "past-only"
 *   },
 *   "widget-data-options": {
 *     "minDate": "1900-01-01",
 *     "maxDate": "today"
 *   },
 *   "widget-data-validation": {},
 *   "widget-required": true,
 *   "widget-data-placeholder": "DD/MM/YYYY"
 * }
 */
interface DateInputWidgetProps {
  config: BaseWidgetConfig;
}

export const DateInputWidget = ({ config }: DateInputWidgetProps) => {
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
  const dateFormat = formatConfig?.dateFormat || 'YYYY-MM-DD';
  const inputMethod = formatConfig?.inputMethod || 'picker'; // Default to picker for better UX
  const dateConstraint = formatConfig?.dateConstraint || 'any';
  const minDate = optionsConfig?.minDate;
  const maxDate = optionsConfig?.maxDate;
  const defaultToToday = widgetConfig['widget-data-default'] === 'today';

  // Track manual input value (for manual/hybrid modes)
  const [manualInputValue, setManualInputValue] = useState<string>('');
  const [isFocused, setIsFocused] = useState<boolean>(false);

  // Initialize default value to today if configured
  useEffect(() => {
    if (defaultToToday && (value === null || value === undefined || value === '')) {
      const todayISO = formatDateToISO(new Date());
      onChange(todayISO);
    }
  }, [defaultToToday, value, onChange]);

  // Get effective min/max dates
  const effectiveMinDate = useMemo(() => {
    return getMinDate(dateConstraint, minDate);
  }, [dateConstraint, minDate]);

  const effectiveMaxDate = useMemo(() => {
    return getMaxDate(dateConstraint, maxDate);
  }, [dateConstraint, maxDate]);

  // Convert ISO value to display format
  const getDisplayValue = useCallback((): string => {
    // For picker mode, always use YYYY-MM-DD
    if (inputMethod === 'picker') {
      if (!value) return '';
      return formatDateToISO(value);
    }
    
    // For manual/hybrid modes, use custom format
    if (isFocused && manualInputValue) {
      return manualInputValue;
    }
    
    if (!value) return '';
    
    if (dateFormat === 'YYYY-MM-DD') {
      return formatDateToISO(value);
    }
    
    return formatDateToString(value, dateFormat);
  }, [value, inputMethod, dateFormat, isFocused, manualInputValue]);

  // Initialize manual input value
  useEffect(() => {
    if (!isFocused && value) {
      if (dateFormat === 'YYYY-MM-DD') {
        setManualInputValue(formatDateToISO(value));
      } else {
        setManualInputValue(formatDateToString(value, dateFormat));
      }
    }
  }, [value, dateFormat, isFocused]);

  // Handle input change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    if (inputMethod === 'picker') {
      // Picker mode: input is always YYYY-MM-DD
      if (inputValue) {
        const date = parseDate(inputValue);
        if (date) {
          onChange(formatDateToISO(date));
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
        const date = parseDateFromFormat(inputValue, dateFormat);
        if (date) {
          // Validate constraints
          const constraintError = validateDateConstraints(
            date,
            minDate,
            maxDate,
            dateConstraint
          );
          
          if (!constraintError) {
            onChange(formatDateToISO(date));
          } else {
            // Still update the value but validation will catch it
            onChange(formatDateToISO(date));
          }
        }
      } else {
        onChange('');
      }
    }
  }, [inputMethod, dateFormat, onChange, minDate, maxDate, dateConstraint]);

  // Handle blur - validate and format
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    
    if (inputMethod !== 'picker' && manualInputValue) {
      const date = parseDateFromFormat(manualInputValue, dateFormat);
      if (date) {
        // Format the value according to the format
        const formatted = formatDateToString(date, dateFormat);
        setManualInputValue(formatted);
        onChange(formatDateToISO(date));
      } else {
        // Invalid date, clear it
        setManualInputValue('');
        onChange('');
      }
    }
    
    onBlur();
  }, [inputMethod, manualInputValue, dateFormat, onChange, onBlur]);

  // Handle focus
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    if (value) {
      if (dateFormat === 'YYYY-MM-DD') {
        setManualInputValue(formatDateToISO(value));
      } else {
        setManualInputValue(formatDateToString(value, dateFormat));
      }
    }
  }, [value, dateFormat]);

  // Determine placeholder
  const placeholder = useMemo(() => {
    const hasValue = getDisplayValue() && getDisplayValue().trim().length > 0;
    const placeholderText = translateConfig(widgetConfig['widget-data-placeholder']);
    return hasValue ? undefined : (placeholderText || dateFormat);
  }, [getDisplayValue, widgetConfig, translateConfig, dateFormat]);

  // Determine input type
  const inputType = inputMethod === 'picker' ? 'date' : 'text';

  // For readonly mode, render as display text
  if (widgetConfig['widget-readonly']) {
    const label = translateConfig(widgetConfig['widget-label']);
    let displayValue = '';
    
    if (value) {
      if (dateFormat === 'YYYY-MM-DD') {
        displayValue = formatDateToISO(value);
      } else {
        displayValue = formatDateToString(value, dateFormat);
      }
    } else {
      displayValue = '-';
    }

    return (
      <div className="mb-[10px] DateDisplayWidget flex flex-col sm:flex-row sm:items-start">
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
            min={inputMethod === 'picker' ? effectiveMinDate : undefined}
            max={inputMethod === 'picker' ? effectiveMaxDate : undefined}
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
