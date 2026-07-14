import type { RegisterFlattenedRecord } from "@/features/register/types";

type RecordDocument = {
    label?: string;
    presigned_url?: string;
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

export function mapRecordDocuments(documents: unknown): Record<string, string> {
    if (!Array.isArray(documents)) return {};

    return Object.fromEntries(
        (documents as RecordDocument[])
            .filter((doc) => !!doc?.label && !!doc?.presigned_url)
            .map(({ label, presigned_url }) => [
                toSnakeCase(label as string),
                presigned_url as string,
            ])
    );
}

export function withMappedDocuments(
    records: RegisterFlattenedRecord[]
): RegisterFlattenedRecord[] {
    return records.map((record) => ({
        ...record,
        documents: mapRecordDocuments(record.documents),
    }));
}

export function buildSectionDataMap(
    sectionRegisterId: string,
    records: RegisterFlattenedRecord[] | undefined | null,
    isList: boolean
): SectionDataMap | undefined {
    if (!records?.length) return undefined;

    const mapped = withMappedDocuments(records);
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
): SectionDataMap | undefined {
    if (!sections?.length) return undefined;

    const map: SectionDataMap = {};

    for (const section of sections) {
        if (!section.records?.length) continue;

        const mapped = withMappedDocuments(section.records);
        map[section.section_register_id] = section.is_list
            ? { records: mapped }
            : mapped[0];
    }

    return Object.keys(map).length > 0 ? map : undefined;
}
