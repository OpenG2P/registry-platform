"use client";

import type { ActivityType, JsonSchema, JsonValue, ReferenceRule } from "../types";
import { isGeoRule } from "../utils/geo";
import EthiopianDateInput from "./EthiopianDateInput";
import GeoPicker from "./GeoPicker";

interface Props {
    type: ActivityType;
    value: Record<string, JsonValue>;
    onChange: (value: Record<string, JsonValue>) => void;
    /** Fields fixed by the context (e.g. plot, season, crop) — shown read-only. */
    lockedFields?: string[];
    errors?: Record<string, string>;
}

const inputClass =
    "w-full border border-secondary-second rounded-md px-3 py-2 bg-neutral-second text-sm focus:outline-none focus:border-primary-first";

type Row = Record<string, JsonValue>;

const asText = (value: JsonValue | undefined): string =>
    value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);

function isType(schema: JsonSchema, name: string) {
    return schema.type === name || (Array.isArray(schema.type) && schema.type.includes(name));
}

/**
 * Renders an activity type's payload JSON Schema as a form. Code-list fields
 * (reference rules of kind ATTRIBUTE) become selects using the options the
 * API returns with the type; location fields (reference rules of kind GEO)
 * become a cascading Master Data picker; date fields listed in
 * ethiopian_date_fields get an Ethiopian-calendar picker.
 */
export default function SchemaForm({ type, value, onChange, lockedFields = [], errors = {} }: Props) {
    const schema = type.payload_schema ?? { properties: {} };
    const required = new Set(schema.required ?? []);
    const properties = Object.entries(schema.properties ?? {});

    const set = (field: string, fieldValue: JsonValue | undefined) => {
        const next = { ...value };
        if (fieldValue === undefined || fieldValue === "" || (Array.isArray(fieldValue) && fieldValue.length === 0)) {
            delete next[field];
        } else {
            next[field] = fieldValue;
        }
        onChange(next);
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {properties.map(([field, fieldSchema]) => {
                const options = type.reference_options?.[field];
                const locked = lockedFields.includes(field);
                const label = fieldSchema.title || field;
                const rule = type.reference_rules?.[field];
                const geoRule = isGeoRule(rule) && !isType(fieldSchema, "array") ? rule : undefined;
                const wide = !!geoRule || (isType(fieldSchema, "array") && fieldSchema.items && isType(fieldSchema.items, "object"));
                return (
                    <div key={field} className={`flex flex-col gap-1 ${wide ? "md:col-span-2" : ""}`}>
                        <label htmlFor={`f-${field}`} className="text-sm font-medium">
                            {label}
                            {required.has(field) && <span className="text-toast-failed"> *</span>}
                        </label>
                        <Field
                            id={`f-${field}`}
                            field={field}
                            schema={fieldSchema}
                            options={options}
                            ethiopian={(type.ethiopian_date_fields ?? []).includes(field)}
                            value={value[field]}
                            disabled={locked}
                            required={required.has(field)}
                            onChange={(v) => set(field, v)}
                            nestedOptions={type.reference_options}
                            geoRule={geoRule}
                            referenceRules={type.reference_rules}
                        />
                        {errors[field] && <span className="text-xs text-toast-failed">{errors[field]}</span>}
                    </div>
                );
            })}
        </div>
    );
}

interface FieldProps {
    id: string;
    field: string;
    schema: JsonSchema;
    options?: { code: string; label: string }[];
    nestedOptions?: Record<string, { code: string; label: string }[]>;
    ethiopian: boolean;
    value: JsonValue | undefined;
    disabled?: boolean;
    required?: boolean;
    onChange: (value: JsonValue | undefined) => void;
    /** Set when the field is a Master Data location (a GEO reference rule). */
    geoRule?: ReferenceRule;
    /** The type's reference rules, for fields inside list rows ("list_field.row_field"). */
    referenceRules?: Record<string, ReferenceRule> | null;
}

