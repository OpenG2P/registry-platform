import type { DataSourceRequestHandler } from '../types';

const httpUrl = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
  } catch { /* Document IDs and filenames are not URLs. */ }
  return undefined;
};

export function documentDisplayValue(value: unknown) {
  const object = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const url = httpUrl(typeof value === 'string' ? value : object.presigned_url);
  return {
    document_id: typeof object.document_id === 'string' ? object.document_id
      : typeof value === 'string' && !url ? value : undefined,
    name: typeof object.source_filename === 'string' ? object.source_filename
      : typeof object.name === 'string' ? object.name
      : typeof object.label === 'string' ? object.label : undefined,
    url,
  };
}

export async function resolveDocument(
  handler: DataSourceRequestHandler,
  id: string,
  service = 'shared',
  endpoint = 'get-documents',
) {
  const result = await handler(service, endpoint, 'POST', { document_ids: [id] });
  const document = Array.isArray(result) ? result.find(doc => doc.document_id === id) : null;
  if (!document) throw new Error('Document unavailable');
  const display = documentDisplayValue(document);
  if (!display.url) throw new Error('Invalid document URL');
  return display;
}
