import { WidgetFormat } from '../types';
import { formatNumber } from './numberInput';
import { parseDate } from './dateInput';

export const formatDate = (value: any, format: WidgetFormat | undefined): string => {
  if (!value) {
    return '';
  }

  const dateFormat = format?.dateFormat || 'DD-MM-YYYY';

  try {
    const date = typeof value === 'string' ? parseDate(value) : new Date(value);
    if (!date || isNaN(date.getTime())) {
      return value?.toString() || '';
    }

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    return dateFormat
      .replace('DD', day)
      .replace('MM', month)
      .replace('YYYY', year.toString())
      .replace('YY', year.toString().slice(-2));
  } catch {
    return value?.toString() || '';
  }
};

export const formatCurrency = (value: any, format: WidgetFormat | undefined): string => {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) {
    return value?.toString() || '';
  }

  const currency = format?.currency || 'USD';
  const locale = format?.locale || 'en-US';
  const decimals = format?.decimals ?? 2;

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(numValue);
  } catch {
    return numValue.toFixed(decimals);
  }
};

export const formatPhone = (value: any, format: WidgetFormat | undefined): string => {
  if (!value || !format?.pattern) {
    return value?.toString() || '';
  }

  const phoneStr = value.toString().replace(/\D/g, '');
  const pattern = format.pattern;

  let formatted = pattern;
  let digitIndex = 0;

  for (let i = 0; i < pattern.length && digitIndex < phoneStr.length; i++) {
    if (pattern[i] === 'X') {
      formatted = formatted.substring(0, i) + phoneStr[digitIndex] + formatted.substring(i + 1);
      digitIndex++;
    }
  }

  return formatted;
};

export const formatValue = (value: any, format: WidgetFormat | undefined, widgetType?: string): string => {
  if (!format) {
    return value?.toString() || '';
  }

  if (format.dateFormat || widgetType === 'date') {
    return formatDate(value, format);
  }

  if (format.currency) {
    return formatCurrency(value, format);
  }

  if (format.pattern || widgetType === 'phone') {
    return formatPhone(value, format);
  }

  if (widgetType === 'number' || format.numericType || format.decimalPlaces !== undefined) {
    return formatNumber(value, format);
  }

  return value?.toString() || '';
};
