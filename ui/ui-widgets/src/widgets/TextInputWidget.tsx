import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';
import { filterByCharacterType, applyCaseControl, applyMask, removeMask } from '../utils/textInput';

/**
 * Generic text input widget with advanced features
 * Supports all text-based inputs via configuration (text, email, password, number, tel, url, etc.)
 * 
 * Features:
 * - Allowed character types (any, alphabetic, alphanumeric, numeric, numeric-decimal, custom)
 * - Case control (none, lowercase, uppercase, capitalize)
 * - Length constraints with live character counter
 * - Regular expression validation with custom messages
 * - Input masking (static and dynamic)
 * - Placeholder text with i18n support
 * 
 * Usage in schema:
 * {
 *   "widget": "text",
 *   "widget-type": "input",
 *   "widget-label": "Field Label",
 *   "widget-id": "fieldId",
 *   "widget-data-path": "person.name",
 *   "widget-data-format": {
 *     "inputType": "email",
 *     "characterType": "alphanumeric",
 *     "caseControl": "lowercase",
 *     "mask": {
 *       "pattern": "XXX-XXX-XXXX",
 *       "type": "static"
 *     },
 *     "showCharCounter": true
 *   },
 *   "widget-data-validation": {
 *     "validationType": "email",  // Predefined type: "email", "phone", or "url"
 *     // OR use custom pattern:
 *     // "pattern": "^[a-z0-9]+$",
 *     // "patternMessage": "Only lowercase alphanumeric characters allowed",
 *     "minLength": 5,
 *     "maxLength": 20
 *   },
 *   "widget-required": true,
 *   "widget-data-placeholder": "Enter your value"
 * }
 */
interface TextInputWidgetProps {
  config: BaseWidgetConfig;
}

