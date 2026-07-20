import { WidgetFormat } from '../types';

export const formatNumber = (
  value: number | string,
  format: WidgetFormat | undefined
): string => {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) {
    return String(value);
  }

  const locale = format?.locale || 'en-US';
  const decimalPlaces = format?.decimalPlaces ?? 0;
  const thousandSeparator = format?.thousandSeparator;
  const decimalSeparator = format?.decimalSeparator;

  if (thousandSeparator !== undefined || decimalSeparator !== undefined) {
    return formatNumberWithCustomSeparators(numValue, decimalPlaces, thousandSeparator, decimalSeparator);
  }

  try {
    const formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
      useGrouping: thousandSeparator !== undefined,
    });
    return formatter.format(numValue);
  } catch {
    return numValue.toFixed(decimalPlaces);
  }
};

const formatNumberWithCustomSeparators = (
  value: number,
  decimalPlaces: number,
  thousandSeparator?: string,
  decimalSeparator?: string
): string => {
  const fixed = value.toFixed(decimalPlaces);
  const parts = fixed.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];

  let formattedInteger = integerPart;
  if (thousandSeparator) {
    const isNegative = integerPart.startsWith('-');
    const digits = isNegative ? integerPart.slice(1) : integerPart;

    let withSeparators = '';
    for (let i = digits.length - 1; i >= 0; i--) {
      const pos = digits.length - 1 - i;
      if (pos > 0 && pos % 3 === 0) {
        withSeparators = thousandSeparator + withSeparators;
      }
      withSeparators = digits[i] + withSeparators;
    }

    formattedInteger = (isNegative ? '-' : '') + withSeparators;
  }

  if (decimalPlaces > 0 && decimalPart) {
    const sep = decimalSeparator || '.';
    return formattedInteger + sep + decimalPart;
  }

  return formattedInteger;
};

export const parseNumber = (
  value: string,
  format: WidgetFormat | undefined
): number | null => {
  if (!value || value.trim() === '') {
    return null;
  }

  const thousandSeparator = format?.thousandSeparator || ',';
  const decimalSeparator = format?.decimalSeparator || '.';

  let cleaned = value
    .replace(new RegExp(`\\${thousandSeparator}`, 'g'), '')
    .replace(new RegExp(`\\${decimalSeparator}`, 'g'), '.');

  cleaned = cleaned.replace(/[^0-9.-]/g, '');

  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('');
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
};

export const applyDecimalPrecision = (
  value: number,
  format: WidgetFormat | undefined
): number => {
  if (format?.numericType === 'integer') {
    return Math.round(value);
  }

  const decimalPlaces = format?.decimalPlaces ?? 2;
  const roundingMode = format?.roundingMode || 'round';

  if (roundingMode === 'truncate') {
    const multiplier = Math.pow(10, decimalPlaces);
    return Math.trunc(value * multiplier) / multiplier;
  }

  return Number(value.toFixed(decimalPlaces));
};

export const validateNumericValue = (
  value: number | null,
  format: WidgetFormat | undefined,
  validation?: { min?: number; max?: number; pattern?: string; patternMessage?: string }
): string[] => {
  const errors: string[] = [];

  if (value === null) {
    return errors;
  }

  if (format?.numericType === 'integer' && !Number.isInteger(value)) {
    errors.push('Value must be an integer');
  }

  if (!format?.allowSigned && value < 0) {
    errors.push('Negative numbers are not allowed');
  }

  if (format?.numericType === 'decimal' && format?.decimalPlaces !== undefined) {
    const decimalPlaces = format.decimalPlaces;
    const valueStr = value.toString();
    const decimalIndex = valueStr.indexOf('.');
    if (decimalIndex !== -1) {
      const actualDecimalPlaces = valueStr.length - decimalIndex - 1;
      if (actualDecimalPlaces > decimalPlaces) {
        errors.push(`Maximum ${decimalPlaces} decimal place${decimalPlaces !== 1 ? 's' : ''} allowed`);
      }
    }
  }

  if (validation) {
    if (validation.min !== undefined && value < validation.min) {
      errors.push(`Minimum value is ${validation.min}`);
    }
    if (validation.max !== undefined && value > validation.max) {
      errors.push(`Maximum value is ${validation.max}`);
    }

    if (validation.pattern && typeof value === 'number') {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value.toString())) {
        errors.push(validation.patternMessage || 'Invalid format');
      }
    }
  }

  return errors;
};

export const isAllowedKey = (
  key: string,
  format: WidgetFormat | undefined,
  currentValue: string,
  event?: React.KeyboardEvent<HTMLInputElement>
): boolean => {
  const navigationKeys = [
    'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
    'Tab', 'Enter', 'Home', 'End', 'Escape', 'PageUp', 'PageDown',
  ];
  if (navigationKeys.includes(key)) {
    return true;
  }

  if (event && (event.ctrlKey || event.metaKey)) {
    const allowedShortcuts = ['a', 'c', 'v', 'x', 'z'];
    if (allowedShortcuts.includes(key.toLowerCase())) {
      return true;
    }
  }

  if (event && event.shiftKey) {
    if (navigationKeys.some(navKey => key.includes(navKey))) {
      return true;
    }
  }

  if (/^[0-9]$/.test(key)) {
    return true;
  }

  if (format?.numericType === 'decimal' || format?.numericType === undefined) {
    const decimalSeparator = format?.decimalSeparator || '.';
    if (key === decimalSeparator || key === '.') {
      const hasDecimal = currentValue.includes(decimalSeparator) || currentValue.includes('.');
      const selectionStart = event?.currentTarget?.selectionStart || 0;
      return !hasDecimal && selectionStart > 0;
    }
  }

  if (format?.allowSigned !== false) {
    if (key === '-' || key === '−') {
      const selectionStart = event?.currentTarget?.selectionStart || 0;
      return selectionStart === 0 && !currentValue.includes('-');
    }
  }

  return false;
};

export const getFormattedNumberLength = (
  value: number | string | null,
  format: WidgetFormat | undefined
): number => {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const formatted = formatNumber(
    typeof value === 'string' ? parseFloat(value) : value,
    format
  );
  return formatted.length;
};

export const normalizeNumericDefault = (
  defaultValue: unknown,
  format: WidgetFormat | undefined
): number | null | undefined => {
  if (defaultValue === undefined) {
    return undefined;
  }
  if (defaultValue === null || defaultValue === '') {
    return null;
  }

  const numValue =
    typeof defaultValue === 'number'
      ? defaultValue
      : parseNumber(String(defaultValue), format);

  if (numValue === null || isNaN(numValue)) {
    return undefined;
  }

  return applyDecimalPrecision(numValue, format);
};
