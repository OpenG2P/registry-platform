import { WidgetCondition, ConditionOperator } from '../types';
import { getValueByPath } from './pathUtils';

/**
 * Evaluate condition against field value
 */
export const evaluateCondition = (
  condition: WidgetCondition,
  allValues: Record<string, any>
): boolean => {
  const fieldValue = getValueByPath(allValues, condition.field);
  const { operator, value } = condition;

  switch (operator) {
    case 'equals':
      return fieldValue === value;
    case 'notEquals':
      return fieldValue !== value;
    case 'notEmpty':
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
    case 'empty':
      return fieldValue === null || fieldValue === undefined || fieldValue === '';
    case 'greaterThan':
      return Number(fieldValue) > Number(value);
    case 'lessThan':
      return Number(fieldValue) < Number(value);
    case 'contains':
      if (typeof fieldValue === 'string' && typeof value === 'string') {
        return fieldValue.includes(value);
      }
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(value);
      }
      return false;
    case 'notContains':
      if (typeof fieldValue === 'string' && typeof value === 'string') {
        return !fieldValue.includes(value);
      }
      if (Array.isArray(fieldValue)) {
        return !fieldValue.includes(value);
      }
      return true;
    default:
      return false;
  }
};

/**
 * Check if widget should be visible based on conditions
 */
export const shouldShowWidget = (
  options: { action?: string; condition?: WidgetCondition } | undefined,
  allValues: Record<string, any>
): boolean => {
  if (!options?.condition) {
    return true;
  }

  const conditionResult = evaluateCondition(options.condition, allValues);

  if (options.action === 'show') {
    return conditionResult;
  }

  if (options.action === 'hide') {
    return !conditionResult;
  }

  return true;
};

/**
 * Check if widget should be enabled based on conditions
 */
export const shouldEnableWidget = (
  options: { action?: string; condition?: WidgetCondition } | undefined,
  allValues: Record<string, any>
): boolean => {
  if (!options?.condition) {
    return true;
  }

  const conditionResult = evaluateCondition(options.condition, allValues);

  if (options.action === 'enable') {
    return conditionResult;
  }

  if (options.action === 'disable') {
    return !conditionResult;
  }

  return true;
};

