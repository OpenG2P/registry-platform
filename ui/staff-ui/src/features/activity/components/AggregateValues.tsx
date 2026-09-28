import type { JsonValue } from "../types";
import { displayValue, humanize } from "../utils/labels";

/** An aggregate's values as compact "label: value" pairs. */
export default function AggregateValues({ value }: { value: Record<string, JsonValue> }) {
    const entries = Object.entries(value ?? {});
    if (!entries.length) return <span className="opacity-60">—</span>;
    return (
        <span className="flex flex-wrap gap-x-4 gap-y-1">
            {entries.map(([key, v]) => (
                <span key={key} className="whitespace-nowrap">
                    <span className="opacity-70">{humanize(key)}:</span>{" "}
                    <span className="tabular-nums">{typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : displayValue(undefined, key, v)}</span>
                </span>
            ))}
        </span>
    );
}
