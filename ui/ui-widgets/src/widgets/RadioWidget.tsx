import React, { useMemo, useCallback } from 'react';
import { tSchema } from '../utils/tSchema';
import { useWidgetContext } from '../components/WidgetProvider';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { WidgetFieldLabel } from '../components/WidgetFieldLabel';

interface RadioWidgetProps {
  config: BaseWidgetConfig;
}

export const RadioWidget = ({ config }: RadioWidgetProps) => {
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

  const { t } = useWidgetContext();

  const formatConfig = widgetConfig['widget-data-format'];
  const layout = formatConfig?.layout || widgetConfig['widget-orientation'] || 'vertical';
  const sortOptions = formatConfig?.sortOptions ?? false;
  const allowUnset = !widgetConfig['widget-required'];

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

  const handleChange = useCallback((optionValue: any) => {
    onChange(optionValue);
  }, [onChange]);

  const handleUnset = useCallback(() => {
    if (allowUnset) {
      onChange(null);
    }
  }, [allowUnset, onChange]);

  const currentValue = useMemo(() => {
    if (value === null || value === undefined) {
      return null;
    }
    return value;
  }, [value]);

  const layoutConfig = useMemo(() => {
    switch (layout) {
      case 'horizontal':
        return {
          className: 'flex flex-row flex-wrap gap-4',
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
          className: 'flex flex-col space-y-2',
          style: undefined,
        };
    }
  }, [layout, processedOptions.length]);

  if (widgetConfig['widget-readonly']) {
    const label = tSchema(t, widgetConfig['widget-label']);
    const selectedOption = processedOptions.find(opt => opt.value === currentValue);
    const displayValue = selectedOption
      ? tSchema(t, selectedOption.label)
      : (allowUnset && currentValue === null ? '-' : '');

    return (
      <div className="mb-[10px] RadioDisplayWidget flex flex-col sm:flex-row sm:items-start">
        {label && (
          <div className="text-base owt-text-muted font-medium md:min-w-[120px] sm:pr-4 mb-1 sm:mb-0" style={{ fontFamily: 'Roboto, sans-serif' }} title={label}>
            {label}:
          </div>
        )}
        <div className="flex-1">
          <div className="text-base owt-text font-medium" title={String(displayValue ?? '')}>
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
          className="text-base font-medium owt-text md:min-w-[120px] sm:pr-4 sm:pt-1 mb-1 sm:mb-0"
          label={tSchema(t, widgetConfig['widget-label'])}
          required={isRequired}
        />
        <div className="flex-1 min-w-0">
          <div className={layoutConfig.className} style={layoutConfig.style} onBlur={onBlur}>
            {loading ? (
              <p className="text-sm owt-text-muted">{t?.('common.loading')}</p>
            ) : (
              <>
                {allowUnset && (
                  <label
                    className={`flex items-center cursor-pointer ${
                      !isEnabled || widgetConfig['widget-readonly'] ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name={widgetConfig['widget-id']}
                      checked={currentValue === null}
                      onChange={handleUnset}
                      disabled={!isEnabled || widgetConfig['widget-readonly']}
                      className="mr-2 h-4 w-4 owt-field-check"
                    />
                    <span className="text-sm owt-text">-</span>
                  </label>
                )}
                {processedOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center cursor-pointer ${
                      !isEnabled || widgetConfig['widget-readonly'] ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name={widgetConfig['widget-id']}
                      value={option.value}
                      checked={currentValue === option.value}
                      onChange={() => handleChange(option.value)}
                      disabled={!isEnabled || widgetConfig['widget-readonly']}
                      className="mr-2 h-4 w-4 owt-field-check"
                    />
                    <span className="text-sm owt-text">{tSchema(t, option.label)}</span>
                  </label>
                ))}
              </>
            )}
          </div>
          {touched && error.length > 0 && (
            <p className="owt-field-error text-sm mt-1">{error[0]}</p>
          )}
        </div>
      </div>
    </div>
  );
};
