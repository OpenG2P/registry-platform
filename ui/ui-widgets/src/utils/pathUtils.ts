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

/** Remove a nested path (used when reverting to empty schema data). */
export const deleteValueByPath = (obj: any, path: string): any => {
  if (!obj || !path) return obj;

  const keys = path.split('.');
  if (keys.length === 1) {
    if (!Object.prototype.hasOwnProperty.call(obj, keys[0])) {
      return obj;
    }
    const { [keys[0]]: _removed, ...rest } = obj;
    return rest;
  }

  const newObj = Array.isArray(obj) ? [...obj] : { ...obj };
  const lastKey = keys[keys.length - 1];
  let current = newObj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] == null || typeof current[key] !== 'object') {
      return newObj;
    }
    current[key] = Array.isArray(current[key]) ? [...current[key]] : { ...current[key] };
    current = current[key];
  }

  if (Object.prototype.hasOwnProperty.call(current, lastKey)) {
    delete current[lastKey];
  }
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
  return undefined;
};

export const getWidgetValue = (
  values: Record<string, any>,
  dataPath: string | Record<string, string> | undefined,
  widgetId: string
): any => {
  if (!dataPath) {
    return values[widgetId];
  }
  if (typeof dataPath === 'string') {
    return getValueByPath(values, dataPath);
  }

  const result: Record<string, any> = {};
  for (const [key, path] of Object.entries(dataPath)) {
    result[key] = getValueByPath(values, path);
  }
  return result;
};

/**
 * Set value in widget state using data path.
 * Pass `undefined` to clear the path(s) and widgetId entry.
 */
export const setWidgetValue = (
  currentValues: Record<string, any>,
  dataPath: string | Record<string, string> | undefined,
  widgetId: string,
  value: any
): Record<string, any> => {
  const clearWidgetId = (values: Record<string, any>) => {
    if (!widgetId || !Object.prototype.hasOwnProperty.call(values, widgetId)) {
      return values;
    }
    const { [widgetId]: _removed, ...rest } = values;
    return rest;
  };

  if (value === undefined) {
    let cleared = currentValues;
    if (!dataPath) {
      return clearWidgetId(cleared);
    }
    if (typeof dataPath === 'string') {
      cleared = deleteValueByPath(cleared, dataPath);
    } else {
      for (const path of Object.values(dataPath)) {
        if (typeof path === 'string') {
          cleared = deleteValueByPath(cleared, path);
        }
      }
    }
    return clearWidgetId(cleared);
  }

  if (!dataPath) {
    return { ...currentValues, [widgetId]: value };
  }

  if (typeof dataPath === 'string') {
    const next = setValueByPath(currentValues, dataPath, value);
    return widgetId ? { ...next, [widgetId]: value } : next;
  }

  let newValues = { ...currentValues };
  if (value === null) {
    for (const path of Object.values(dataPath)) {
      if (typeof path === 'string') {
        newValues = setValueByPath(newValues, path, null);
      }
    }
  } else {
    for (const [key, path] of Object.entries(dataPath)) {
      if (value && typeof value === 'object' && key in value) {
        const pathValue = value[key];
        newValues =
          pathValue === undefined
            ? deleteValueByPath(newValues, path)
            : setValueByPath(newValues, path, pathValue);
      }
    }
  }
  return widgetId ? { ...newValues, [widgetId]: value } : newValues;
};

