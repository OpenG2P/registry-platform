import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { tSchema } from '../utils/tSchema';
import { useWidgetContext } from '../components/WidgetProvider';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { WidgetFieldLabel } from '../components/WidgetFieldLabel';
import { filterByCharacterType, applyCaseControl, applyMask, removeMask } from '../utils/textInput';

interface TextInputWidgetProps {
  config: BaseWidgetConfig;
}

export const TextInputWidget = ({ config }: TextInputWidgetProps) => {
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

  const { t } = useWidgetContext();

  const formatConfig = widgetConfig['widget-data-format'];
  const validationConfig = widgetConfig['widget-data-validation'];
  const hasMask = !!formatConfig?.mask;

  const getRawValueFromValue = useCallback((val: any): string => {
    if (!hasMask || !val) return '';
    const stringVal = String(val);
    return removeMask(stringVal, formatConfig.mask!);
  }, [hasMask, formatConfig]);

  const [rawValue, setRawValue] = useState<string>(() => getRawValueFromValue(value));

  useEffect(() => {
    if (hasMask) {
      const newRaw = getRawValueFromValue(value);
      if (newRaw !== rawValue) {
        setRawValue(newRaw);
      }
    }
  }, [value, hasMask, getRawValueFromValue, rawValue]);

  const getInputType = () => {
    const inputType = formatConfig?.inputType || 'text';
    if (formatConfig?.currency) {
      return 'number';
    }
    return inputType;
  };

  const getStringValue = useCallback(() => {
    if (formatConfig?.currency) {
      return typeof value === 'number' ? value.toString() : (value ? String(value) : '');
    }
    return value ? String(value) : '';
  }, [value, formatConfig?.currency]);

  const processInputValue = useCallback((inputValue: string): { processed: string; raw: string } => {
    let processed = inputValue;

    if (formatConfig?.characterType && formatConfig.characterType !== 'any') {
      processed = filterByCharacterType(
        processed,
        formatConfig.characterType,
        formatConfig.customCharset
      );
    }

    if (formatConfig?.caseControl && formatConfig.caseControl !== 'none') {
      processed = applyCaseControl(processed, formatConfig.caseControl);
    }

    let raw = processed;
    if (formatConfig?.mask) {
      const masked = applyMask(processed, formatConfig.mask);
      processed = masked.displayValue;
      raw = masked.rawValue;
    }

    return { processed, raw };
  }, [formatConfig]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

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

    let valueToProcess = inputValue;
    if (hasMask && formatConfig.mask) {
      valueToProcess = removeMask(inputValue, formatConfig.mask);
      setRawValue(valueToProcess);
    }

    const { processed, raw } = processInputValue(valueToProcess);

    if (hasMask) {
      onChange(raw);
    } else {
      onChange(processed);
    }
  }, [formatConfig, onChange, processInputValue, hasMask]);

  const displayValue = useMemo(() => {
    if (formatConfig?.currency) {
      return typeof value === 'number' ? value : (value ? parseFloat(String(value)) : '');
    }

    if (hasMask && formatConfig.mask) {
      const masked = applyMask(rawValue, formatConfig.mask);
      return masked.displayValue;
    }

    const stringValue = getStringValue();
    if (stringValue) {
      const { processed } = processInputValue(stringValue);
      return processed;
    }

    return '';
  }, [value, formatConfig, rawValue, hasMask, getStringValue, processInputValue]);

  const characterCount = useMemo(() => {
    if (hasMask) {
      return rawValue.length;
    }
    return getStringValue().length;
  }, [hasMask, rawValue, getStringValue]);

  const maxLength = validationConfig?.maxLength ?? 200;
  const minLength = validationConfig?.minLength ?? 0;

  const placeholder = useMemo(() => {
    const hasValue = displayValue && displayValue.toString().trim().length > 0;
    const placeholderText = tSchema(t, widgetConfig['widget-data-placeholder']);
    return hasValue ? undefined : placeholderText;
  }, [displayValue, widgetConfig, t]);

  if (widgetConfig['widget-readonly']) {
    const label = tSchema(t, widgetConfig['widget-label']);
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
          <div className="flex items-center gap-2 mb-1">
            <input
              type={getInputType()}
              value={displayValue}
              onChange={handleChange}
              onBlur={onBlur}
              disabled={!isEnabled || widgetConfig['widget-readonly']}
              placeholder={placeholder}
              maxLength={formatConfig?.mask ? undefined : maxLength}
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
              title={tSchema(t, widgetConfig['widget-data-tooltip'])}
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
        </div>
      </div>
    </div>
  );
};
