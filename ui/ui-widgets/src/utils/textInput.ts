import { CharacterType, CaseControl, InputMask } from '../types';

/**
 * Filter input value based on allowed character type
 */
export const filterByCharacterType = (
  value: string,
  characterType: CharacterType = 'any',
  customCharset?: string
): string => {
  if (characterType === 'any') {
    return value;
  }

  let regex: RegExp;

  switch (characterType) {
    case 'alphabetic':
      regex = /[^a-zA-Z\s]/g;
      break;
    case 'alphanumeric':
      regex = /[^a-zA-Z0-9\s]/g;
      break;
    case 'numeric':
      regex = /[^0-9]/g;
      break;
    case 'numeric-decimal':
      regex = /[^0-9.]/g;
      // Ensure only one decimal point
      const parts = value.split('.');
      if (parts.length > 2) {
        return parts[0] + '.' + parts.slice(1).join('');
      }
      return value.replace(regex, '');
    case 'custom':
      if (!customCharset) {
        return value;
      }
      try {
        regex = new RegExp(`[^${customCharset}]`, 'g');
      } catch {
        // Invalid regex, return original value
        return value;
      }
      break;
    default:
      return value;
  }

  return value.replace(regex, '');
};

/**
 * Apply case transformation to text
 */
export const applyCaseControl = (
  value: string,
  caseControl: CaseControl = 'none'
): string => {
  switch (caseControl) {
    case 'lowercase':
      return value.toLowerCase();
    case 'uppercase':
      return value.toUpperCase();
    case 'capitalize':
      // Capitalize first letter of each word
      return value
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    case 'none':
    default:
      return value;
  }
};

/**
 * Apply input mask to value
 */
export const applyMask = (
  value: string,
  mask: InputMask
): { displayValue: string; rawValue: string } => {
  if (!mask || !mask.pattern) {
    return { displayValue: value, rawValue: value };
  }

  // Handle dynamic mask types
  if (mask.type === 'phone') {
    return applyPhoneMask(value);
  } else if (mask.type === 'national-id') {
    return applyNationalIdMask(value, mask.pattern);
  } else if (mask.type === 'static' || !mask.type) {
    return applyStaticMask(value, mask.pattern, mask.placeholder || '_');
  }

  // Custom mask type - use pattern as-is
  return applyStaticMask(value, mask.pattern, mask.placeholder || '_');
};

/**
 * Apply static mask pattern (e.g., "XXX-XXX-XXXX")
 */
const applyStaticMask = (
  value: string,
  pattern: string,
  placeholder: string
): { displayValue: string; rawValue: string } => {
  // Extract raw value (remove mask characters)
  const rawValue = value.replace(/[^a-zA-Z0-9]/g, '');

  let displayValue = '';
  let valueIndex = 0;

  // Apply mask up to the length of available characters
  for (let i = 0; i < pattern.length; i++) {
    const patternChar = pattern[i];
    
    // If pattern character is X, 9, A, or a, replace with value
    if (patternChar === 'X' || patternChar === '9') {
      // X or 9 = any digit
      if (valueIndex < rawValue.length && /[0-9]/.test(rawValue[valueIndex])) {
        displayValue += rawValue[valueIndex];
        valueIndex++;
      } else {
        // Only add placeholder if we haven't filled all characters yet
        // This allows partial input to show without trailing placeholders
        if (valueIndex < rawValue.length) {
          // Skip invalid character
          valueIndex++;
          i--; // Retry this pattern position
          continue;
        }
        // Don't add trailing placeholders for better UX
        break;
      }
    } else if (patternChar === 'A' || patternChar === 'a') {
      // A = uppercase letter, a = lowercase letter
      if (valueIndex < rawValue.length && /[a-zA-Z]/.test(rawValue[valueIndex])) {
        displayValue += patternChar === 'A' 
          ? rawValue[valueIndex].toUpperCase() 
          : rawValue[valueIndex].toLowerCase();
        valueIndex++;
      } else {
        if (valueIndex < rawValue.length) {
          // Skip invalid character
          valueIndex++;
          i--; // Retry this pattern position
          continue;
        }
        break;
      }
    } else {
      // Literal character (e.g., '-', '(', ')')
      // Only add if we have more characters coming or if we've already added something
      if (valueIndex > 0 || valueIndex < rawValue.length) {
        displayValue += patternChar;
      } else {
        break;
      }
    }
  }

  return { displayValue, rawValue };
};

