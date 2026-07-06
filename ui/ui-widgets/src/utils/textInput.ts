import { CharacterType, CaseControl, InputMask } from '../types';

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
        return value;
      }
      break;
    default:
      return value;
  }

  return value.replace(regex, '');
};

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
      return value
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    case 'none':
    default:
      return value;
  }
};

export const applyMask = (
  value: string,
  mask: InputMask
): { displayValue: string; rawValue: string } => {
  if (!mask || !mask.pattern) {
    return { displayValue: value, rawValue: value };
  }

  if (mask.type === 'phone') {
    return applyPhoneMask(value);
  } else if (mask.type === 'national-id') {
    return applyNationalIdMask(value, mask.pattern);
  } else if (mask.type === 'static' || !mask.type) {
    return applyStaticMask(value, mask.pattern, mask.placeholder || '_');
  }

  return applyStaticMask(value, mask.pattern, mask.placeholder || '_');
};

const applyStaticMask = (
  value: string,
  pattern: string,
  placeholder: string
): { displayValue: string; rawValue: string } => {
  const rawValue = value.replace(/[^a-zA-Z0-9]/g, '');

  let displayValue = '';
  let valueIndex = 0;

  for (let i = 0; i < pattern.length; i++) {
    const patternChar = pattern[i];

    if (patternChar === 'X' || patternChar === '9') {
      if (valueIndex < rawValue.length && /[0-9]/.test(rawValue[valueIndex])) {
        displayValue += rawValue[valueIndex];
        valueIndex++;
      } else {
        if (valueIndex < rawValue.length) {
          valueIndex++;
          i--;
          continue;
        }
        break;
      }
    } else if (patternChar === 'A' || patternChar === 'a') {
      if (valueIndex < rawValue.length && /[a-zA-Z]/.test(rawValue[valueIndex])) {
        displayValue += patternChar === 'A'
          ? rawValue[valueIndex].toUpperCase()
          : rawValue[valueIndex].toLowerCase();
        valueIndex++;
      } else {
        if (valueIndex < rawValue.length) {
          valueIndex++;
          i--;
          continue;
        }
        break;
      }
    } else {
      if (valueIndex > 0 || valueIndex < rawValue.length) {
        displayValue += patternChar;
      } else {
        break;
      }
    }
  }

  return { displayValue, rawValue };
};

const applyPhoneMask = (value: string): { displayValue: string; rawValue: string } => {
  const rawValue = value.replace(/\D/g, '');

  if (rawValue.length <= 3) {
    return { displayValue: rawValue, rawValue };
  } else if (rawValue.length <= 6) {
    return {
      displayValue: `(${rawValue.slice(0, 3)}) ${rawValue.slice(3)}`,
      rawValue,
    };
  } else if (rawValue.length <= 10) {
    return {
      displayValue: `(${rawValue.slice(0, 3)}) ${rawValue.slice(3, 6)}-${rawValue.slice(6)}`,
      rawValue,
    };
  }

  return {
    displayValue: `+${rawValue.slice(0, -10)} (${rawValue.slice(-10, -7)}) ${rawValue.slice(-7, -4)}-${rawValue.slice(-4)}`,
    rawValue,
  };
};

const applyNationalIdMask = (
  value: string,
  pattern: string
): { displayValue: string; rawValue: string } => {
  const rawValue = value.replace(/\D/g, '');
  return applyStaticMask(rawValue, pattern, '_');
};

export const removeMask = (value: string, mask: InputMask): string => {
  if (!mask || !mask.pattern) {
    return value;
  }

  if (mask.type === 'phone' || mask.type === 'national-id') {
    return value.replace(/\D/g, '');
  }

  const pattern = mask.pattern;
  let rawValue = '';
  let valueIndex = 0;

  for (let i = 0; i < pattern.length && valueIndex < value.length; i++) {
    const patternChar = pattern[i];
    const valueChar = value[valueIndex];

    if (patternChar === 'X' || patternChar === '9') {
      if (/\d/.test(valueChar)) {
        rawValue += valueChar;
        valueIndex++;
      } else if (/[^\d]/.test(valueChar)) {
        valueIndex++;
        i--;
      }
    } else if (patternChar === 'A' || patternChar === 'a') {
      if (/[a-zA-Z]/.test(valueChar)) {
        rawValue += valueChar;
        valueIndex++;
      } else if (/[^a-zA-Z]/.test(valueChar)) {
        valueIndex++;
        i--;
      }
    } else if (valueChar === patternChar) {
      valueIndex++;
    }
  }

  if (rawValue === '' && value) {
    return value.replace(/[^a-zA-Z0-9]/g, '');
  }

  return rawValue;
};
