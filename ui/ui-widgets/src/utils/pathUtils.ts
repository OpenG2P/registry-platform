/**
 * Get value from object using dot notation path
 * Safely handles nested paths like "person.name" or "address.street.number"
 */
export const getValueByPath = (obj: any, path: string): any => {
  if (!obj || !path) return undefined;
  
  const keys = path.split('.');
  let result = obj;
  
  for (const key of keys) {
    if (result == null || typeof result !== 'object') {
      return undefined;
    }
    result = result[key];
  }
  
  return result;
};

/**
 * Set value in object using dot notation path
 * Safely creates nested objects as needed
 */
export const setValueByPath = (obj: any, path: string, value: any): any => {
  if (!path) return obj;
  
  const newObj = Array.isArray(obj) ? [...obj] : { ...obj };
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  
  let current = newObj;
  for (const key of keys) {
    if (current[key] == null) {
      current[key] = {};
    } else if (Array.isArray(current[key])) {
      current[key] = [...current[key]];
    } else if (typeof current[key] === 'object') {
      current[key] = { ...current[key] };
    } else {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[lastKey] = value;
  return newObj;
};

/**
 * Parse widget data path (can be string or object)
 */
export const parseDataPath = (
  dataPath: string | Record<string, string> | undefined
): string | Record<string, string> | null => {
  if (!dataPath) return null;
  return dataPath;
};

/**
 * Get value from widget state using data path
 */
/**
 * Resolve a widget-id reference in Redux values.
 * Supports namespaced ids (e.g. "rv-section-0__region_code" when ref is "region_code").
 */
export const resolveWidgetIdValue = (
  values: Record<string, any>,
  ref: string
): any => {
  if (!ref) {
    return undefined;
  }
  if (ref.includes('.')) {
    return getValueByPath(values, ref);
  }
  if (Object.prototype.hasOwnProperty.call(values, ref)) {
    return values[ref];
  }
  const suffix = `__${ref}`;
  for (const [key, val] of Object.entries(values)) {
    if (key.endsWith(suffix)) {
      return val;
    }
  }
  return undefined;
};

export const getWidgetValue = (
  values: Record<string, any>,
  dataPath: string | Record<string, string> | undefined,
  widgetId: string
): any => {
  if (!dataPath) {
    // Fallback to widget-id if no data path
    return values[widgetId];
  }
  if (typeof dataPath === 'string') {
    return getValueByPath(values, dataPath);
  }

  // Multi-path: return object with all paths
  const result: Record<string, any> = {};
  for (const [key, path] of Object.entries(dataPath)) {
    result[key] = getValueByPath(values, path);
  }
  return result;
};

/**
 * Set value in widget state using data path
 */
export const setWidgetValue = (
  currentValues: Record<string, any>,
  dataPath: string | Record<string, string> | undefined,
  widgetId: string,
  value: any
): Record<string, any> => {
  if (!dataPath) {
    // Fallback to widget-id if no data path
    return { ...currentValues, [widgetId]: value };
  }

  if (typeof dataPath === 'string') {
    return setValueByPath(currentValues, dataPath, value);
  }

  // Multi-path: set each path from value object
  let newValues = { ...currentValues };
  for (const [key, path] of Object.entries(dataPath)) {
    if (value && typeof value === 'object' && key in value) {
      newValues = setValueByPath(newValues, path, value[key]);
    }
  }
  return newValues;
};

