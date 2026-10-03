type TFn = (key: string, options?: Record<string, unknown>) => string;

/** Schema string: translation key when present, otherwise the literal value. */
export function tSchema(t: TFn | undefined, value?: string | null): string {
  if (!value) {
    return '';
  }

  return t?.(value, { defaultValue: value }) ?? value;
}

export function toTitleCase(value: string): string {
  const normalized = value.trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  if (!normalized) return '';
  return normalized
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
