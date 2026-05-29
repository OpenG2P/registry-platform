import { WidgetFormat, NumericType, RoundingMode } from '../types';

/**
 * Format number with thousand and decimal separators
 */
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
  // Default to 0 decimal places (no decimals) unless explicitly specified
  const decimalPlaces = format?.decimalPlaces ?? 0;
  // Default to no thousand separator unless explicitly specified
  const thousandSeparator = format?.thousandSeparator;
  const decimalSeparator = format?.decimalSeparator;

  // If custom separators are specified, format manually
  if (thousandSeparator !== undefined || decimalSeparator !== undefined) {
    return formatNumberWithCustomSeparators(numValue, decimalPlaces, thousandSeparator, decimalSeparator);
  }

  // Use Intl.NumberFormat for locale-aware formatting
  // By default, don't use thousand separators unless explicitly specified
  try {
    const formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
      useGrouping: thousandSeparator !== undefined, // Only use grouping if thousandSeparator is explicitly set
    });
    return formatter.format(numValue);
  } catch {
    // Fallback to simple formatting (no separators)
    return numValue.toFixed(decimalPlaces);
  }
};

/**
 * Format number with custom thousand and decimal separators
 */
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

  // Add thousand separators to integer part
  let formattedInteger = integerPart;
  if (thousandSeparator) {
    const isNegative = integerPart.startsWith('-');
    const digits = isNegative ? integerPart.slice(1) : integerPart;
    
    // Add thousand separators from right to left
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

  // Format decimal part
  if (decimalPlaces > 0 && decimalPart) {
    const sep = decimalSeparator || '.';
    return formattedInteger + sep + decimalPart;
  }

  return formattedInteger;
};

/**
 * Parse formatted number string to number
 */
export const parseNumber = (
  value: string,
  format: WidgetFormat | undefined
): number | null => {
  if (!value || value.trim() === '') {
    return null;
  }

  const thousandSeparator = format?.thousandSeparator || ',';
  const decimalSeparator = format?.decimalSeparator || '.';

  // Remove thousand separators and replace decimal separator with standard '.'
  let cleaned = value
    .replace(new RegExp(`\\${thousandSeparator}`, 'g'), '') // Remove thousand separators
    .replace(new RegExp(`\\${decimalSeparator}`, 'g'), '.'); // Replace decimal separator

  // Remove any remaining non-numeric characters except minus sign and decimal point
  cleaned = cleaned.replace(/[^0-9.-]/g, '');

  // Ensure only one decimal point
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('');
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
};

/**
 * Apply decimal precision with rounding or truncation
 */
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
  } else {
    // Round mode
    return Number(value.toFixed(decimalPlaces));
  }
};

/**
 * Validate numeric value against constraints
 */
export const validateNumericValue = (
  value: number | null,
  format: WidgetFormat | undefined,
  validation?: { min?: number; max?: number; pattern?: string; patternMessage?: string }
): string[] => {
  const errors: string[] = [];

  if (value === null) {
    return errors;
  }

  // Check if integer when required
  if (format?.numericType === 'integer' && !Number.isInteger(value)) {
    errors.push('Value must be an integer');
  }

  // Check if signed numbers are allowed
  if (!format?.allowSigned && value < 0) {
    errors.push('Negative numbers are not allowed');
  }

  // Check decimal places
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

  // Check min/max range
  if (validation) {
    if (validation.min !== undefined && value < validation.min) {
      errors.push(`Minimum value is ${validation.min}`);
    }
    if (validation.max !== undefined && value > validation.max) {
      errors.push(`Maximum value is ${validation.max}`);
    }

    // Pattern validation
    if (validation.pattern && typeof value === 'number') {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value.toString())) {
        errors.push(validation.patternMessage || 'Invalid format');
      }
    }
  }

  return errors;
};

/**
 * Check if a key is allowed for numeric input
 */
export const isAllowedKey = (
  key: string,
  format: WidgetFormat | undefined,
  currentValue: string,
  event?: React.KeyboardEvent<HTMLInputElement>
): boolean => {
  // Allow navigation and control keys
  const navigationKeys = [
    'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
    'Tab', 'Enter', 'Home', 'End', 'Escape', 'PageUp', 'PageDown'
  ];
  if (navigationKeys.includes(key)) {
    return true;
  }

  // Allow Ctrl/Cmd combinations (copy, paste, select all, etc.)
  if (event && (event.ctrlKey || event.metaKey)) {
    // Allow common shortcuts: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z
    const allowedShortcuts = ['a', 'c', 'v', 'x', 'z'];
    if (allowedShortcuts.includes(key.toLowerCase())) {
      return true;
    }
  }

  // Allow Shift combinations for selection
  if (event && event.shiftKey) {
    // Allow Shift with navigation keys
    if (navigationKeys.some(navKey => key.includes(navKey))) {
      return true;
    }
  }

  // Allow digits
  if (/^[0-9]$/.test(key)) {
    return true;
  }

  // Allow decimal separator if decimals are enabled
  if (format?.numericType === 'decimal' || format?.numericType === undefined) {
    const decimalSeparator = format?.decimalSeparator || '.';
    if (key === decimalSeparator || key === '.') {
      // Check if decimal point already exists
      const hasDecimal = currentValue.includes(decimalSeparator) || currentValue.includes('.');
      // Also check if we're at the start (can't start with decimal)
      const selectionStart = event?.currentTarget?.selectionStart || 0;
      return !hasDecimal && selectionStart > 0;
    }
  }

  // Allow minus sign if signed numbers are allowed
  if (format?.allowSigned !== false) {
    if (key === '-' || key === '−') {
      // Minus sign only allowed at the start
      const selectionStart = event?.currentTarget?.selectionStart || 0;
      return selectionStart === 0 && !currentValue.includes('-');
    }
  }

  return false;
};

/**
 * Calculate character count including separators and sign
 */
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
