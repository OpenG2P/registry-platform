import type { RegisterFlattenedRecord } from "@/features/register/types";
import { UploadedDocument } from "../types";

type RecordDocument = {
    document_id?: string;
    label?: string;
    presigned_url?: string;
    source_filename?: string;
};

export type SectionDataEntry =
    | RegisterFlattenedRecord
    | { records: RegisterFlattenedRecord[] };

export type SectionDataMap = Record<string, SectionDataEntry>;

export const toSnakeCase = (value: string) =>
    value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");


export function mapRecordDocuments(documents: unknown): Record<string, unknown> {
  if (!Array.isArray(documents)) return {};

  return Object.fromEntries(
    (documents as RecordDocument[])
      .filter((doc) => !!doc?.label && !!doc?.document_id && !!doc?.presigned_url)
      .map((doc) => [
        toSnakeCase(doc.label as string),
        {
          label: doc.label,
          document_id: doc.document_id,
          presigned_url: doc.presigned_url,
          source_filename: doc.source_filename,
        },
      ])
  );
}

export function withMappedDocuments(
    records: RegisterFlattenedRecord[],
    documents?: UploadedDocument[],
): RegisterFlattenedRecord[] {
    return records.map((record) => {
        const source = Array.isArray(documents)
            ? documents
            : (record as { documents?: unknown }).documents;
        return {
            ...record,
            documents: mapRecordDocuments(source),
        };
    });
}

export function buildSectionDataMap(
    sectionRegisterId: string,
    records: RegisterFlattenedRecord[] | undefined | null,
    isList: boolean,
    documents?: UploadedDocument[],
): SectionDataMap | undefined {
    if (!records?.length) return undefined;

    const mapped = withMappedDocuments(records, documents);
    return {
        [sectionRegisterId]: isList ? { records: mapped } : mapped[0],
    };
}

export function buildSectionsDataMap(
    sections: Array<{
        section_register_id: string;
        records?: RegisterFlattenedRecord[];
        is_list?: boolean;
    }>
): SectionDataMap {
    if (!sections?.length) return {};

    const map: SectionDataMap = {};

    for (const section of sections) {
        if (!section.records?.length) continue;

        // sections[] → records[] → each record.documents
        const mapped = withMappedDocuments(section.records);
        map[section.section_register_id] = section.is_list
            ? { records: mapped }
            : mapped[0];
    }

    return map;
}
