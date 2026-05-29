import { z } from 'zod';
import { WidgetValidation, WidgetDataPath } from '../types';
import { getValidationPattern } from './validationPatterns';

/**
 * Validate value against validation rules.
 *
 * @param skipRequired - When true, required-field checks are skipped (used by
 *   per-section Save/Next buttons so the user can move between sections without
 *   filling every mandatory field; only format/range checks still run).
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

  // Check required (skipped when navigating between sections)
  const isRequired = !skipRequired && (validation?.required ?? required);
  // For boolean, false is a valid value, so only check for null/undefined/empty string
  const isEmpty = value === null || value === undefined || value === '';
  if (isRequired && isEmpty) {
    errors.push('This field is required');
    return errors; // Return early if required field is empty
  }

  // Skip format/range validations if value is empty
  if (isEmpty) {
    return errors;
  }

  if (!validation) {
    return errors;
  }

  // Pattern validation
  if (typeof value === 'string') {
    let patternToUse: RegExp | null = null;
    let patternMessage: string | undefined = undefined;

    // Priority: explicit pattern > validationType
    if (validation.pattern) {
      // Use explicit pattern if provided
      patternToUse = new RegExp(validation.pattern);
      patternMessage = validation.patternMessage;
    } else if (validation.validationType) {
      // Use predefined validation type pattern
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

  // String length validations
  if (typeof value === 'string') {
    if (validation.minLength && value.length < validation.minLength) {
      errors.push(`Minimum length is ${validation.minLength}`);
    }
    if (validation.maxLength && value.length > validation.maxLength) {
      errors.push(`Maximum length is ${validation.maxLength}`);
    }
  }

  // Number validations
  if (typeof value === 'number') {
    if (validation.min !== undefined && value < validation.min) {
      errors.push(`Minimum value is ${validation.min}`);
    }
    if (validation.max !== undefined && value > validation.max) {
      errors.push(`Maximum value is ${validation.max}`);
    }
  }

  // Zod schema validation
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

/**
 * Create Zod schema from validation config
 */
export const createZodSchema = (
  validation: WidgetValidation | undefined,
  required: boolean = false
): z.ZodSchema | null => {
  if (!validation && !required) {
    return null;
  }

  const isRequired = validation?.required ?? required;
  let schema: z.ZodSchema = z.any();

  // String validations
  if (validation?.pattern || validation?.validationType || validation?.minLength || validation?.maxLength) {
    let stringSchema: z.ZodString = z.string();
    
    // Priority: explicit pattern > validationType
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

  // Number validations
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

  // Apply required
  if (isRequired) {
    // For string schemas, use min(1) instead of nonempty
    if (schema instanceof z.ZodString) {
      schema = schema.min(1, 'This field is required');
    }
    // For other types, they're already required by default
  } else {
    schema = schema.optional();
  }

  return schema;
};

