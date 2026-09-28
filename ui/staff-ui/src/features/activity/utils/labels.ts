import type { ActivityType, JsonValue } from "../types";

/** Human label for a payload field from the type's JSON Schema, falling back to the field name. */
export function fieldLabel(type: ActivityType | undefined, field: string): string {
    const title = type?.payload_schema?.properties?.[field]?.title;
    return title || field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Display a payload value: code-list label if known, then the reference label, then the raw value. */
export function displayValue(type: ActivityType | undefined, field: string, value: JsonValue | undefined, display?: Record<string, JsonValue>): string {
    if (value === null || value === undefined || value === "") return "—";
    const options = type?.reference_options?.[field];
    const label = (code: JsonValue) => options?.find((o) => o.code === code)?.label ?? String(display?.[field] ?? code);
    if (Array.isArray(value)) {
        if (value.length && value[0] !== null && typeof value[0] === "object") {
            return value.map((row) => Object.values(row as Record<string, JsonValue>).join(" ")).join("; ");
        }
        return value.map(label).join(", ");
    }
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "object") return JSON.stringify(value);
    return label(value);
}

export function humanize(code?: string | null): string {
    if (!code) return "—";
    return code.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function formatDateTime(iso?: string | null): string {
    if (!iso) return "—";
    const d = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`);
    return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso?: string | null): string {
    if (!iso) return "—";
    return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

/** "CropSown" → "Crop Sown", "crop_sown" → "Crop Sown". */
export function humanizeMnemonic(mnemonic: string): string {
    return mnemonic
        .replace(/[_-]+/g, " ")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim();
}

/** Short name of an activity register: its register_subject, else the humanised mnemonic. */
export function registerLabel(register: { register_mnemonic: string; register_subject?: string | null }): string {
    return register.register_subject || humanizeMnemonic(register.register_mnemonic);
}

/** URL of an activity register page (lower-case mnemonic). */
export function activityRegisterPath(mnemonic: string): string {
    return `/activity/${mnemonic.toLowerCase()}`;
}
