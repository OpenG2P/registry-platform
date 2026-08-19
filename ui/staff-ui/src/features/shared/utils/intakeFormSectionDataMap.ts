import type { RegisterFlattenedRecord } from "@/features/register/types";
import type { SectionPayload } from "@/features/intake-form/types";
import {
    type SectionDataEntry,
    type SectionDataMap,
    mapRecordDocuments,
    withMappedDocuments,
} from "./sectionDataMap";

function isListSectionEntry(
    entry: SectionDataEntry
): entry is { records: RegisterFlattenedRecord[] } {
    return (
        typeof entry === "object" &&
        entry !== null &&
        "records" in entry &&
        Array.isArray((entry as { records: unknown }).records)
    );
}

function withDocumentsMap(
    records: RegisterFlattenedRecord[],
    documentsMap: Record<string, string>
): RegisterFlattenedRecord[] {
    return withMappedDocuments(records).map((record) => ({
        ...record,
        documents: {
            ...((record.documents as Record<string, string> | undefined) ?? {}),
            ...documentsMap,
        },
    }));
}

/**
 * Intake submissions can return multiple section payloads for the same section_register_id.
 * List sections append records; non-list sections merge field objects.
 */
/** Prefer the register section_id; crops still use the intake section_id or child register. */
export function pickSubmissionSectionPayload(
    payloads: SectionPayload[] | undefined | null,
    registerSectionId: string,
    sectionRegisterId?: string | null,
): SectionPayload | undefined {
    if (!payloads?.length || !registerSectionId) return undefined;
    return (
        payloads.find((payload) => payload.section_id === registerSectionId) ||
        payloads.find((payload) => payload.section_id === sectionRegisterId) ||
        payloads.find(
            (payload) =>
                !!sectionRegisterId && payload.section_register_id === sectionRegisterId,
        ) ||
        undefined
    );
}

export function buildIntakeSectionsDataMap(
    sections: SectionPayload[] | undefined | null,
): SectionDataMap {
    if (!sections?.length) return {};

    const map: SectionDataMap = {};

    for (const section of sections) {
        if (!section.records?.length) continue;
        const documentsMap = mapRecordDocuments(section.documents ?? []);


        const mapped = withDocumentsMap(section.records, documentsMap);
        const existing = map[section.section_register_id];

        if (section.is_list === true) {
            if (existing && isListSectionEntry(existing)) {
                existing.records = [...existing.records, ...mapped];
            } else {
                map[section.section_register_id] = { records: [...mapped] };
            }
        } else {
            if (existing && !isListSectionEntry(existing)) {
                map[section.section_register_id] = {
                    ...existing,
                    ...mapped[0],
                    documents: {
                        ...((existing.documents as Record<string, string> | undefined) ?? {}),
                        ...((mapped[0].documents as Record<string, string> | undefined) ?? {}),
                    },
                };
            } else if (!existing) {
                map[section.section_register_id] = { ...mapped[0] };
            }
        }
    }

    return map;
}