function Field({ id, field, schema, options, nestedOptions, ethiopian, value, disabled, required, onChange, geoRule, referenceRules }: FieldProps) {
    const enumOptions = options ?? schema.enum?.map((v) => ({ code: String(v), label: String(v) }));

    if (geoRule) {
        return (
            <GeoPicker
                id={id}
                level={geoRule.level}
                value={value === null || value === undefined || value === "" ? undefined : asText(value)}
                onChange={onChange}
                disabled={disabled}
                required={required}
                className={inputClass}
            />
        );
    }

    if (isType(schema, "array") && schema.items) {
        if (isType(schema.items, "object")) {
            return (
                <ObjectList
                    id={id}
                    itemSchema={schema.items}
                    rows={Array.isArray(value) ? (value as Row[]) : []}
                    onChange={onChange}
                    disabled={disabled}
                    nestedOptions={nestedOptions}
                    referenceRules={referenceRules}
                    parentField={field}
                />
            );
        }
        const selected: string[] = Array.isArray(value) ? value.map(String) : [];
        if (enumOptions) {
            return (
                <div className="flex flex-wrap gap-2">
                    {enumOptions.map((o) => (
                        <label key={o.code} className="flex items-center gap-1 text-sm border border-secondary-second rounded-full px-3 py-1">
                            <input
                                type="checkbox"
                                disabled={disabled}
                                checked={selected.includes(o.code)}
                                onChange={(e) =>
                                    onChange(e.target.checked ? [...selected, o.code] : selected.filter((c) => c !== o.code))
                                }
                            />
                            {o.label}
                        </label>
                    ))}
                </div>
            );
        }
        return (
            <input
                id={id}
                className={inputClass}
                disabled={disabled}
                placeholder="Comma-separated"
                value={selected.join(", ")}
                onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
            />
        );
    }

    if (enumOptions) {
        return (
            <select id={id} className={inputClass} disabled={disabled} value={asText(value)} onChange={(e) => onChange(e.target.value || undefined)}>
                <option value="">Select…</option>
                {enumOptions.map((o) => (
                    <option key={o.code} value={o.code}>{o.label}</option>
                ))}
            </select>
        );
    }

    if (isType(schema, "boolean")) {
        return (
            <select
                id={id}
                className={inputClass}
                disabled={disabled}
                value={value === undefined ? "" : value ? "true" : "false"}
                onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value === "true")}
            >
                <option value="">—</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
            </select>
        );
    }

    if (isType(schema, "number") || isType(schema, "integer")) {
        return (
            <input
                id={id}
                type="number"
                step={isType(schema, "integer") ? 1 : "any"}
                min={schema.minimum ?? schema.exclusiveMinimum}
                max={schema.maximum}
                className={inputClass}
                disabled={disabled}
                value={asText(value)}
                onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") return onChange(undefined);
                    onChange(isType(schema, "integer") ? parseInt(raw, 10) : parseFloat(raw));
                }}
            />
        );
    }

    if (schema.format === "date") {
        return ethiopian ? (
            <EthiopianDateInput id={id} value={typeof value === "string" ? value : undefined} onChange={onChange} disabled={disabled} />
        ) : (
            <input id={id} type="date" className={inputClass} disabled={disabled} value={asText(value)} onChange={(e) => onChange(e.target.value || undefined)} />
        );
    }

    const long = (schema.maxLength ?? 0) > 200;
    return long ? (
        <textarea id={id} className={inputClass} rows={3} disabled={disabled} value={asText(value)} onChange={(e) => onChange(e.target.value)} />
    ) : (
        <input id={id} className={inputClass} disabled={disabled} value={asText(value)} pattern={schema.pattern} onChange={(e) => onChange(e.target.value)} />
    );
}

function ObjectList({
    id, itemSchema, rows, onChange, disabled, nestedOptions, referenceRules, parentField,
}: {
    id: string;
    itemSchema: JsonSchema;
    rows: Row[];
    onChange: (rows: Row[] | undefined) => void;
    disabled?: boolean;
    nestedOptions?: Record<string, { code: string; label: string }[]>;
    referenceRules?: Record<string, ReferenceRule> | null;
    parentField: string;
}) {
    const columns = Object.entries(itemSchema.properties ?? {});
    const requiredColumns = new Set(itemSchema.required ?? []);
    const geoRuleOf = (key: string, colSchema: JsonSchema) => {
        const rule = referenceRules?.[`${parentField}.${key}`];
        return isGeoRule(rule) && !isType(colSchema, "array") ? rule : undefined;
    };
    const update = (index: number, key: string, v: JsonValue | undefined) => {
        const next = rows.map((row, i) => {
            if (i !== index) return row;
            const updated: Row = { ...row };
            if (v === undefined) delete updated[key];
            else updated[key] = v;
            return updated;
        });
        onChange(next);
    };
    return (
        <div className="flex flex-col gap-2" id={id}>
            {rows.map((row, index) => (
                <div key={index} className="flex flex-wrap items-end gap-3 p-2 rounded-md bg-secondary-first">
                    {columns.map(([key, colSchema]) => {
                        const geoRule = geoRuleOf(key, colSchema);
                        return (
                            <div key={key} className={`flex flex-col gap-1 min-w-40 flex-1 ${geoRule ? "basis-full" : ""}`}>
                                <span className="text-xs">{colSchema.title || key}</span>
                                <Field
                                    id={`${id}-${index}-${key}`}
                                    field={key}
                                    schema={colSchema}
                                    options={nestedOptions?.[`${parentField}.${key}`]}
                                    ethiopian={false}
                                    value={row[key]}
                                    disabled={disabled}
                                    required={requiredColumns.has(key)}
                                    geoRule={geoRule}
                                    onChange={(v) => update(index, key, v)}
                                />
                            </div>
                        );
                    })}
                    {!disabled && (
                        <button type="button" className="text-sm text-toast-failed pb-2" onClick={() => onChange(rows.filter((_, i) => i !== index))}>
                            Remove
                        </button>
                    )}
                </div>
            ))}
            {!disabled && (
                <button type="button" className="self-start text-sm text-primary-first underline" onClick={() => onChange([...rows, {}])}>
                    + Add
                </button>
            )}
        </div>
    );
}
