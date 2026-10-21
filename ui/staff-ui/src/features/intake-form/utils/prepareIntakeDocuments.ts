import { deserializeFile } from '../../shared/utils/deserializeFile';

type RecordValue = Record<string, unknown>;
type DocumentRef = { document_id: string; label: string };
type UploadResult = { document_id: string; source_filename: string };
type Upload = (files: File[]) => Promise<UploadResult[] | null | undefined>;

const asObject = (value: unknown): RecordValue | undefined =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? value as RecordValue : undefined;

// Metadata identifies existing string references as well as new file objects.
// The save API replaces section document links, so unchanged IDs must be retained.
function documentFields(schema: unknown, fields = new Map<string, string>()) {
    if (Array.isArray(schema)) schema.forEach(node => documentFields(node, fields));
    const node = asObject(schema);
    if (!node) return fields;
    const path = node['widget-data-path'];
    if (node.widget === 'file') {
        const key = node['column-key'] || (typeof path === 'string' ? path.split('.').slice(1).join('.') || path : '');
        if (typeof key === 'string' && key) fields.set(key, String(node['widget-label'] || key));
    }
    if (node.widget === 'header-section') {
        const imagePath = asObject(path)?.image;
        const key = typeof imagePath === 'string'
            ? imagePath.split('.').slice(1).join('.') || imagePath : 'record_image_document_id';
        fields.set(key, String(node['widget-label'] || key));
    }
    Object.values(node).forEach(value => {
        if (value && typeof value === 'object') documentFields(value, fields);
    });
    return fields;
}

/** Resolve every upload before saving. Never mutate the widget's retry payload. */
export async function prepareIntakeDocuments(
    records: unknown[],
    sectionFiles: unknown[] = [],
    upload: Upload,
    schema?: unknown,
) {
    const pending: Array<{ file: File; label: string; row: number; field: string }> = [];
    const documents: DocumentRef[] = [];
    const fields = documentFields(schema);
    const result = records.map(record => {
        const object = asObject(record);
        if (!object) throw new Error('Invalid intake record');
        return { ...object };
    });

    const collect = (entry: RecordValue, row: number, field: string, label: string) => {
        if (!field || ['__proto__', 'prototype', 'constructor'].includes(field)) {
            throw new Error('Missing or invalid document field');
        }
        if (entry.__type === 'File') {
            pending.push({ file: deserializeFile(entry), row, field, label });
        } else if (typeof entry.document_id === 'string' && entry.document_id) {
            result[row][field] = entry.document_id;
            documents.push({ document_id: entry.document_id, label });
        }
    };

    // Top-level file widgets carry their target field in section_files. A section
    // with multiple records must identify the row, rather than copying one ID to all.
    for (const value of sectionFiles) {
        const entry = asObject(value);
        if (!entry || !['_profile', '_direct_file'].includes(String(entry.tag))) continue;
        const field = typeof entry.field === 'string' ? entry.field : '';
        if (result.length !== 1) throw new Error('Ambiguous document record');
        if (result[0].edit_action === 'DELETE') continue;
        collect(entry, 0, field, String(entry.label || field));
    }

    // Table/dialog file cells remain in their own row. Use that association even
    // when two rows select files with identical names and sizes.
    result.forEach((record, row) => {
        if (record.edit_action === 'DELETE') return;
        for (const [field, value] of Object.entries(record)) {
            // A new selection replaces the old ID at this field after uploading.
            if (pending.some(item => item.row === row && item.field === field)) continue;
            const entry = asObject(value);
            if (entry && (entry.__type === 'File' || typeof entry.document_id === 'string')) {
                collect(entry, row, field, String(entry.label || fields.get(field) || field));
            } else if (fields.has(field) && typeof value === 'string' && value) {
                documents.push({ document_id: value, label: fields.get(field)! });
            }
        }
    });

    // The upload API preserves request order. Check both cardinality and names
    // before attaching anything, so incomplete responses cannot save stale data.
    if (pending.length) {
        const uploaded = await upload(pending.map(item => item.file));
        if (!Array.isArray(uploaded) || uploaded.length !== pending.length ||
            uploaded.some((doc, index) => typeof doc?.document_id !== 'string' || !doc.document_id ||
                doc.source_filename !== pending[index].file.name) ||
            new Set(uploaded.map(doc => doc.document_id)).size !== pending.length) {
            throw new Error('Incomplete document upload');
        }
        uploaded.forEach((doc, index) => {
            const { row, field, label } = pending[index];
            result[row][field] = doc.document_id;
            documents.push({ document_id: doc.document_id, label });
        });
    }

    return { records: result, documents: [...new Map(documents.map(doc => [doc.document_id, doc])).values()] };
}
