import type { ActivityType, JsonValue } from "../types";

const FILE_LIKE = /photo|document/i;

/**
 * The part of an earlier payload worth carrying into a new entry of the same
 * type: every field still in the form, except dates (they describe the earlier
 * event) and photos or documents (they must be captured again).
 */
export function prefillPayload(type: ActivityType, payload: Record<string, JsonValue>): Record<string, JsonValue> {
    const properties = type.payload_schema?.properties;
    const ethiopian = new Set(type.ethiopian_date_fields ?? []);
    return Object.fromEntries(
        Object.entries(payload ?? {}).filter(([field, value]) => {
            if (value === null || value === undefined || value === "") return false;
            if (properties && !properties[field]) return false;
            const format = properties?.[field]?.format;
            if (format === "date" || format === "date-time") return false;
            if (field.endsWith("_ec") || ethiopian.has(field)) return false;
            return !FILE_LIKE.test(field);
        }),
    );
}
