import React, { useMemo, useCallback } from 'react';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';

/**
 * Checkbox widget with advanced features
 * 
 * Features:
 * - Single checkbox (boolean) - when no data source
 * - Multiple checkboxes (array) - when data source provided
 * - Static list of options
 * - Dynamic options (from API / dataset)
 * - Ordered options (preserve order or sort)
 * - Option label & value separation
 * - Display label
 * - Stored value (array for multi-select)
 * - Default selection (pre-selected options or empty array)
 * - Required vs optional (at least one must be selected if required)
 * - Layout options (vertical, horizontal, grid)
 * 
 * Usage in schema (single checkbox):
 * {
 *   "widget": "checkbox",
 *   "widget-type": "input",
 *   "widget-label": "I agree to terms",
 *   "widget-id": "agree",
 *   "widget-data-path": "form.agree",
 *   "widget-data-default": false
 * }
 * 
 * Usage in schema (multiple checkboxes):
 * {
 *   "widget": "checkbox",
 *   "widget-type": "input",
 *   "widget-label": "Interests",
 *   "widget-id": "interests",
 *   "widget-data-path": "person.interests",
 *   "widget-data-default": ["sports"],
 *   "widget-data-source": {
 *     "type": "static",
 *     "options": [
 *       { "value": "sports", "label": "Sports" },
 *       { "value": "music", "label": "Music" },
 *       { "value": "reading", "label": "Reading" }
 *     ]
 *   },
 *   "widget-data-format": {
 *     "layout": "vertical",
 *     "sortOptions": false
 *   },
 *   "widget-required": true
 * }
 */
interface CheckboxWidgetProps {
  config: BaseWidgetConfig;
}

export const CheckboxWidget = ({ config }: CheckboxWidgetProps) => {
  const {
    value,
    error,
    touched,
    isEnabled,
    onChange,
    onBlur,
    dataSourceOptions,
    loading,
    config: widgetConfig,
  } = useBaseWidget({ config });

  const { translate, translateConfig } = useWidgetTranslation();

  const hasDataSource = !!widgetConfig['widget-data-source'];
  const formatConfig = widgetConfig['widget-data-format'];
  const layout = formatConfig?.layout || widgetConfig['widget-orientation'] || 'vertical';
  const sortOptions = formatConfig?.sortOptions ?? false;

  // Single checkbox (no data source) - for boolean values
  if (!hasDataSource) {
    const isChecked = Boolean(value);
    
    // For readonly mode, render as display text
    if (widgetConfig['widget-readonly']) {
      const label = translateConfig(widgetConfig['widget-label']);
      const displayValue = isChecked ? 'Yes' : 'No';

      return (
        <div className="mb-[10px] CheckboxDisplayWidget flex flex-col sm:flex-row sm:items-start">
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
        <div className="flex flex-col sm:flex-row sm:items-baseline">
          <label className="text-base font-medium leading-normal text-gray-700 md:min-w-[120px] sm:pr-4 mb-1 sm:mb-0 sm:pt-0.5" style={{ fontFamily: 'Roboto, sans-serif' }} title={translateConfig(widgetConfig['widget-label'])}>
            {translateConfig(widgetConfig['widget-label'])}
            {widgetConfig['widget-required'] && (
              <span className="text-red-500 ml-1">*</span>
            )}
          </label>
          <div className="flex-1 min-w-0">
            <label className="inline-flex cursor-pointer items-baseline gap-2">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => onChange(e.target.checked)}
                onBlur={onBlur}
                disabled={!isEnabled || widgetConfig['widget-readonly']}
                className="relative top-[0.2em] h-4 w-4 shrink-0 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-base leading-normal text-gray-700">
                {isChecked ? 'Yes' : 'No'}
              </span>
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

  // Multiple checkboxes (with data source) - for array values
  // Process and sort options if needed
  const processedOptions = useMemo(() => {
    let options = [...dataSourceOptions];

    // Sort options by label if requested
    if (sortOptions) {
      options.sort((a, b) => {
        const labelA = String(a.label || '').toLowerCase();
        const labelB = String(b.label || '').toLowerCase();
        return labelA.localeCompare(labelB);
      });
    }

    return options;
  }, [dataSourceOptions, sortOptions]);

  // Get selected values as array
  const selectedValues = useMemo(() => {
    if (value === null || value === undefined) {
      return [];
    }
    if (Array.isArray(value)) {
      return value;
    }
    // Handle single value (convert to array)
    return [value];
  }, [value]);

  // Handle checkbox change
  const handleCheckboxChange = useCallback((optionValue: any, checked: boolean) => {
    if (checked) {
      // Add to selection
      onChange([...selectedValues, optionValue]);
    } else {
      // Remove from selection
      onChange(selectedValues.filter((v: any) => v !== optionValue));
    }
  }, [selectedValues, onChange]);

  // Get layout classes and styles
  const layoutConfig = useMemo(() => {
    switch (layout) {
      case 'horizontal':
        return {
          className: 'flex flex-row flex-wrap items-baseline gap-4',
          style: undefined,
        };
      case 'grid':
        // Calculate grid columns based on option count (max 4 columns, min 2)
        const cols = Math.max(2, Math.min(processedOptions.length, 4));
        return {
          className: 'grid gap-3',
          style: { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` },
        };
      case 'vertical':
      default:
        return {
          className: 'flex flex-col gap-2',
          style: undefined,
        };
    }
  }, [layout, processedOptions.length]);

  // For readonly mode, render as display text
  if (widgetConfig['widget-readonly']) {
    const label = translateConfig(widgetConfig['widget-label']);
    const selectedOptions = processedOptions.filter(opt => selectedValues.includes(opt.value));
    const displayValue = selectedOptions.length > 0
      ? selectedOptions.map(opt => translateConfig(opt.label)).join(', ')
      : '-';

    return (
      <div className="mb-3 CheckboxDisplayWidget flex flex-col sm:flex-row sm:items-start">
        {label && (
          <div className="text-sm text-gray-600 font-medium md:min-w-[120px] sm:pr-4 mb-1 sm:mb-0" title={label}>
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
      <div className="flex flex-col sm:flex-row sm:items-baseline">
        <label className="text-base font-medium leading-normal text-gray-700 md:min-w-[120px] sm:pr-4 mb-1 sm:mb-0 sm:pt-0.5" style={{ fontFamily: 'Roboto, sans-serif' }} title={translateConfig(widgetConfig['widget-label'])}>
          {translateConfig(widgetConfig['widget-label'])}
          {widgetConfig['widget-required'] && (
            <span className="text-red-500 ml-1">*</span>
          )}
        </label>
        <div className="flex-1 min-w-0">
          <div className={layoutConfig.className} style={layoutConfig.style} onBlur={onBlur}>
            {loading ? (
              <p className="text-sm text-gray-500">{translate('common.loading')}</p>
            ) : (
              processedOptions.map((option) => (
                <label
                  key={option.value}
                  className={`inline-flex cursor-pointer items-baseline gap-2 ${
                    !isEnabled || widgetConfig['widget-readonly'] ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    value={option.value}
                    checked={selectedValues.includes(option.value)}
                    onChange={(e) => handleCheckboxChange(option.value, e.target.checked)}
                    disabled={!isEnabled || widgetConfig['widget-readonly']}
                    className="relative top-[0.2em] h-4 w-4 shrink-0 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-base leading-normal text-gray-700">{translateConfig(option.label)}</span>
                </label>
              ))
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
