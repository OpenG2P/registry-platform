import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';
import { WidgetFieldLabel } from '../components/WidgetFieldLabel';
import {
  formatNumber,
  parseNumber,
  applyDecimalPrecision,
  isAllowedKey,
  getFormattedNumberLength,
  normalizeNumericDefault,
} from '../utils/numberInput';

interface NumberInputWidgetProps {
  config: BaseWidgetConfig;
}

export const NumberInputWidget = ({ config }: NumberInputWidgetProps) => {
  const resolvedConfig = useMemo(() => {
    const rawDefault = config['widget-data-default'];
    if (rawDefault === undefined) {
      return config;
    }

    const normalizedDefault = normalizeNumericDefault(rawDefault, config['widget-data-format']);
    if (normalizedDefault === undefined || normalizedDefault === rawDefault) {
      return config;
    }

    return { ...config, 'widget-data-default': normalizedDefault };
  }, [config]);

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
  } = useBaseWidget({ config: resolvedConfig });

  const { translateConfig } = useWidgetTranslation();

  const formatConfig = widgetConfig['widget-data-format'];
  const validationConfig = widgetConfig['widget-data-validation'];
  const formatOnBlur = formatConfig?.formatOnBlur !== false; // Default to true

  const [rawInputValue, setRawInputValue] = useState<string>('');
  const [isFocused, setIsFocused] = useState<boolean>(false);

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

  const getNumericValue = useCallback((): number | null => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const numValue = typeof value === 'number' ? value : parseFloat(String(value));
    return isNaN(numValue) ? null : numValue;
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    const parsed = parseNumber(inputValue, formatConfig);

    setRawInputValue(inputValue);

    if (parsed === null) {
      if (inputValue === '' || inputValue === '-' || inputValue === '.') {
        onChange(null);
      }
      return;
    }

    const precisionApplied = applyDecimalPrecision(parsed, formatConfig);
    onChange(precisionApplied);
  }, [formatConfig, onChange]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);

    const numValue = getNumericValue();

    if (numValue !== null) {
      const precisionApplied = applyDecimalPrecision(numValue, formatConfig);

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

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    const numValue = getNumericValue();
    if (numValue !== null) {
      setRawInputValue(String(numValue));
    }
  }, [getNumericValue]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const key = e.key;
    const currentValue = (e.target as HTMLInputElement).value;

    if (isAllowedKey(key, formatConfig, currentValue, e)) {
      return; // Allow the key
    }

    e.preventDefault();
  }, [formatConfig]);

  const displayValue = useMemo(() => {
    if (isFocused) {
      return rawInputValue;
    }

    if (formattedValue !== undefined && formattedValue !== value) {
      return String(formattedValue);
    }

    const numValue = getNumericValue();
    if (numValue !== null) {
      return formatNumber(numValue, formatConfig);
    }

    return rawInputValue || '';
  }, [isFocused, rawInputValue, formatConfig, getNumericValue, formattedValue, value]);

  const textAlignClass = useMemo(() => {
    const align = formatConfig?.textAlign || 'left';
    return align === 'left' ? 'text-left' : 'text-right';
  }, [formatConfig?.textAlign]);

  const maxLength = validationConfig?.maxLength;
  const currentLength = useMemo(() => {
    return getFormattedNumberLength(getNumericValue(), formatConfig);
  }, [getNumericValue, formatConfig]);

  const placeholder = useMemo(() => {
    const hasValue = displayValue && displayValue.toString().trim().length > 0;
    const placeholderText = translateConfig(widgetConfig['widget-data-placeholder']);
    return hasValue ? undefined : placeholderText;
  }, [displayValue, widgetConfig, translateConfig]);

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
          
        </div>
      </div>
    </div>
  );
};