export const TextInputWidget = ({ config }: TextInputWidgetProps) => {
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

  const { translate, translateConfig } = useWidgetTranslation();
  
  // Track raw value separately for masking (to preserve unmasked value internally)
  const formatConfig = widgetConfig['widget-data-format'];
  const validationConfig = widgetConfig['widget-data-validation'];
  const hasMask = !!formatConfig?.mask;
  
  // Initialize raw value from current value if masking is enabled
  const getRawValueFromValue = useCallback((val: any): string => {
    if (!hasMask || !val) return '';
    const stringVal = String(val);
    return removeMask(stringVal, formatConfig.mask!);
  }, [hasMask, formatConfig]);

  const [rawValue, setRawValue] = useState<string>(() => getRawValueFromValue(value));

  // Sync rawValue when value changes externally
  useEffect(() => {
    if (hasMask) {
      const newRaw = getRawValueFromValue(value);
      if (newRaw !== rawValue) {
        setRawValue(newRaw);
      }
    }
  }, [value, hasMask, getRawValueFromValue, rawValue]);

  // Determine input type from configuration or default to 'text'
  const getInputType = () => {
    const inputType = formatConfig?.inputType || 'text';
    // Handle currency as number type
    if (formatConfig?.currency) {
      return 'number';
    }
    return inputType;
  };

  // Get current string value for processing
  const getStringValue = useCallback(() => {
    if (formatConfig?.currency) {
      return typeof value === 'number' ? value.toString() : (value ? String(value) : '');
    }
    return value ? String(value) : '';
  }, [value, formatConfig?.currency]);

  // Apply character filtering, case control, and masking
  const processInputValue = useCallback((inputValue: string): { processed: string; raw: string } => {
    let processed = inputValue;

    // Step 1: Filter by character type
    if (formatConfig?.characterType && formatConfig.characterType !== 'any') {
      processed = filterByCharacterType(
        processed,
        formatConfig.characterType,
        formatConfig.customCharset
      );
    }

    // Step 2: Apply case control (before masking to preserve mask format)
    if (formatConfig?.caseControl && formatConfig.caseControl !== 'none') {
      processed = applyCaseControl(processed, formatConfig.caseControl);
    }

    // Step 3: Apply masking if configured
    let raw = processed;
    if (formatConfig?.mask) {
      const masked = applyMask(processed, formatConfig.mask);
      processed = masked.displayValue;
      raw = masked.rawValue;
    }

    return { processed, raw };
  }, [formatConfig]);

  // Handle input change with all transformations
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    // Handle currency separately
    if (formatConfig?.currency) {
      const numericValue = inputValue.replace(/[^0-9.]/g, '');
      if (numericValue === '') {
        onChange('');
        if (hasMask) setRawValue('');
      } else {
        const numValue = parseFloat(numericValue);
        if (!isNaN(numValue)) {
          onChange(numValue);
          if (hasMask) setRawValue(numericValue);
        }
      }
      return;
    }

    // If masking is enabled, extract raw value from masked input
    let valueToProcess = inputValue;
    if (hasMask && formatConfig.mask) {
      // Remove mask characters to get raw value
      valueToProcess = removeMask(inputValue, formatConfig.mask);
      setRawValue(valueToProcess);
    }

    // Process the input value (filter characters, apply case)
    const { processed, raw } = processInputValue(valueToProcess);

    // Update the actual value
    // If masking is enabled, store raw value; otherwise store processed value
    if (hasMask) {
      onChange(raw);
    } else {
      onChange(processed);
    }
  }, [formatConfig, onChange, processInputValue, hasMask]);

  // Get display value (masked if applicable, otherwise processed value)
  const displayValue = useMemo(() => {
    if (formatConfig?.currency) {
      return typeof value === 'number' ? value : (value ? parseFloat(String(value)) : '');
    }

    // If masking is enabled, use rawValue to generate masked display
    if (hasMask && formatConfig.mask) {
      const masked = applyMask(rawValue, formatConfig.mask);
      return masked.displayValue;
    }

    // Otherwise, get string value and process it
    const stringValue = getStringValue();
    if (stringValue) {
      const { processed } = processInputValue(stringValue);
      return processed;
    }

    return '';
  }, [value, formatConfig, rawValue, hasMask, getStringValue, processInputValue]);

  // Calculate character count for counter (use raw value length when masking)
  const characterCount = useMemo(() => {
    if (hasMask) {
      return rawValue.length;
    }
    return getStringValue().length;
  }, [hasMask, rawValue, getStringValue]);

  // Get max length from validation config (default: 200)
  const maxLength = validationConfig?.maxLength ?? 200;
  const minLength = validationConfig?.minLength ?? 0;

  // Determine placeholder - hide if input has value
  const placeholder = useMemo(() => {
    const hasValue = displayValue && displayValue.toString().trim().length > 0;
    const placeholderText = translateConfig(widgetConfig['widget-data-placeholder']);
    return hasValue ? undefined : placeholderText;
  }, [displayValue, widgetConfig, translateConfig]);

  // For readonly mode, render as display text instead of input
  if (widgetConfig['widget-readonly']) {
    const label = translateConfig(widgetConfig['widget-label']);
    return (
      <div className="mb-[10px] TextDisplayWidget flex flex-col sm:flex-row sm:items-start">
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
          {isRequired && (
            <span className="text-red-500 ml-1">*</span>
          )}
        </label>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <input
              type={getInputType()}
              value={displayValue}
              onChange={handleChange}
              onBlur={onBlur}
              disabled={!isEnabled || widgetConfig['widget-readonly']}
              placeholder={placeholder}
              maxLength={formatConfig?.mask ? undefined : maxLength} // Don't enforce maxLength when masking (handled by mask pattern)
              inputMode={
                formatConfig?.currency 
                  ? 'decimal' 
                  : formatConfig?.characterType === 'numeric' || formatConfig?.characterType === 'numeric-decimal'
                  ? 'numeric'
                  : undefined
              }
              className={`w-full sm:w-[180px] max-w-full h-[30px] px-3 border shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                (touched && error.length > 0) || (widgetConfig['widget-required'] && (value === null || value === undefined || value === ''))
                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300'
              } ${!isEnabled || widgetConfig['widget-readonly'] ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
              style={{ borderRadius: '10px' }}
              title={translateConfig(widgetConfig['widget-data-tooltip'])}
            />
            {formatConfig?.showCharCounter && (
              <span className={`text-xs ml-2 flex-shrink-0 ${
                characterCount > maxLength || characterCount < minLength
                  ? 'text-red-500'
                  : 'text-gray-500'
              }`}>
                {characterCount}{maxLength ? ` / ${maxLength}` : ''}
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
