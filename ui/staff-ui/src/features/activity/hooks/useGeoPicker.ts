"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchGeoLevels, fetchGeoValues, levelChain, resolveGeoCodes, type GeoLevel, type GeoLevelValue } from "../utils/masterDataGeo";

export interface GeoPickerState {
    /** The target level this state was built for (see useGeoPicker). */
    target: string;
    status: "ready" | "error";
    /** Levels from the root down to the target level. */
    chain: GeoLevel[];
    /** Per level: its units under the selected parent; null until the parent is chosen or while loading. */
    options: (GeoLevelValue[] | null)[];
    /** Per level: the selected code, "" when none. */
    selected: string[];
    /** A stored code that could not be found in Master Data. */
    unresolved?: string;
    error?: string;
}

const lastOf = (codes: string[]) => codes[codes.length - 1] ?? "";

/**
 * Loads each level's units from `from` down, under the selected parents, and
 * picks a level's only unit for the user (levels above the target only).
 */
async function loadOptions(chain: GeoLevel[], selected: string[], options: (GeoLevelValue[] | null)[], from: number) {
    const codes = [...selected];
    const loaded = [...options];
    for (let i = from; i < chain.length; i++) {
        const parent = i === 0 ? "" : codes[i - 1];
        if (i > 0 && !parent) {
            loaded[i] = null;
            continue;
        }
        const units = await fetchGeoValues(chain[i].level_id, parent);
        loaded[i] = units;
        if (!codes[i] && units.length === 1 && i < chain.length - 1) codes[i] = units[0].level_value_id;
    }
    return { selected: codes, options: loaded };
}

async function build(target: string, chain: GeoLevel[], value: string | undefined): Promise<GeoPickerState> {
    let selected = chain.map(() => "");
    let unresolved: string | undefined;
    if (value) {
        const codes = await resolveGeoCodes(chain, value);
        if (codes) selected = codes;
        else unresolved = value;
    }
    const loaded = await loadOptions(chain, selected, chain.map(() => null), 0);
    return { target, status: "ready", chain, ...loaded, unresolved };
}

/**
 * A cascading Master Data location picker's state: one level per select from
 * the root down to `level` (a level mnemonic such as "woreda"; the lowest level
 * when not given). `value` is the target level's code; `onChange` receives the
 * code once the target level is chosen, undefined while the selection is incomplete.
 * A pre-filled code is shown by resolving its ancestors.
 */
export function useGeoPicker(level: string | undefined, value: string | undefined, onChange: (code: string | undefined) => void) {
    const target = level ?? "";
    const [state, setState] = useState<GeoPickerState | null>(null);
    const generation = useRef(0);
    const current = state && state.target === target ? state : null;

    // (Re)build when the target level changes or the value changes from outside (pre-fill, reset).
    useEffect(() => {
        if (current?.status === "error") return;
        if (current) {
            const selectedCode = lastOf(current.selected);
            if ((value ?? "") === selectedCode) return;
            if (!value && !selectedCode) return; // the user is part-way through choosing
            if (value && value === current.unresolved) return;
        }
        const run = ++generation.current;
        const chainFrom = current?.chain.length ? Promise.resolve(current.chain) : fetchGeoLevels().then((levels) => levelChain(levels, level));
        chainFrom
            .then((chain) => {
                if (!chain.length) throw new Error(level ? `No "${level}" level in Master Data` : "No geography levels in Master Data");
                return build(target, chain, value);
            })
            .then((next) => { if (run === generation.current) setState(next); })
            .catch((error: unknown) => {
                if (run !== generation.current) return;
                setState({
                    target, status: "error", chain: [], options: [], selected: [],
                    error: error instanceof Error ? error.message : String(error),
                });
            });
    }, [current, level, target, value]);

    const select = useCallback((index: number, code: string) => {
        if (!current || current.status !== "ready") return;
        const selected = current.selected.map((c, i) => (i < index ? c : i === index ? code : ""));
        const options = current.options.map((o, i) => (i <= index ? o : null));
        const run = ++generation.current;
        setState({ ...current, selected, options, unresolved: undefined });
        const isTarget = index === current.chain.length - 1;
        const nextValue = isTarget && code ? code : undefined;
        if ((value ?? "") !== (nextValue ?? "")) onChange(nextValue);
        if (isTarget || !code) return;
        loadOptions(current.chain, selected, options, index + 1)
            .then((loaded) => {
                if (run === generation.current) setState((s) => (s ? { ...s, ...loaded } : s));
            })
            .catch((error: unknown) => {
                if (run === generation.current) {
                    setState((s) => (s ? { ...s, error: error instanceof Error ? error.message : String(error) } : s));
                }
            });
    }, [current, onChange, value]);

    return { state: current, loading: !current, select };
}
