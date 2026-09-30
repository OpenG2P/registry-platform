"use client";

import { useGeoPicker } from "../hooks/useGeoPicker";
import { levelLabel } from "../utils/geo";

interface Props {
    id: string;
    /** The level the stored code must be at (e.g. "woreda"); the lowest level when not given. */
    level?: string;
    value: string | undefined;
    onChange: (code: string | undefined) => void;
    disabled?: boolean;
    required?: boolean;
    className: string;
}

/**
 * A Master Data location as one select per level, each filtered by the level
 * above; stores the code at the target level and shows names. Levels at the top
 * with a single unit (the country) are chosen automatically and not shown.
 * Falls back to a plain code box when Master Data cannot be read.
 */
export default function GeoPicker({ id, level, value, onChange, disabled, required, className }: Props) {
    const { state, loading, select } = useGeoPicker(level, value, onChange);

    if (loading) {
        return <select id={id} className={className} disabled aria-busy="true"><option>Loading locations…</option></select>;
    }

    if (!state || state.status === "error") {
        return (
            <div className="flex flex-col gap-1">
                <input
                    id={id}
                    className={className}
                    disabled={disabled}
                    required={required}
                    placeholder={level ? `${levelLabel(level)} code` : "Location code"}
                    value={value ?? ""}
                    onChange={(e) => onChange(e.target.value.trim() || undefined)}
                />
                <span className="text-xs opacity-70">Locations could not be loaded{state?.error ? ` (${state.error})` : ""}; enter the code.</span>
            </div>
        );
    }

    const last = state.chain.length - 1;
    // Leading levels with a single unit (e.g. the country) are pre-selected and hidden.
    let firstShown = 0;
    while (firstShown < last && state.options[firstShown]?.length === 1 && state.selected[firstShown]) firstShown++;

    return (
        <div className="flex flex-col gap-1">
            <div role="group" aria-label={level ? `${levelLabel(level)} and the levels above it` : "Location"} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {state.chain.map((geoLevel, index) => {
                    if (index < firstShown) return null;
                    const options = state.options[index];
                    const label = levelLabel(geoLevel.level_mnemonic);
                    const waiting = options === null && index > 0 && !!state.selected[index - 1];
                    return (
                        <label key={geoLevel.level_id} className="flex flex-col gap-0.5 text-xs">
                            <span className="opacity-70">{label}</span>
                            <select
                                id={index === firstShown ? id : `${id}-${geoLevel.level_mnemonic}`}
                                aria-label={label}
                                className={className}
                                disabled={disabled || options === null}
                                required={required}
                                value={state.selected[index]}
                                onChange={(e) => select(index, e.target.value)}
                            >
                                <option value="">{waiting ? "Loading…" : options === null ? `Choose ${levelLabel(state.chain[index - 1]?.level_mnemonic ?? "").toLowerCase()} first` : "Select…"}</option>
                                {(options ?? []).map((unit) => (
                                    <option key={unit.level_value_id} value={unit.level_value_id}>{unit.level_value_mnemonic}</option>
                                ))}
                            </select>
                        </label>
                    );
                })}
            </div>
            {state.unresolved && (
                <span className="text-xs text-toast-failed">
                    &ldquo;{state.unresolved}&rdquo; was not found in Master Data{level ? ` as a ${level}` : ""}; choose the location again.
                </span>
            )}
            {state.error && <span className="text-xs text-toast-failed">{state.error}</span>}
        </div>
    );
}