/**
 * Apply phone number mask (dynamic)
 */
const applyPhoneMask = (value: string): { displayValue: string; rawValue: string } => {
  const rawValue = value.replace(/\D/g, '');
  
  if (rawValue.length <= 3) {
    return { displayValue: rawValue, rawValue };
  } else if (rawValue.length <= 6) {
    return { 
      displayValue: `(${rawValue.slice(0, 3)}) ${rawValue.slice(3)}`, 
      rawValue 
    };
  } else if (rawValue.length <= 10) {
    return { 
      displayValue: `(${rawValue.slice(0, 3)}) ${rawValue.slice(3, 6)}-${rawValue.slice(6)}`, 
      rawValue 
    };
  } else {
    // For numbers longer than 10 digits, use international format
    return { 
      displayValue: `+${rawValue.slice(0, -10)} (${rawValue.slice(-10, -7)}) ${rawValue.slice(-7, -4)}-${rawValue.slice(-4)}`, 
      rawValue 
    };
  }
};

/**
 * Apply national ID mask (dynamic, based on pattern)
 */
const applyNationalIdMask = (
  value: string,
  pattern: string
): { displayValue: string; rawValue: string } => {
  const rawValue = value.replace(/\D/g, '');
  
  // Use pattern as template, replacing X or 9 with digits
  return applyStaticMask(rawValue, pattern, '_');
};

/**
 * Remove mask from value to get raw value
 */
export const removeMask = (value: string, mask: InputMask): string => {
  if (!mask || !mask.pattern) {
    return value;
  }

  // For dynamic masks, extract digits/characters
  if (mask.type === 'phone' || mask.type === 'national-id') {
    return value.replace(/\D/g, '');
  }

  // For static masks, we need to extract only the characters that match the pattern placeholders
  // Pattern placeholders: X, 9 (digits), A, a (letters)
  // Remove all characters that are not alphanumeric, but keep track of what should be kept
  const pattern = mask.pattern;
  let rawValue = '';
  let valueIndex = 0;

  for (let i = 0; i < pattern.length && valueIndex < value.length; i++) {
    const patternChar = pattern[i];
    const valueChar = value[valueIndex];

    if (patternChar === 'X' || patternChar === '9') {
      // Should be a digit
      if (/\d/.test(valueChar)) {
        rawValue += valueChar;
        valueIndex++;
      } else if (/[^\d]/.test(valueChar)) {
        // Skip non-digit characters that shouldn't be here
        valueIndex++;
        i--; // Don't advance pattern index
      }
    } else if (patternChar === 'A' || patternChar === 'a') {
      // Should be a letter
      if (/[a-zA-Z]/.test(valueChar)) {
        rawValue += valueChar;
        valueIndex++;
      } else if (/[^a-zA-Z]/.test(valueChar)) {
        // Skip non-letter characters
        valueIndex++;
        i--; // Don't advance pattern index
      }
    } else {
      // Literal character - skip it in the value if it matches
      if (valueChar === patternChar) {
        valueIndex++;
      }
      // If it doesn't match, the value might be malformed, but we'll continue
    }
  }

  // Fallback: if we didn't extract anything meaningful, just remove non-alphanumeric
  if (rawValue === '' && value) {
    return value.replace(/[^a-zA-Z0-9]/g, '');
  }

  return rawValue;
};
