import { ValidationType } from '../types';

const VALIDATION_PATTERNS: Record<ValidationType, { pattern: RegExp; message: string }> = {
  email: {
    pattern: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
    message: 'Invalid email address',
  },
  phone: {
    pattern: /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/,
    message: 'Invalid phone number',
  },
  url: {
    pattern: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
    message: 'Invalid URL',
  },
};

export const getValidationPattern = (
  validationType: ValidationType
): { pattern: RegExp; message: string } | null => {
  return VALIDATION_PATTERNS[validationType] || null;
};

export const getValidationPatternString = (validationType: ValidationType): string | null => {
  const pattern = getValidationPattern(validationType);
  return pattern ? pattern.pattern.source : null;
};
