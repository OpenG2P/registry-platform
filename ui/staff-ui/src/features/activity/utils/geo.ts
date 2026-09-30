import type { ActivityType, GeoDimensions, GeoUnit, JsonValue, ReferenceRule } from "../types";

/** The conventional payload field for a location when no GEO rule is marked `location: true`. */
export const LOCATION_FIELD = "geo_lowest_level_value_id";

/** Levels left out of a displayed location: the whole deployment is in one country. */
const OMITTED_LEVELS = new Set(["country"]);

const isGeoUnit = (value: JsonValue | undefined): value is { code: string; name: string } =>
    !!value && typeof value === "object" && !Array.isArray(value)
    && typeof value.code === "string" && typeof value.name === "string";

/**
 * Geo dimensions from an untyped value (a projection row's `geo_dimensions`),
 * or null when it is missing, empty or not in the {level: {code, name}} shape.
 */
export function asGeoDimensions(value: JsonValue | GeoDimensions | null | undefined): GeoDimensions | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const entries = Object.entries(value as Record<string, JsonValue>).filter(
        (entry): entry is [string, { code: string; name: string }] => isGeoUnit(entry[1]),
    );
    return entries.length ? Object.fromEntries(entries.map(([level, unit]) => [level, { code: unit.code, name: unit.name }])) : null;
}

/** The displayed levels, lowest first (country left out when there are lower levels). */
function displayedUnits(geo: GeoDimensions | null | undefined): [string, GeoUnit][] {
    const entries = Object.entries(asGeoDimensions(geo) ?? {});
    const shown = entries.filter(([level]) => !OMITTED_LEVELS.has(level.toLowerCase()));
    return (shown.length ? shown : entries).reverse();
}

/** "Sheno town, North Shewa (OR), Oromia": names, lowest level first; the fallback (or "—") when unknown. */
export function formatLocation(geo: GeoDimensions | null | undefined, fallback?: string | null): string {
    const units = displayedUnits(geo);
    return units.length ? units.map(([, unit]) => unit.name).join(", ") : fallback || "—";
}

/** The lowest level's name (e.g. the woreda); the fallback (or "—") when unknown. */
export function lowestLocation(geo: GeoDimensions | null | undefined, fallback?: string | null): string {
    const [lowest] = displayedUnits(geo);
    return lowest ? lowest[1].name : fallback || "—";
}

/** Every level with its code, top-down, for a tooltip: "Region: Oromia (ET04) › Zone: …". */
export function locationTooltip(geo: GeoDimensions | null | undefined): string | undefined {
    const entries = Object.entries(asGeoDimensions(geo) ?? {});
    if (!entries.length) return undefined;
    return entries.map(([level, unit]) => `${levelLabel(level)}: ${unit.name} (${unit.code})`).join(" › ");
}

/** "woreda" → "Woreda", "sub_city" → "Sub city". */
export function levelLabel(level: string): string {
    const text = level.replace(/[_-]+/g, " ").trim();
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/** True when a reference rule names a Master Data geography value. */
export function isGeoRule(rule: ReferenceRule | undefined | null): rule is ReferenceRule {
    return !!rule && String(rule.kind).toUpperCase() === "GEO";
}

/** The payload field that holds the activity's location: the GEO rule marked `location`, else the conventional field. */
export function locationField(type: ActivityType | undefined): string {
    const marked = Object.entries(type?.reference_rules ?? {}).find(([, rule]) => isGeoRule(rule) && rule.location);
    return marked ? marked[0] : LOCATION_FIELD;
}

/**
 * The activity's location for display: its geo dimensions when known, else
 * the payload's location value (its resolved label if the API returned one, else the code).
 */
export function activityLocationFallback(
    type: ActivityType | undefined,
    payload: Record<string, JsonValue> | undefined,
    display?: Record<string, JsonValue>,
): string | undefined {
    const field = locationField(type);
    const value = payload?.[field];
    if (value === undefined || value === null || value === "") return undefined;
    const label = display?.[field];
    return typeof label === "string" && label ? label : String(value);
}

/** One column of an indicator table: a group_by key, or a geo level shown by name with its code alongside. */
export interface IndicatorColumn {
    key: string;
    header: string;
    /** For a geo level: the row key holding the unit's name (the column's key holds its code). */
    nameKey?: string;
}

/**
 * An indicator result's columns: `geo:<level>` with `geo:<level>_name` become
 * one column headed with the level (e.g. "Region"); other keys are unchanged.
 */
export function indicatorColumns(groupBy: string[], humanize: (key: string) => string): IndicatorColumn[] {
    const keys = new Set(groupBy);
    return groupBy.flatMap((key): IndicatorColumn[] => {
        if (key.startsWith("geo:") && key.endsWith("_name") && keys.has(key.slice(0, -"_name".length))) return [];
        if (key.startsWith("geo:") && keys.has(`${key}_name`)) {
            return [{ key, header: levelLabel(key.slice("geo:".length)), nameKey: `${key}_name` }];
        }
        return [{ key, header: humanize(key) }];
    });
}
