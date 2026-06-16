import React, { useMemo, useCallback, useId } from 'react';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig, BooleanRepresentation } from '../types';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';

/**
 * Boolean widget with advanced features
 * 
 * Features:
 * - Boolean representation (true/false, yes/no, on/off, custom labels)
 * - Control type (checkbox, radio buttons, toggle/switch)
 * - Default value (true, false, unset/null)
 * - Required vs optional
 * - Layout options (horizontal/vertical)
 * 
 * Usage in schema:
 * {
 *   "widget": "boolean",
 *   "widget-type": "input",
 *   "widget-label": "Is Married",
 *   "widget-id": "married",
 *   "widget-data-path": "person.married",
 *   "widget-data-default": false,
 *   "widget-data-format": {
 *     "booleanRepresentation": "yes-no",
 *     "booleanControlType": "radio",
 *     "allowUnset": true
 *   },
 *   "widget-data-validation": {},
 *   "widget-required": false,
 *   "widget-orientation": "horizontal"
 * }
 */
interface BooleanWidgetProps {
  config: BaseWidgetConfig;
}

export const BooleanWidget = ({ config }: BooleanWidgetProps) => {
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

  const formatConfig = widgetConfig['widget-data-format'];
  const representation = formatConfig?.booleanRepresentation || 'true-false';
  const controlType = formatConfig?.booleanControlType || 'checkbox';
  const allowUnset = formatConfig?.allowUnset ?? (widgetConfig['widget-required'] ? false : true);
  const orientation = widgetConfig['widget-orientation'] || 'horizontal';

  // Get labels based on representation
  const getLabels = useCallback((): { trueLabel: string; falseLabel: string } => {
    if (representation === 'custom') {
      return {
        trueLabel: translateConfig(formatConfig?.booleanTrueLabel || 'Yes'),
        falseLabel: translateConfig(formatConfig?.booleanFalseLabel || 'No'),
      };
    }

    const labels: Record<BooleanRepresentation, { trueLabel: string; falseLabel: string }> = {
      'true-false': { trueLabel: 'True', falseLabel: 'False' },
      'yes-no': { trueLabel: 'Yes', falseLabel: 'No' },
      'on-off': { trueLabel: 'On', falseLabel: 'Off' },
      'custom': { trueLabel: 'Yes', falseLabel: 'No' }, // Fallback
    };

    return labels[representation];
  }, [representation, formatConfig, translateConfig]);

  const { trueLabel, falseLabel } = getLabels();

  const unsetLabel = useMemo(
    () => translateConfig(formatConfig?.booleanUnsetLabel || 'Not set'),
    [formatConfig?.booleanUnsetLabel, translateConfig]
  );

  const radioGroupName = `${widgetConfig['widget-id'] ?? 'boolean'}__${useId().replace(/:/g, '')}`;

  // Determine current value (handle null/undefined)
  const currentValue = useMemo(() => {
    if (value === null || value === undefined) {
      return null;
    }
    return Boolean(value);
  }, [value]);

  // Handle value change
  const handleChange = useCallback((newValue: boolean | null) => {
    onChange(newValue);
  }, [onChange]);

  // Handle checkbox change
  const handleCheckboxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    if (allowUnset && !checked && currentValue === true) {
      // If allowUnset and unchecking, set to null
      handleChange(null);
    } else {
      handleChange(checked);
    }
  }, [allowUnset, currentValue, handleChange]);

  // Handle radio change
  const handleRadioChange = useCallback((selectedValue: boolean | null) => {
    handleChange(selectedValue);
  }, [handleChange]);

  // For readonly mode, render as display text
  if (widgetConfig['widget-readonly']) {
    const label = translateConfig(widgetConfig['widget-label']);
    let displayValue = '';
    
    if (currentValue === null) {
      displayValue = '';
    } else if (currentValue === true) {
      displayValue = trueLabel;
    } else {
      displayValue = falseLabel;
    }

    return (
      <div className="mb-[10px] BooleanDisplayWidget flex flex-col sm:flex-row sm:items-start">
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

  // Render based on control type
  if (controlType === 'checkbox') {
    return (
      <div className="mb-[10px]">
        <div className="flex flex-col sm:flex-row sm:items-baseline">
          <label className="text-base font-medium leading-normal text-gray-700 md:min-w-[120px] sm:pr-4 mb-1 sm:mb-0 sm:pt-0.5" style={{ fontFamily: 'Roboto, sans-serif' }} title={translateConfig(widgetConfig['widget-label'])}>
            {translateConfig(widgetConfig['widget-label'])}
            {isRequired && (
              <span className="text-red-500 ml-1">*</span>
            )}
          </label>
          <div className="flex-1 min-w-0">
            <label className="inline-flex items-baseline cursor-pointer gap-2">
              <input
                type="checkbox"
                checked={currentValue === true}
                onChange={handleCheckboxChange}
                onBlur={onBlur}
                disabled={!isEnabled || widgetConfig['widget-readonly']}
                className="relative top-[0.2em] h-4 w-4 shrink-0 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              {(currentValue === true || currentValue === false) && (
                <span className="text-base text-gray-700 leading-normal">
                  {currentValue === true ? trueLabel : falseLabel}
                </span>
              )}
            </label>
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
  }

  if (controlType === 'radio') {
    const containerClass =
      orientation === 'horizontal'
        ? 'flex flex-row flex-wrap items-baseline gap-x-4 gap-y-2'
        : 'flex flex-col items-start gap-2';

    const radioDisabled = !isEnabled || widgetConfig['widget-readonly'];
    const optionDisabledClass = radioDisabled ? 'opacity-50 cursor-not-allowed' : '';

    return (
      <div className="mb-[10px]">
        <div className="flex flex-col sm:flex-row sm:items-baseline">
          <label className="text-base font-medium leading-normal text-gray-700 md:min-w-[120px] sm:pr-4 mb-1 sm:mb-0 sm:pt-0.5" style={{ fontFamily: 'Roboto, sans-serif' }} title={translateConfig(widgetConfig['widget-label'])}>
            {translateConfig(widgetConfig['widget-label'])}
            {isRequired && (
              <span className="text-red-500 ml-1">*</span>
            )}
          </label>
          <div className="flex-1 min-w-0">
            <div className={containerClass} onBlur={onBlur}>
              {allowUnset && (
                <label className={`inline-flex items-baseline gap-2 cursor-pointer ${optionDisabledClass}`}>
                  <input
                    type="radio"
                    name={radioGroupName}
                    checked={currentValue === null}
                    onChange={() => handleRadioChange(null)}
                    disabled={radioDisabled}
                    className="relative top-[0.2em] h-4 w-4 shrink-0 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="text-base text-gray-700 leading-normal">{unsetLabel}</span>
                </label>
              )}
              <label className={`inline-flex items-baseline gap-2 cursor-pointer ${optionDisabledClass}`}>
                <input
                  type="radio"
                  name={radioGroupName}
                  checked={currentValue === true}
                  onChange={() => handleRadioChange(true)}
                  disabled={radioDisabled}
                  className="relative top-[0.2em] h-4 w-4 shrink-0 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="text-base text-gray-700 leading-normal">{trueLabel}</span>
              </label>
              <label className={`inline-flex items-baseline gap-2 cursor-pointer ${optionDisabledClass}`}>
                <input
                  type="radio"
                  name={radioGroupName}
                  checked={currentValue === false}
                  onChange={() => handleRadioChange(false)}
                  disabled={radioDisabled}
                  className="relative top-[0.2em] h-4 w-4 shrink-0 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="text-base text-gray-700 leading-normal">{falseLabel}</span>
              </label>
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
  }

  // Toggle/switch control type
  return (
    <div className="mb-[10px]">
      <div className="flex flex-col sm:flex-row sm:items-baseline">
        <label className="text-base font-medium leading-normal text-gray-700 sm:min-w-[150px] sm:pr-4 mb-1 sm:mb-0 sm:pt-0.5" style={{ fontFamily: 'Roboto, sans-serif' }} title={translateConfig(widgetConfig['widget-label'])}>
          {translateConfig(widgetConfig['widget-label'])}
          {isRequired && (
            <span className="text-red-500 ml-1">*</span>
          )}
        </label>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3" onBlur={onBlur}>
            {allowUnset && (
              <button
                type="button"
                onClick={() => handleChange(null)}
                disabled={!isEnabled || widgetConfig['widget-readonly']}
                className={`px-3 py-1 text-sm border ${
                  currentValue === null
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300'
                } ${!isEnabled || widgetConfig['widget-readonly'] ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                style={{ borderRadius: '15px' }}
              >
                {unsetLabel}
              </button>
            )}
            <button
              type="button"
              onClick={() => handleChange(true)}
              disabled={!isEnabled || widgetConfig['widget-readonly']}
              className={`px-3 py-1 text-sm border ${
                currentValue === true
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300'
              } ${!isEnabled || widgetConfig['widget-readonly'] ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
              style={{ borderRadius: '15px' }}
            >
              {trueLabel}
            </button>
            <button
              type="button"
              onClick={() => handleChange(false)}
              disabled={!isEnabled || widgetConfig['widget-readonly']}
              className={`px-3 py-1 text-sm border ${
                currentValue === false
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300'
              } ${!isEnabled || widgetConfig['widget-readonly'] ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
              style={{ borderRadius: '15px' }}
            >
              {falseLabel}
            </button>
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
