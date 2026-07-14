type TFn = (key: string, options?: Record<string, unknown>) => string;

/** Schema string: translation key when present, otherwise the literal value. */
export function tSchema(t: TFn | undefined, value?: string | null): string {
  if (!value) {
    return '';
  }

  return t?.(value, { defaultValue: value }) ?? value;
}
