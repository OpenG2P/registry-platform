import React, { useMemo, useCallback } from 'react';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';
import { WidgetFieldLabel } from '../components/WidgetFieldLabel';

interface CheckboxWidgetProps {
  config: BaseWidgetConfig;
}

export const CheckboxWidget = ({ config }: CheckboxWidgetProps) => {
  const {
    value,
    error,
    touched,
    isEnabled,
    isRequired,
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

  if (!hasDataSource) {
    const isChecked = Boolean(value);
    
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
            
          </div>
        </div>
      );
    }

    return (
      <div className="mb-[10px]">
        <div className="flex flex-col sm:flex-row sm:items-baseline">
          <WidgetFieldLabel
            className="text-base font-medium leading-normal text-gray-700 md:min-w-[120px] sm:pr-4 mb-1 sm:mb-0 sm:pt-0.5"
            label={translateConfig(widgetConfig['widget-label'])}
            required={isRequired}
          />
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
            
          </div>
        </div>
      </div>
    );
  }

  const processedOptions = useMemo(() => {
    let options = [...dataSourceOptions];

    if (sortOptions) {
      options.sort((a, b) => {
        const labelA = String(a.label || '').toLowerCase();
        const labelB = String(b.label || '').toLowerCase();
        return labelA.localeCompare(labelB);
      });
    }

    return options;
  }, [dataSourceOptions, sortOptions]);

  const selectedValues = useMemo(() => {
    if (value === null || value === undefined) {
      return [];
    }
    if (Array.isArray(value)) {
      return value;
    }
    return [value];
  }, [value]);

  const handleCheckboxChange = useCallback((optionValue: any, checked: boolean) => {
    if (checked) {
      onChange([...selectedValues, optionValue]);
    } else {
      onChange(selectedValues.filter((v: any) => v !== optionValue));
    }
  }, [selectedValues, onChange]);

  const layoutConfig = useMemo(() => {
    switch (layout) {
      case 'horizontal':
        return {
          className: 'flex flex-row flex-wrap items-baseline gap-4',
          style: undefined,
        };
      case 'grid':
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
          
        </div>
      </div>
    );
  }

  return (
    <div className="mb-[10px]">
      <div className="flex flex-col sm:flex-row sm:items-baseline">
        <WidgetFieldLabel
          className="text-base font-medium leading-normal text-gray-700 md:min-w-[120px] sm:pr-4 mb-1 sm:mb-0 sm:pt-0.5"
          label={translateConfig(widgetConfig['widget-label'])}
          required={isRequired}
        />
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
          
        </div>
      </div>
    </div>
  );
};
