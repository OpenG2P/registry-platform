import { WidgetCondition, WidgetOptionRule, WidgetOptions } from '../types';
import { getValueByPath } from './pathUtils';

const normalizeBooleanLike = (val: unknown): boolean => {
  if (val === true || val === 1) return true;
  if (val === false || val === 0) return false;
  if (typeof val === 'string') {
    const normalized = val.trim().toLowerCase();
    return normalized === 'true' || normalized === 'yes' || normalized === '1';
  }
  return Boolean(val);
};

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
      if (typeof value === 'boolean') {
        return typeof fieldValue === 'boolean' && fieldValue === value;
      }
      if (typeof fieldValue === 'boolean') {
        return fieldValue === normalizeBooleanLike(value);
      }
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
 * Normalize widget-data-options into a sequential list of action rules.
 * Supports legacy single { action, condition } and new { actions: [...] }.
 */
export const normalizeOptionRules = (options?: WidgetOptions): WidgetOptionRule[] => {
  if (!options) {
    return [];
  }

  if (Array.isArray(options.actions) && options.actions.length > 0) {
    return options.actions.filter((rule) => !!rule?.action);
  }

  if (options.action && options.condition) {
    return [{ action: options.action, condition: options.condition }];
  }

  return [];
};

export const hasVisibilityRules = (options?: WidgetOptions): boolean => {
  return normalizeOptionRules(options).some(
    (rule) => rule.action === 'show' || rule.action === 'hide',
  );
};

export interface WidgetConditionState {
  visible: boolean;
  enabled: boolean;
  required: boolean;
}

/**
 * Evaluate widget-data-options rules sequentially.
 * show/hide and enable/disable only affect visibility and enabled state.
 * require is independent: required = widget-required OR require-condition-match.
 */
export const evaluateWidgetConditions = (
  options: WidgetOptions | undefined,
  allValues: Record<string, any>,
  baseRequired: boolean = false,
): WidgetConditionState => {
  let visible = true;
  let enabled = true;
  let required = baseRequired;

  const rules = normalizeOptionRules(options);

  for (const rule of rules) {
    if (!rule.condition) {
      continue;
    }

    const match = evaluateCondition(rule.condition, allValues);

    switch (rule.action) {
      case 'show':
        visible = match;
        break;
      case 'hide':
        visible = !match;
        break;
      case 'enable':
        enabled = match;
        break;
      case 'disable':
        enabled = !match;
        break;
      case 'require':
        required = baseRequired || match;
        break;
      default:
        break;
    }
  }

  return { visible, enabled, required };
};

export const shouldShowWidget = (
  options: WidgetOptions | undefined,
  allValues: Record<string, any>,
): boolean => evaluateWidgetConditions(options, allValues).visible;

export const shouldEnableWidget = (
  options: WidgetOptions | undefined,
  allValues: Record<string, any>,
): boolean => evaluateWidgetConditions(options, allValues).enabled;

export const shouldRequireWidget = (
  options: WidgetOptions | undefined,
  allValues: Record<string, any>,
  baseRequired: boolean = false,
): boolean => evaluateWidgetConditions(options, allValues, baseRequired).required;