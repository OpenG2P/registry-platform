import { ValidationType } from '../types';

/**
 * Validation pattern mappings for common validation types
 * These patterns can be extended with additional types in the future
 */
const VALIDATION_PATTERNS: Record<ValidationType, { pattern: RegExp; message: string }> = {
  email: {
    // RFC 5322 compliant email regex (simplified but covers most cases)
    pattern: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
    message: 'Invalid email address',
  },
  phone: {
    // Phone number pattern: supports international format with optional +, spaces, dashes, parentheses
    // Allows: +1234567890, (123) 456-7890, 123-456-7890, 123.456.7890, etc.
    pattern: /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/,
    message: 'Invalid phone number',
  },
  url: {
    // URL pattern: supports http, https, and common URL formats
    pattern: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
    message: 'Invalid URL',
  },
};

/**
 * Get validation pattern and message for a given validation type
 * @param validationType - The validation type (email, phone, url, etc.)
 * @returns Object with pattern (RegExp) and message, or null if type not found
 */
export const getValidationPattern = (
  validationType: ValidationType
): { pattern: RegExp; message: string } | null => {
  return VALIDATION_PATTERNS[validationType] || null;
};

/**
 * Get validation pattern string for a given validation type
 * @param validationType - The validation type (email, phone, url, etc.)
 * @returns Regex pattern string, or null if type not found
 */
export const getValidationPatternString = (validationType: ValidationType): string | null => {
  const pattern = getValidationPattern(validationType);
  return pattern ? pattern.pattern.source : null;
};
