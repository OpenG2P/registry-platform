import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { tSchema } from '../utils/tSchema';
import { useWidgetContext } from '../components/WidgetProvider';
import { useSelector } from 'react-redux';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { WidgetFieldLabel } from '../components/WidgetFieldLabel';
import { WidgetRootState } from '../store';
import { getValueByPath } from '../utils/pathUtils';
import {
  parseDate,
  formatDateToISO,
  formatDateToString,
  parseDateFromFormat,
  getMinDate,
  getMaxDate,
  validateDateConstraints,
  resolveDateBoundFromFieldValue,
  mergeMinDateBounds,
  mergeMaxDateBounds,
} from '../utils/dateInput';

interface DateInputWidgetProps {
  config: BaseWidgetConfig;
}

export const DateInputWidget = ({ config }: DateInputWidgetProps) => {
  const {
    value,
    error,
    touched,
    isEnabled,
    isRequired,
    onChange,
    onBlur,
    setError,
    config: widgetConfig,
  } = useBaseWidget({ config });

  const formValues = useSelector((state: WidgetRootState) => state.widget.values);
  const { t } = useWidgetContext();

  const formatConfig = widgetConfig['widget-data-format'];
  const optionsConfig = widgetConfig['widget-data-options'];
  const dateFormat = formatConfig?.dateFormat || 'YYYY-MM-DD';
  const inputMethod = formatConfig?.inputMethod || 'picker';
  const dateConstraint = formatConfig?.dateConstraint || 'any';
  const minDate = optionsConfig?.minDate;
  const maxDate = optionsConfig?.maxDate;
  const minDateField = optionsConfig?.minDateField as string | undefined;
  const maxDateField = optionsConfig?.maxDateField as string | undefined;
  const minDateMessage = optionsConfig?.minDateMessage
    ? tSchema(t, optionsConfig.minDateMessage)
    : undefined;
  const maxDateMessage = optionsConfig?.maxDateMessage
    ? tSchema(t, optionsConfig.maxDateMessage)
    : undefined;
  const defaultToToday = widgetConfig['widget-data-default'] === 'today';

  const [manualInputValue, setManualInputValue] = useState<string>('');
  const [isFocused, setIsFocused] = useState<boolean>(false);

  const fieldMinDate = useMemo(() => {
    if (!minDateField) {
      return undefined;
    }
    return resolveDateBoundFromFieldValue(getValueByPath(formValues, minDateField));
  }, [formValues, minDateField]);

  const fieldMaxDate = useMemo(() => {
    if (!maxDateField) {
      return undefined;
    }
    return resolveDateBoundFromFieldValue(getValueByPath(formValues, maxDateField));
  }, [formValues, maxDateField]);

  const effectiveMinDate = useMemo(() => {
    const staticMin = getMinDate(dateConstraint, minDate);
    return mergeMinDateBounds(staticMin, fieldMinDate);
  }, [dateConstraint, minDate, fieldMinDate]);

  const effectiveMaxDate = useMemo(() => {
    const staticMax = getMaxDate(dateConstraint, maxDate);
    return mergeMaxDateBounds(staticMax, fieldMaxDate);
  }, [dateConstraint, maxDate, fieldMaxDate]);

  const constraintMessages = useMemo(
    () => ({ minDateMessage, maxDateMessage }),
    [minDateMessage, maxDateMessage]
  );

  const runDateConstraintValidation = useCallback(
    (dateValue: string | Date | null | undefined): string | null => {
      if (!dateValue) {
        return null;
      }
      return validateDateConstraints(
        dateValue,
        effectiveMinDate,
        effectiveMaxDate,
        dateConstraint,
        constraintMessages
      );
    },
    [effectiveMinDate, effectiveMaxDate, dateConstraint, constraintMessages]
  );

  useEffect(() => {
    if (defaultToToday && (value === null || value === undefined || value === '')) {
      const todayISO = formatDateToISO(new Date());
      onChange(todayISO);
    }
  }, [defaultToToday, value, onChange]);

  // Re-validate when a relative bound field changes (e.g. start date set after end date)
  useEffect(() => {
    if (!value) {
      return;
    }
    const constraintError = runDateConstraintValidation(value);
    if (constraintError) {
      setError([constraintError]);
    }
  }, [fieldMinDate, fieldMaxDate, value, runDateConstraintValidation, setError]);

  const getDisplayValue = useCallback((): string => {
    if (inputMethod === 'picker') {
      if (!value) return '';
      return formatDateToISO(value);
    }

    if (isFocused && manualInputValue) {
      return manualInputValue;
    }

    if (!value) return '';

    if (dateFormat === 'YYYY-MM-DD') {
      return formatDateToISO(value);
    }

    return formatDateToString(value, dateFormat);
  }, [value, inputMethod, dateFormat, isFocused, manualInputValue]);

  useEffect(() => {
    if (!isFocused && value) {
      if (dateFormat === 'YYYY-MM-DD') {
        setManualInputValue(formatDateToISO(value));
      } else {
        setManualInputValue(formatDateToString(value, dateFormat));
      }
    }
  }, [value, dateFormat, isFocused]);

  const applyConstraintError = useCallback(
    (dateValue: string) => {
      const constraintError = runDateConstraintValidation(dateValue);
      setError(constraintError ? [constraintError] : []);
    },
    [runDateConstraintValidation, setError]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;

      if (inputMethod === 'picker') {
        if (inputValue) {
          const date = parseDate(inputValue);
          if (date) {
            const iso = formatDateToISO(date);
            onChange(iso);
            applyConstraintError(iso);
          } else {
            onChange('');
            setError([]);
          }
        } else {
          onChange('');
          setError([]);
        }
      } else {
        setManualInputValue(inputValue);

        if (inputValue) {
          const date = parseDateFromFormat(inputValue, dateFormat);
          if (date) {
            const iso = formatDateToISO(date);
            onChange(iso);
            applyConstraintError(iso);
          }
        } else {
          onChange('');
          setError([]);
        }
      }
    },
    [inputMethod, dateFormat, onChange, applyConstraintError, setError]
  );

  const handleBlur = useCallback(() => {
    setIsFocused(false);

    if (inputMethod !== 'picker' && manualInputValue) {
      const date = parseDateFromFormat(manualInputValue, dateFormat);
      if (date) {
        const formatted = formatDateToString(date, dateFormat);
        setManualInputValue(formatted);
        const iso = formatDateToISO(date);
        onChange(iso);
        applyConstraintError(iso);
      } else {
        setManualInputValue('');
        onChange('');
        setError([]);
      }
    }

    onBlur();

    if (value) {
      const constraintError = runDateConstraintValidation(value);
      if (constraintError) {
        setError([constraintError]);
      }
    }
  }, [
    inputMethod,
    manualInputValue,
    dateFormat,
    onChange,
    onBlur,
    applyConstraintError,
    value,
    runDateConstraintValidation,
    setError,
  ]);

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

  const placeholder = useMemo(() => {
    const display = getDisplayValue();
    const hasValue = display && display.trim().length > 0;
    const placeholderText = tSchema(t, widgetConfig['widget-data-placeholder']);
    return hasValue ? undefined : placeholderText || dateFormat;
  }, [getDisplayValue, widgetConfig, t, dateFormat]);

  const inputType = inputMethod === 'picker' ? 'date' : 'text';

  const showRequiredError =
    widgetConfig['widget-required'] && (!value || value === '');
  const showValidationError = touched && error.length > 0;

  if (widgetConfig['widget-readonly']) {
    const label = tSchema(t, widgetConfig['widget-label']);
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
          <div
            className="text-base text-gray-600 font-medium md:min-w-[120px] sm:pr-4 mb-1 sm:mb-0"
            style={{ fontFamily: 'Roboto, sans-serif' }}
            title={label}
          >
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
              showValidationError || showRequiredError
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300'
            } ${!isEnabled || widgetConfig['widget-readonly'] ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
            style={{ borderRadius: '10px' }}
            title={tSchema(t, widgetConfig['widget-data-tooltip'])}
          />
          {showValidationError && <p className="text-red-500 text-sm mt-1">{error[0]}</p>}
        </div>
      </div>
    </div>
  );
};
