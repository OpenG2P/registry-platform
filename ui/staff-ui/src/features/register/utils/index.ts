import { deserializeFile } from '@/features/shared/utils';
import { UploadedDocument } from '@/features/shared/types';
import { DisplayField } from '../types';

export const sortedDisplayFields = (fields: DisplayField[]): DisplayField[] => {
    return [...fields].sort((firstField, secondField) => firstField.order - secondField.order);
};

export type ExistingSectionDocument = {
    document_id: string;
    label: string;
    field?: string;
    document_key?: string;
    tag?: string;
    presigned_url?: string;
    source_filename?: string;
};

const isExistingSectionDocument = (value: object): value is ExistingSectionDocument & {
    tag?: string;
    field?: string;
    document_key?: string;
} => {
    if ((value as { __type?: string }).__type === 'File') return false;
    const doc = value as Record<string, unknown>;
    return (
        typeof doc.document_id === 'string' &&
        doc.document_id.length > 0 &&
        typeof doc.label === 'string' &&
        doc.label.length > 0
    );
};

export const extractFilesFromSection = (files?: unknown[], tag?: string) => {
    const filesToUpload: File[] = [];
    const fileLabels: string[] = [];
    const fileTargets: Array<{
        field?: string;
        document_key?: string;
        label?: string;
        tag?: string;
    }> = [];
    const existingDocuments: ExistingSectionDocument[] = [];

    if (Array.isArray(files)) {
        files.forEach((value, index) => {
            if (!value || typeof value !== 'object') {
                return;
            }

            const fileTag = typeof (value as { tag?: unknown }).tag === 'string'
                ? (value as { tag: string }).tag
                : undefined;
            if (tag && fileTag !== tag) {
                return;
            }

            // Already-uploaded document ref — keep id/label, do not re-upload.
            if (isExistingSectionDocument(value)) {
                existingDocuments.push({
                    document_id: value.document_id,
                    label: value.label,
                    field: typeof (value as { field?: unknown }).field === 'string'
                        ? (value as { field: string }).field
                        : undefined,
                    document_key:
                        typeof (value as { document_key?: unknown }).document_key === 'string'
                            ? (value as { document_key: string }).document_key
                            : undefined,
                    tag: fileTag,
                    presigned_url:
                        typeof (value as { presigned_url?: unknown }).presigned_url === 'string'
                            ? (value as { presigned_url: string }).presigned_url
                            : undefined,
                    source_filename:
                        typeof (value as { source_filename?: unknown }).source_filename === 'string'
                            ? (value as { source_filename: string }).source_filename
                            : undefined,
                });
                return;
            }

            if ((value as { __type?: string }).__type !== 'File') {
                return;
            }

            try {
                const realFile = deserializeFile(value);
                filesToUpload.push(realFile);

                const label =
                    (value as { label?: string }).label ||
                    (value as { name?: string }).name ||
                    `file_${index}`;
                fileLabels.push(label);
                fileTargets.push({
                    field: typeof (value as { field?: unknown }).field === 'string'
                        ? (value as { field: string }).field
                        : undefined,
                    document_key:
                        typeof (value as { document_key?: unknown }).document_key === 'string'
                            ? (value as { document_key: string }).document_key
                            : undefined,
                    label,
                    tag: fileTag,
                });
            } catch (error) {
                console.error('Failed to deserialize file:', error);
            }
        });
    }

    return {
        filesToUpload,
        fileLabels,
        fileTargets,
        existingDocuments,
    };
};

export const matchUploadedDocuments = (
    documents: UploadedDocument[],
    extracted: ReturnType<typeof extractFilesFromSection>,
) => {
    const remaining = [...documents];
    const matchedDocuments: UploadedDocument[] = [];
    const matchedLabels: string[] = [];
    const matchedTargets: ReturnType<typeof extractFilesFromSection>['fileTargets'] = [];

    extracted.filesToUpload.forEach((file, index) => {
        const matchIndex = remaining.findIndex(
            (document) => document.source_filename === file.name,
        );
        if (matchIndex === -1) return;

        matchedDocuments.push(remaining[matchIndex]);
        remaining.splice(matchIndex, 1);
        matchedLabels.push(extracted.fileLabels[index] || 'unknown_label');
        matchedTargets.push(extracted.fileTargets[index]);
    });

    return {
        documents: matchedDocuments,
        fileLabels: matchedLabels,
        fileTargets: matchedTargets,
    };
};

/**
 * Section Change edit_action values:
 * - NO_CHANGE: No changes made (omitted from payload)
 * - ADD: New record added (handled at widget level;
 *   only additional info such as IDs and required fields are added)
 * - DELETE: Record deleted (handled at registry widget level)
 * - UPDATE: Existing record updated (handled at registry widget level)
 */
export function normalizeEditActions(
    records: any[],
    linkInternalRecordId = "",
    document_id?: string,
) {
    if (!Array.isArray(records)) return [];

    return records
        .map((record) => {
            const result = { ...record };

            if (result.edit_action === undefined) {
                result.edit_action = "NO_CHANGE";
            }

            if (result.edit_action === "ADD") {
                result.link_internal_record_id =
                    result.link_internal_record_id || linkInternalRecordId;
                result.internal_record_id = "";
            }
            
            if (document_id) {
                result.record_image_document_id = document_id;
            }

            return result;
        })
        .filter((record) => record.edit_action !== "NO_CHANGE");
}


export function intakeNormalisedRecords(
    records: any[],
    InternalRecordId?: string,
    listRecordIds?: string[],
) {
    if (!Array.isArray(records)) return [];

    return records.map((record, index) => {
        const result = { ...record };

        const existingId = listRecordIds?.[index] || InternalRecordId;

        if (result.edit_action == null) {
            if (existingId) {
                result.edit_action = "UPDATE";
                result.internal_record_id = existingId;
            } else {
                result.edit_action = "ADD";
                result.internal_record_id = "";
            }
            if (result.link_internal_record_id == null) {
                result.link_internal_record_id = "";
            }
        } else if (!result.internal_record_id && existingId) {
            result.internal_record_id = existingId;
            result.edit_action = "UPDATE";
        }

        return result;
    });
}
