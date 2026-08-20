import { z } from 'zod';
import { DocsWidgetDocumentConfig, WidgetValidation } from '../types';
import { isSerializedFile } from './fileSerialization';
import { getValidationPattern } from './validationPatterns';

export const isWidgetValueEmpty = (value: unknown): boolean => {
  if (value === null || value === undefined || value === '') {
    return true;
  }
  if (typeof value === 'object' && !Array.isArray(value) && value !== null && 'value' in value) {
    const inner = (value as { value: unknown }).value;
    return inner === null || inner === undefined || inner === '';
  }
  return false;
};

/**
 * @param skipRequired - Skip required checks for per-section Save/Next navigation;
 *   format and range validation still run.
 */
export const validateWidget = (
  value: any,
  validation: WidgetValidation | undefined,
  required: boolean = false,
  skipRequired: boolean = false,
): string[] => {
  const errors: string[] = [];

  if (!validation && !required) {
    return errors;
  }

  const isRequired = !skipRequired && (validation?.required ?? required);
  const isEmpty = isWidgetValueEmpty(value);
  if (isRequired && isEmpty) {
    errors.push('This field is required');
    return errors;
  }

  if (isEmpty) {
    return errors;
  }

  if (!validation) {
    return errors;
  }

  if (typeof value === 'string') {
    let patternToUse: RegExp | null = null;
    let patternMessage: string | undefined = undefined;

    if (validation.pattern) {
      patternToUse = new RegExp(validation.pattern);
      patternMessage = validation.patternMessage;
    } else if (validation.validationType) {
      const validationPattern = getValidationPattern(validation.validationType);
      if (validationPattern) {
        patternToUse = validationPattern.pattern;
        patternMessage = validation.patternMessage || validationPattern.message;
      }
    }

    if (patternToUse && !patternToUse.test(value)) {
      errors.push(patternMessage || 'Invalid format');
    }
  }

  if (typeof value === 'string') {
    if (validation.minLength && value.length < validation.minLength) {
      errors.push(`Minimum length is ${validation.minLength}`);
    }
    if (validation.maxLength && value.length > validation.maxLength) {
      errors.push(`Maximum length is ${validation.maxLength}`);
    }
  }

  if (typeof value === 'number') {
    if (validation.min !== undefined && value < validation.min) {
      errors.push(`Minimum value is ${validation.min}`);
    }
    if (validation.max !== undefined && value > validation.max) {
      errors.push(`Maximum value is ${validation.max}`);
    }
  }

  if (validation.zodSchema) {
    try {
      validation.zodSchema.parse(value);
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(...error.issues.map((e: z.ZodIssue) => e.message));
      } else {
        errors.push('Validation failed');
      }
    }
  }

  return errors;
};

const isDocsSlotFilled = (stored: unknown): boolean => {
  if (stored == null || stored === '') {
    return false;
  }
  if (typeof stored === 'string') {
    return stored.trim().length > 0;
  }
  if (typeof File !== 'undefined' && stored instanceof File) {
    return true;
  }
  return isSerializedFile(stored);
};

export const validateDocsWidget = (
  value: unknown,
  documents: DocsWidgetDocumentConfig[] | undefined,
  skipRequired: boolean = false,
): string[] => {
  if (skipRequired || !documents?.length) {
    return [];
  }

  const docsValue =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const errors: string[] = [];
  for (const doc of documents) {
    if (!doc['document-required']) continue;
    if (!isDocsSlotFilled(docsValue[doc['document-key']])) {
      errors.push('This document is required');
    }
  }
  return errors;
};

export const createZodSchema = (
  validation: WidgetValidation | undefined,
  required: boolean = false
): z.ZodSchema | null => {
  if (!validation && !required) {
    return null;
  }

  const isRequired = validation?.required ?? required;
  let schema: z.ZodSchema = z.any();

  if (validation?.pattern || validation?.validationType || validation?.minLength || validation?.maxLength) {
    let stringSchema: z.ZodString = z.string();

    if (validation.pattern) {
      stringSchema = stringSchema.regex(new RegExp(validation.pattern));
    } else if (validation.validationType) {
      const validationPattern = getValidationPattern(validation.validationType);
      if (validationPattern) {
        stringSchema = stringSchema.regex(validationPattern.pattern, {
          message: validation.patternMessage || validationPattern.message,
        });
      }
    }

    if (validation.minLength) {
      stringSchema = stringSchema.min(validation.minLength);
    }
    if (validation.maxLength) {
      stringSchema = stringSchema.max(validation.maxLength);
    }
    schema = stringSchema;
  }

  if (validation?.min !== undefined || validation?.max !== undefined) {
    let numberSchema: z.ZodNumber = z.number();
    if (validation.min !== undefined) {
      numberSchema = numberSchema.min(validation.min);
    }
    if (validation.max !== undefined) {
      numberSchema = numberSchema.max(validation.max);
    }
    schema = numberSchema;
  }

  if (isRequired) {
    if (schema instanceof z.ZodString) {
      schema = schema.min(1, 'This field is required');
    }
  } else {
    schema = schema.optional();
  }

  return schema;
};
