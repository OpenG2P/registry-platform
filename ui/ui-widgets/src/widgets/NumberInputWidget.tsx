import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';
import {
  formatNumber,
  parseNumber,
  applyDecimalPrecision,
  validateNumericValue,
  isAllowedKey,
  getFormattedNumberLength,
} from '../utils/numberInput';

/**
 * Number input widget with advanced numeric features
 * 
 * Features:
 * - Numeric type (integer/decimal, signed/unsigned)
 * - Decimal precision control (0-6 places, rounding/truncation)
 * - Value range validation (min/max)
 * - Regular expression validation with custom messages
 * - Maximum character limit
 * - Numeric masking and formatting (thousand/decimal separators)
 * - Text alignment (right by default, configurable)
 * - Key input restrictions
 * 
 * Usage in schema:
 * {
 *   "widget": "number",
 *   "widget-type": "input",
 *   "widget-label": "Amount",
 *   "widget-id": "amount",
 *   "widget-data-path": "transaction.amount",
 *   "widget-data-format": {
 *     "numericType": "decimal",
 *     "decimalPlaces": 2,
 *     "roundingMode": "round",
 *     "thousandSeparator": ",",
 *     "decimalSeparator": ".",
 *     "textAlign": "right",
 *     "allowSigned": true,
 *     "formatOnBlur": true
 *   },
 *   "widget-data-validation": {
 *     "min": 0,
 *     "max": 10000,
 *     "pattern": "^[0-9]+(\\.[0-9]{1,2})?$",
 *     "patternMessage": "Invalid number format"
 *   },
 *   "widget-required": true,
 *   "widget-data-placeholder": "Enter amount"
 * }
 */
interface NumberInputWidgetProps {
  config: BaseWidgetConfig;
}

