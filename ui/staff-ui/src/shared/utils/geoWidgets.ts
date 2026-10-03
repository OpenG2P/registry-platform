/**
 * Register forms get their geography levels from Master Data at runtime.
 *
 * An extension's section UI schema only marks a field as a location; it does not
 * name the country's levels or say how many there are. This fills in what the
 * form needs before it is rendered:
 *
 *  - `"widget": "geo-hierarchy"` with no geo data source gets the default one: its
 *    level dropdowns are built from Master Data's levels (`geo-levels`, i.e. MDS
 *    `/catalogue/get_geo_levels`) and filled from `geo-level-values`.
 *  - A widget carrying a `widget-geo-config` that does not pin a level (e.g.
 *    `"widget-geo-config": {}`) is a location marker: it becomes such a
 *    `geo-hierarchy` widget, storing the record's `geo_lowest_level_value_id` and
 *    `geo_code_hierarchy_json`.
 *
 * Explicit configuration still wins: a geo-hierarchy widget that names its own
 * endpoints, and legacy per-level `select` widgets whose `widget-geo-config`
 * pins a `level`, are left exactly as they are.
 */

export const GEO_LEVELS_ENDPOINT = "geo-levels";
export const GEO_VALUES_ENDPOINT = "geo-level-values";

export const DEFAULT_GEO_DATA_SOURCE = Object.freeze({
    type: "api" as const,
    method: "POST" as const,
    service: "master-data",
    levelsEndpoint: GEO_LEVELS_ENDPOINT,
    valuesEndpoint: GEO_VALUES_ENDPOINT,
});

const LOWEST_FIELD = "geo_lowest_level_value_id";
const HIERARCHY_FIELD = "geo_code_hierarchy_json";

type Json = Record<string, unknown>;

const isRecord = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

function hasGeoDataSource(source: unknown): boolean {
    return isRecord(source) && typeof source.levelsEndpoint === "string" && typeof source.valuesEndpoint === "string";
}

/** True when a `widget-geo-config` names the level the widget is fixed to (the legacy form). */
export function pinsGeoLevel(config: unknown): boolean {
    return isRecord(config) && typeof config.level === "string" && config.level.trim() !== "";
}

/** `<register>.geo_code_hierarchy_json` or `<register>.geo_lowest_level_value_id` -> both paths. */
function locationDataPath(path: unknown): unknown {
    if (typeof path !== "string") return path;
    for (const field of [LOWEST_FIELD, HIERARCHY_FIELD]) {
        if (path === field || path.endsWith(`.${field}`)) {
            const base = path.slice(0, path.length - field.length);
            return { value: `${base}${LOWEST_FIELD}`, hierarchy: `${base}${HIERARCHY_FIELD}` };
        }
    }
    return path;
}

function resolveWidget(widget: Json): Json {
    if (widget.widget === "geo-hierarchy") {
        if (hasGeoDataSource(widget["widget-data-source"])) return widget;
        const given = isRecord(widget["widget-data-source"]) ? widget["widget-data-source"] : {};
        // Keep whatever the schema did say (e.g. its service); fill in the rest.
        return { ...widget, "widget-data-source": { ...DEFAULT_GEO_DATA_SOURCE, ...given } };
    }
    if ("widget-geo-config" in widget && !pinsGeoLevel(widget["widget-geo-config"])) {
        const resolved: Json = {
            ...widget,
            widget: "geo-hierarchy",
            "widget-data-path": locationDataPath(widget["widget-data-path"]),
            "widget-data-source": { ...DEFAULT_GEO_DATA_SOURCE },
        };
        delete resolved["widget-geo-config"];
        return resolved;
    }
    return widget;
}

function walk(node: unknown): unknown {
    if (Array.isArray(node)) {
        let changed = false;
        const next = node.map((item) => {
            const out = walk(item);
            if (out !== item) changed = true;
            return out;
        });
        return changed ? next : node;
    }
    if (!isRecord(node)) return node;
    let changed = false;
    const next: Json = {};
    for (const [key, value] of Object.entries(node)) {
        const out = walk(value);
        if (out !== value) changed = true;
        next[key] = out;
    }
    const current = changed ? next : node;
    return "widget-id" in current ? resolveWidget(current) : current;
}

/**
 * The section UI schema with its location widgets resolved for runtime levels.
 * Returns the same object when nothing needed filling in.
 */
export function withRuntimeGeoLevels<T>(schema: T): T {
    return walk(schema) as T;
}
