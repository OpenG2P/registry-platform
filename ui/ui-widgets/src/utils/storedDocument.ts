import { isSerializedFile } from './fileSerialization';

/** Existing uploaded document hydrated into widget values (not a fresh File upload). */
export type StoredDocumentRef = {
  label: string;
  document_id: string;
  presigned_url: string;
  source_filename?: string;
};

export const isStoredDocumentRef = (value: unknown): value is StoredDocumentRef => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (isSerializedFile(value)) return false;

  const doc = value as Record<string, unknown>;
  return (
    typeof doc.label === 'string' &&
    doc.label.length > 0 &&
    typeof doc.document_id === 'string' &&
    doc.document_id.length > 0 &&
    typeof doc.presigned_url === 'string' &&
    doc.presigned_url.length > 0
  );
};
