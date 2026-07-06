import type { SectionConfig } from '../../src/types';

export const DEFAULT_REGISTER_ID = 'a1a4d25a';

export interface LoadSchemaOptions {
  /** Replaces `register-id` and `source-register-id` placeholders. */
  registerId?: string;
  extraReplacements?: Record<string, string>;
}

/** Remove // line comments from JSONC before parsing. */
export function stripJsoncComments(raw: string): string {
  return raw.replace(/^\s*\/\/.*$/gm, '').replace(/\/\/.*$/gm, '');
}

export function substitutePlaceholders(
  value: unknown,
  replacements: Record<string, string>,
): unknown {
  if (typeof value === 'string') {
    let result = value;
    for (const [from, to] of Object.entries(replacements)) {
      result = result.split(from).join(to);
    }
    return result;
  }
  if (Array.isArray(value)) {
    return value.map((item) => substitutePlaceholders(item, replacements));
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        substitutePlaceholders(v, replacements),
      ]),
    );
  }
  return value;
}

export function loadSectionSchema(
  raw: string,
  options: LoadSchemaOptions = {},
): SectionConfig {
  const registerId = options.registerId ?? DEFAULT_REGISTER_ID;
  const replacements: Record<string, string> = {
    'register-id': registerId,
    'source-register-id': registerId,
    '<target_register_id>': 'demo-target-register',
    '<provider_id>': 'esignet',
    '<provider_name>': 'eSignet',
    ...options.extraReplacements,
  };
  const json = stripJsoncComments(raw);
  const parsed = JSON.parse(json) as unknown;
  return substitutePlaceholders(parsed, replacements) as SectionConfig;
}