export const NumberInputWidget = ({ config }: NumberInputWidgetProps) => {
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
  const validationConfig = widgetConfig['widget-data-validation'];
  const formatOnBlur = formatConfig?.formatOnBlur !== false; // Default to true

  // Track raw input value (unformatted) for editing
  const [rawInputValue, setRawInputValue] = useState<string>('');
  const [isFocused, setIsFocused] = useState<boolean>(false);

  // Initialize raw input value from current value
  useEffect(() => {
    if (!isFocused && value !== null && value !== undefined) {
      const numValue = typeof value === 'number' ? value : parseFloat(String(value));
      if (!isNaN(numValue)) {
        setRawInputValue(formatNumber(numValue, formatConfig));
      } else {
        setRawInputValue('');
      }
    }
  }, [value, formatConfig, isFocused]);

  // Get numeric value from current value
  const getNumericValue = useCallback((): number | null => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const numValue = typeof value === 'number' ? value : parseFloat(String(value));
    return isNaN(numValue) ? null : numValue;
  }, [value]);

  // Handle input change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    // Parse the input to get numeric value
    const parsed = parseNumber(inputValue, formatConfig);

    // Update raw input for display
    setRawInputValue(inputValue);

    // Update the actual value
    if (parsed === null) {
      // Allow empty input or partial input (e.g., "-", ".")
      if (inputValue === '' || inputValue === '-' || inputValue === '.') {
        onChange(null);
      }
      // Don't update if invalid - let user continue typing
      return;
    }

    // Apply decimal precision if needed
    const precisionApplied = applyDecimalPrecision(parsed, formatConfig);
    onChange(precisionApplied);
  }, [formatConfig, onChange]);

  // Handle blur - apply formatting and validation
  const handleBlur = useCallback(() => {
    setIsFocused(false);

    const numValue = getNumericValue();

    if (numValue !== null) {
      // Apply decimal precision
      const precisionApplied = applyDecimalPrecision(numValue, formatConfig);

      // Format the value if formatOnBlur is enabled
      if (formatOnBlur) {
        const formatted = formatNumber(precisionApplied, formatConfig);
        setRawInputValue(formatted);
        onChange(precisionApplied);
      } else {
        setRawInputValue(String(precisionApplied));
        onChange(precisionApplied);
      }
    } else {
      setRawInputValue('');
    }

    onBlur();
  }, [formatConfig, formatOnBlur, getNumericValue, onChange, onBlur]);

  // Handle focus - show raw value for editing
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    const numValue = getNumericValue();
    if (numValue !== null) {
      // Show unformatted value for easier editing
      setRawInputValue(String(numValue));
    }
  }, [getNumericValue]);

  // Handle key down - restrict invalid keys
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const key = e.key;
    const currentValue = (e.target as HTMLInputElement).value;

    // Allow navigation and control keys
    if (isAllowedKey(key, formatConfig, currentValue, e)) {
      return; // Allow the key
    }

    // Block all other keys
    e.preventDefault();
  }, [formatConfig]);

  // Get display value
  const displayValue = useMemo(() => {
    if (isFocused) {
      // Show raw input while editing
      return rawInputValue;
    }

    // Use formattedValue from useBaseWidget if available (leverages formatting system)
    if (formattedValue !== undefined && formattedValue !== value) {
      return String(formattedValue);
    }

    // Fallback to manual formatting
    const numValue = getNumericValue();
    if (numValue !== null) {
      return formatNumber(numValue, formatConfig);
    }

    return rawInputValue || '';
  }, [isFocused, rawInputValue, formatConfig, getNumericValue, formattedValue, value]);

  // Get text alignment class
  const textAlignClass = useMemo(() => {
    const align = formatConfig?.textAlign || 'left';
    return align === 'left' ? 'text-left' : 'text-right';
  }, [formatConfig?.textAlign]);

  // Get max length for character limit
  const maxLength = validationConfig?.maxLength;
  const currentLength = useMemo(() => {
    return getFormattedNumberLength(getNumericValue(), formatConfig);
  }, [getNumericValue, formatConfig]);

  // Determine placeholder - hide if input has value
  const placeholder = useMemo(() => {
    const hasValue = displayValue && displayValue.toString().trim().length > 0;
    const placeholderText = translateConfig(widgetConfig['widget-data-placeholder']);
    return hasValue ? undefined : placeholderText;
  }, [displayValue, widgetConfig, translateConfig]);

  // For readonly mode, render as display text
  if (widgetConfig['widget-readonly']) {
    const label = translateConfig(widgetConfig['widget-label']);
    const numValue = getNumericValue();
    const display = numValue !== null ? formatNumber(numValue, formatConfig) : '';

    return (
      <div className="mb-[10px] NumberDisplayWidget flex flex-col sm:flex-row sm:items-start">
        {label && (
          <div className="text-base text-gray-600 font-medium md:min-w-[120px] sm:pr-4 mb-1 sm:mb-0" style={{ fontFamily: 'Roboto, sans-serif' }} title={label}>
            {label}:
          </div>
        )}
        <div className="flex-1">
          <div className={`text-base text-gray-900 font-medium ${textAlignClass}`} title={String(display ?? '')}>
            {display}
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
          <div className="flex items-center justify-between mb-1">
            <input
              type="text"
              inputMode="decimal"
              value={displayValue}
              onChange={handleChange}
              onBlur={handleBlur}
              onFocus={handleFocus}
              onKeyDown={handleKeyDown}
              disabled={!isEnabled || widgetConfig['widget-readonly']}
              placeholder={placeholder}
              maxLength={maxLength}
              className={`w-full sm:w-[180px] max-w-full h-[30px] px-3 border shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${textAlignClass} ${(touched && error.length > 0) || (widgetConfig['widget-required'] && (value === null || value === undefined || value === ''))
                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300'
                } ${!isEnabled || widgetConfig['widget-readonly'] ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
              style={{ borderRadius: '10px' }}
              title={translateConfig(widgetConfig['widget-data-tooltip'])}
            />
            {maxLength && (
              <span className={`text-xs ml-2 flex-shrink-0 ${currentLength > maxLength
                  ? 'text-red-500'
                  : 'text-gray-500'
                }`}>
                {currentLength} / {maxLength}
              </span>
            )}
          </div>
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
