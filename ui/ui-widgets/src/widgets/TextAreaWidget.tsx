import React, { useMemo, useCallback } from 'react';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';
import { filterByCharacterType, applyCaseControl } from '../utils/textInput';

/**
 * TextArea widget for multi-line text input
 * Supports 2 rows by default with configurable rows
 * 
 * Features:
 * - Multi-line text input
 * - Character type filtering (any, alphabetic, alphanumeric, numeric, etc.)
 * - Case control (none, lowercase, uppercase, capitalize)
 * - Length constraints with live character counter
 * - Regular expression validation with custom messages
 * - Placeholder text with i18n support
 * 
 * Usage in schema:
 * {
 *   "widget": "textarea",
 *   "widget-type": "input",
 *   "widget-label": "Description",
 *   "widget-id": "description",
 *   "widget-data-path": "person.description",
 *   "widget-data-format": {
 *     "characterType": "any",
 *     "caseControl": "none",
 *     "showCharCounter": true,
 *     "rows": 2
 *   },
 *   "widget-data-validation": {
 *     "minLength": 10,
 *     "maxLength": 500
 *   },
 *   "widget-required": true,
 *   "widget-data-placeholder": "Enter description"
 * }
 */
interface TextAreaWidgetProps {
  config: BaseWidgetConfig;
}

export const TextAreaWidget = ({ config }: TextAreaWidgetProps) => {
  // Check readonly early from original config
  const isReadonly = config['widget-readonly'] || false;

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

  const { translate, translateConfig } = useWidgetTranslation();
  
  const formatConfig = widgetConfig['widget-data-format'] || {};
  const validationConfig = widgetConfig['widget-data-validation'] || {};
  
  // Get number of rows (default to 2)
  const rows = formatConfig.rows || 2;
  
  // Get current string value for processing
  const getStringValue = useCallback(() => {
    if (value === null || value === undefined) return '';
    return String(value);
  }, [value]);

  // Handle input change with character filtering and case control
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    let newValue = e.target.value;

    // Apply character type filtering
    const characterType = formatConfig?.characterType || 'any';
    if (characterType !== 'any') {
      newValue = filterByCharacterType(newValue, characterType, formatConfig?.customCharset);
    }

    // Apply case control
    const caseControl = formatConfig?.caseControl || 'none';
    if (caseControl !== 'none') {
      newValue = applyCaseControl(newValue, caseControl);
    }

    // Apply max length if specified
    const maxLength = validationConfig?.maxLength;
    if (maxLength && newValue.length > maxLength) {
      newValue = newValue.slice(0, maxLength);
    }

    onChange(newValue);
  }, [formatConfig, validationConfig, onChange]);

  // Character counter
  const showCharCounter = formatConfig?.showCharCounter || false;
  const currentLength = getStringValue().length;
  const maxLength = validationConfig?.maxLength;
  const charCounterText = maxLength 
    ? `${currentLength}/${maxLength}`
    : `${currentLength}`;

  // Get placeholder text
  const placeholder = widgetConfig['widget-data-placeholder']
    ? translateConfig(widgetConfig['widget-data-placeholder'])
    : '';

  // Get label
  const label = widgetConfig['widget-label']
    ? translateConfig(widgetConfig['widget-label'])
    : '';

  // Check if required

  // Error display
  const hasError = touched && error && error.length > 0;
  const errorMessage = hasError ? error[0] : '';

  // For readonly mode, render as preformatted text using <pre> tag
  if (isReadonly) {
    const displayValue = getStringValue() || '-';
    return (
      <div className="mb-[10px] TextAreaDisplayWidget flex flex-col sm:flex-row sm:items-start">
        {label && (
          <div
            className="text-base text-gray-600 font-medium md:min-w-[120px] sm:pr-4 mb-1 sm:mb-0"
            style={{ fontFamily: 'Roboto, sans-serif' }}
            title={label}
          >
            {label}:
          </div>
        )}
        <div className="flex-1">
          <div
            title={String(displayValue || '')}
            className="text-base text-gray-900 font-medium overflow-y-auto whitespace-pre-wrap break-words"
            style={{
              fontFamily: 'Roboto, sans-serif',
              height: '56px',
              minHeight: '56px',
              maxHeight: '56px',

              lineHeight: '20px',
              padding: '8px 0',

              backgroundColor: 'transparent',
              border: 'none',
            }}
          >
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
          {label}
          {isRequired && (
            <span className="text-red-500 ml-1">*</span>
          )}
        </label>
        <div className="flex-1 min-w-0">
          <div style={{ position: 'relative' }}>
            <textarea
              id={widgetConfig['widget-id']}
              rows={rows}
              value={getStringValue()}
              onChange={handleChange}
              onBlur={onBlur}
              disabled={!isEnabled}
              placeholder={placeholder}
              className={`w-full px-3 py-2 border shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                hasError
                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300'
              } ${!isEnabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
              style={{ 
                borderRadius: '10px',
                fontFamily: 'Roboto, sans-serif',
                fontSize: '14px',
                lineHeight: '1.5',
                resize: 'vertical',
                minHeight: `${rows * 1.5 * 14 + 16}px`, // Approximate height based on rows
              }}
            />
            {showCharCounter && (
              <div
                className="absolute bottom-2 right-2 text-xs px-1 rounded"
                style={{
                  fontFamily: 'Roboto, sans-serif',
                  color: maxLength && currentLength > maxLength ? 'var(--owt-widget-error-color, #EF4444)' : 'var(--owt-widget-helptext-color, #6B7280)',
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                }}
              >
                {charCounterText}
              </div>
            )}
          </div>
          {hasError && (
            <p className="text-red-500 text-sm mt-1">{errorMessage}</p>
          )}
        </div>
      </div>
    </div>
  );
};
