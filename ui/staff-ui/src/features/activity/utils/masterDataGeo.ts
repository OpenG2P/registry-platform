"use client";

import { dataSourceRequestHandler } from "@/shared/services";

/** A Master Data geography level, e.g. {level_id: "l3", level_mnemonic: "zone", parent_level_id: "l2"}. */
export interface GeoLevel {
    level_id: string;
    level_mnemonic: string;
    parent_level_id: string | null;
}

/** A unit at a level; level_value_id is its code (e.g. "ET040611"), level_value_mnemonic its name. */
export interface GeoLevelValue {
    level_value_id: string;
    level_id: string;
    level_value_mnemonic: string;
    parent_level_value_id: string | null;
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v !== "" && v !== "NULL" ? v : null);

function asArray(response: unknown): unknown[] {
    if (Array.isArray(response)) return response;
    if (isRecord(response) && Array.isArray(response.response_payload)) return response.response_payload;
    return [];
}

function toLevels(response: unknown): GeoLevel[] {
    return asArray(response).flatMap((item) => {
        if (!isRecord(item) || !str(item.level_id)) return [];
        return [{ level_id: String(item.level_id), level_mnemonic: String(item.level_mnemonic ?? item.level_id), parent_level_id: str(item.parent_level_id) }];
    });
}

function toValues(response: unknown): GeoLevelValue[] {
    return asArray(response).flatMap((item) => {
        if (!isRecord(item) || !str(item.level_value_id)) return [];
        return [{
            level_value_id: String(item.level_value_id),
            level_id: String(item.level_id ?? ""),
            level_value_mnemonic: String(item.level_value_mnemonic ?? item.level_value_id),
            parent_level_value_id: str(item.parent_level_value_id),
        }];
    });
}

// Shared across pickers on a page: levels and values change rarely.
let levelsRequest: Promise<GeoLevel[]> | null = null;
const valuesRequests = new Map<string, Promise<GeoLevelValue[]>>();

/** Every geography level (POST /api/master-data/get-all-g2p-geo-levels). */
export function fetchGeoLevels(): Promise<GeoLevel[]> {
    if (!levelsRequest) {
        levelsRequest = dataSourceRequestHandler("master-data", "get-all-g2p-geo-levels", "POST", { current_page: 1, page_size: 100 })
            .then(toLevels)
            .catch((error: unknown) => {
                levelsRequest = null;
                throw error;
            });
    }
    return levelsRequest;
}

/**
 * Units at a level under a parent unit (POST /api/master-data/geo-level-values).
 * With no parent: the root's units for the root level, every unit for a lower level.
 */
export function fetchGeoValues(levelId: string, parentValueId = ""): Promise<GeoLevelValue[]> {
    const key = `${levelId}|${parentValueId}`;
    let request = valuesRequests.get(key);
    if (!request) {
        request = dataSourceRequestHandler("master-data", "geo-level-values", "POST", {
            current_page: 1, page_size: 1000, level_id: levelId, parent_level_value_id: parentValueId,
        })
            .then((response: unknown) => toValues(response).sort((a, b) => a.level_value_mnemonic.localeCompare(b.level_value_mnemonic)))
            .catch((error: unknown) => {
                valuesRequests.delete(key);
                throw error;
            });
        valuesRequests.set(key, request);
    }
    return request;
}

/**
 * The levels from the root down to `target` (a level mnemonic or id); with no
 * target, down to the lowest level (following single children). Empty when the target is unknown.
 */
export function levelChain(levels: GeoLevel[], target?: string): GeoLevel[] {
    const byId = new Map(levels.map((l) => [l.level_id, l]));
    let leaf: GeoLevel | undefined;
    if (target) {
        const wanted = target.toLowerCase();
        leaf = levels.find((l) => l.level_mnemonic.toLowerCase() === wanted || l.level_id === target);
        if (!leaf) return [];
    } else {
        leaf = levels.find((l) => !l.parent_level_id || !byId.has(l.parent_level_id));
        for (let i = 0; leaf && i < levels.length; i++) {
            const children = levels.filter((l) => l.parent_level_id === leaf?.level_id);
            if (children.length !== 1) break;
            leaf = children[0];
        }
    }
    const chain: GeoLevel[] = [];
    for (let level = leaf; level && chain.length <= levels.length; level = level.parent_level_id ? byId.get(level.parent_level_id) : undefined) {
        chain.unshift(level);
    }
    return chain;
}

/**
 * The codes from the root down to `code`, one per level of the chain, found by
 * looking the unit up at its level and walking its parents. Null if not found.
 */
export async function resolveGeoCodes(chain: GeoLevel[], code: string): Promise<string[] | null> {
    const codes = chain.map(() => "");
    let current: string | null = code;
    for (let i = chain.length - 1; i >= 0 && current; i--) {
        const units = await fetchGeoValues(chain[i].level_id);
        const unit = units.find((u) => u.level_value_id === current);
        if (!unit) return null;
        codes[i] = unit.level_value_id;
        current = unit.parent_level_value_id;
    }
    return codes[codes.length - 1] === code ? codes : null;
}
