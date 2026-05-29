/**
 * Utility functions for serializing File objects to/from Redux state
 * File objects cannot be stored directly in Redux as they are not serializable
 */

export interface SerializedFile {
  __type: 'File';
  name: string;
  type: string;
  size: number;
  lastModified: number;
  data: string; // base64 encoded file data
}

/**
 * Check if a value is a File object
 */
export const isFile = (value: any): value is File => {
  return value instanceof File;
};

/**
 * Check if a value is a serialized file
 */
export const isSerializedFile = (value: any): value is SerializedFile => {
  return value && typeof value === 'object' && value.__type === 'File';
};

/**
 * Convert File object to a serializable format
 * Returns a promise that resolves to a SerializedFile
 */
export const serializeFile = async (file: File): Promise<SerializedFile> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]; // Remove data:type;base64, prefix
      resolve({
        __type: 'File',
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified,
        data: base64,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Convert serialized file back to File object
 */
export const deserializeFile = (serialized: SerializedFile): File => {
  // Convert base64 back to blob
  const byteCharacters = atob(serialized.data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: serialized.type });
  
  // Create File object from blob
  return new File([blob], serialized.name, {
    type: serialized.type,
    lastModified: serialized.lastModified,
  });
};

/**
 * Serialize a value that may contain File objects
 * Handles File objects, arrays of Files, and nested objects
 */
export const serializeValue = async (value: any): Promise<any> => {
  if (value === null || value === undefined) {
    return value;
  }
  
  if (isFile(value)) {
    return await serializeFile(value);
  }
  
  if (Array.isArray(value)) {
    return Promise.all(value.map(item => serializeValue(item)));
  }
  
  if (value && typeof value === 'object' && !(value instanceof Date) && !(value instanceof RegExp)) {
    // Handle plain objects, but skip special objects like Date, RegExp
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = await serializeValue(val);
    }
    return result;
  }
  
  return value;
};

/**
 * Deserialize a value that may contain serialized File objects
 * Handles SerializedFile objects, arrays of SerializedFiles, and nested objects
 */
export const deserializeValue = (value: any): any => {
  if (isSerializedFile(value)) {
    return deserializeFile(value);
  }
  
  if (Array.isArray(value)) {
    return value.map(item => deserializeValue(item));
  }
  
  if (value && typeof value === 'object') {
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = deserializeValue(val);
    }
    return result;
  }
  
  return value;
};

