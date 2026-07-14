/** JSON-safe `File` representation for Redux (native `File` is not serializable). */
export interface SerializedFile {
  __type: 'File';
  name: string;
  type: string;
  size: number;
  lastModified: number;
  data: string;
}

export const isFile = (value: any): value is File => {
  return value instanceof File;
};

export const isSerializedFile = (value: any): value is SerializedFile => {
  return value && typeof value === 'object' && value.__type === 'File';
};

export const serializeFile = async (file: File): Promise<SerializedFile> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
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

export const deserializeFile = (serialized: SerializedFile): File => {
  const byteCharacters = atob(serialized.data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: serialized.type });

  return new File([blob], serialized.name, {
    type: serialized.type,
    lastModified: serialized.lastModified,
  });
};

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
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = await serializeValue(val);
    }
    return result;
  }

  return value;
};

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
