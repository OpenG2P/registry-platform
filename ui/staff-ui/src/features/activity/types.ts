export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface ActivityRegister {
    register_id: string;
    register_mnemonic: string;
    /** Short display name, e.g. "Crop seasons"; register_description is the long sentence. */
    register_subject?: string | null;
    register_description?: string | null;
    master_register_id?: string | null;
    register_icon?: string | null;
    has_projection: boolean;
}

/** One administrative unit of a location, from Master Data (e.g. {code: "ET04", name: "Oromia"}). */
export interface GeoUnit {
    code: string;
    name: string;
}

/**
 * Where something happened, as named administrative levels from the top level
 * down, e.g. {country: {...}, region: {...}, zone: {...}, woreda: {...}}.
 */
export type GeoDimensions = Record<string, GeoUnit>;

/**
 * How a payload field is checked. kind GEO names a Master Data geography value:
 * `level` is the level it must be at, `location` marks it as the activity's location.
 */
export interface ReferenceRule {
    kind: string;
    mode?: string;
    temporary_prefix?: string;
    attribute?: string;
    level?: string;
    location?: boolean;
}

export interface CodeOption {
    code: string;
    label: string;
}

export interface JsonSchema {
    type?: string | string[];
    title?: string;
    description?: string;
    enum?: (string | number)[];
    format?: string;
    minimum?: number;
    maximum?: number;
    exclusiveMinimum?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    required?: string[];
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
}

export interface ActivityType {
    activity_type_id: string;
    register_id: string;
    activity_type: string;
    display_name: string;
    description?: string | null;
    display_order?: number | null;
    payload_schema?: JsonSchema | null;
    requires_context: boolean;
    is_repeatable: boolean;
    requires_prior_types?: string[] | null;
    sequence_enforcement: string;
    due_rule?: { after_type: string; min_days?: number; max_days?: number } | null;
    max_backdate_days?: number | null;
    requires_verification: boolean;
    /** Keyed by payload field; fields inside list rows use "list_field.row_field". */
    reference_rules?: Record<string, ReferenceRule> | null;
    ethiopian_date_fields?: string[] | null;
    reference_options: Record<string, CodeOption[]>;
    schema_version: number;
}

/** Who or what took part in an activity, in a named role. LOCAL: a record in this
 *  registry (resolved to its internal id); EXTERNAL: an id issued by another system. */
export interface ActivityParticipant {
    role: string;
    is_primary: boolean;
    ref_kind: "LOCAL" | "EXTERNAL";
    ref_register?: string | null;
    ref_system?: string | null;
    ref_id: string;
    internal_record_id?: string | null;
}

export interface Activity {
    activity_id: string;
    register_mnemonic?: string;
    activity_type: string;
    occurred_at: string;
    occurred_on_ec?: string | null;
    context_id?: string | null;
    subject_type?: string | null;
    subject_id?: string | null;
    subject_internal_record_id?: string | null;
    subject_register_mnemonic?: string | null;
    subject_ancestor_record_ids?: string[] | null;
    recorded_at: string;
    recorded_by: string;
    channel: string;
    source_record_id?: string | null;
    submission_id?: string | null;
    schema_version?: number | null;
    supersedes_activity_id?: string | null;
    superseded_by_activity_id?: string | null;
    status: "ACTIVE" | "SUPERSEDED" | "VOIDED";
    status_reason?: string | null;
    status_changed_by?: string | null;
    status_changed_at?: string | null;
    verification_status: "NOT_REQUIRED" | "SUBMITTED" | "VERIFIED" | "REJECTED";
    verified_by?: string | null;
    verified_at?: string | null;
    verification_remarks?: string | null;
    payload: Record<string, JsonValue>;
    participants?: ActivityParticipant[] | null;
    columns: Record<string, JsonValue>;
    reference_checks?: Record<string, { kind: string; mode: string; status: string; message?: string }> | null;
    rule_warnings?: string[] | null;
    display: Record<string, JsonValue>;
    /** Derived or external data, added asynchronously after the activity was recorded. */
    enrichment?: Record<string, JsonValue> | null;
    /** Where the activity happened, resolved from Master Data when it was written; null if unknown. */
    geo_dimensions?: GeoDimensions | null;
}

/** What append_activity / append_activities accept for one activity. */
export interface ActivityInput {
    register_mnemonic: string;
    activity_type: string;
    occurred_at?: string;
    occurred_on_ec?: string;
    subject_type?: string;
    subject_id?: string;
    subject_internal_record_id?: string;
    /** The register the subject record is in, when subject_internal_record_id is set. */
    subject_register_mnemonic?: string;
    context_id?: string;
    context_key?: string;
    payload: Record<string, JsonValue>;
    source_record_id?: string;
    idempotency_key?: string;
    submission_id?: string;
}

/** A per-subject, per-period summary the register keeps up to date from its activities. */
export interface ActivityAggregate {
    aggregate_id: string;
    register_id: string;
    register_mnemonic?: string | null;
    subject_type: string;
    subject_id: string;
    subject_internal_record_id?: string | null;
    subject_register_mnemonic?: string | null;
    aggregate_type: string;
    period_key: string;
    period_start?: string | null;
    period_end?: string | null;
    aggregate_value: Record<string, JsonValue>;
    /** Empty when the location is unknown. */
    geo_dimensions?: GeoDimensions | null;
    custom_dimensions?: Record<string, JsonValue> | null;
    computed_at: string;
    source_activity_id?: string | null;
}

/** One activity register's activities and summaries about a record (get_subject_activities). */
export interface SubjectActivities {
    register_mnemonic: string;
    register_description?: string | null;
    activities: Activity[];
    aggregates: ActivityAggregate[];
}

export interface ActivityTypeSchema {
    activity_type: string;
    schema_version: number;
    payload_schema?: JsonSchema | null;
    created_at: string;
}

export interface ActivityContext {
    context_id: string;
    register_id: string;
    context_key: string;
    context_type?: string | null;
    subject_type?: string | null;
    subject_id?: string | null;
    attributes?: Record<string, JsonValue> | null;
    status: "OPEN" | "CLOSED";
    opened_at: string;
    opened_by?: string | null;
    closed_at?: string | null;
    closed_by?: string | null;
    close_reason?: string | null;
    /** The context this one replaced (e.g. the crop was changed), and the one that replaced it. */
    replaces_context_id?: string | null;
    replaced_by_context_id?: string | null;
}

export interface WorkItem {
    context_id: string;
    context_key?: string | null;
    subject_id?: string | null;
    activity_type: string;
    after_activity_id: string;
    after_activity_type: string;
    after_occurred_at: string;
    due_from: string;
    due_by?: string | null;
    due_status: "DUE" | "OVERDUE" | "NOT_YET_DUE";
}

export interface Indicator {
    indicator_id: string;
    indicator_code: string;
    display_name: string;
    description?: string | null;
    unit?: string | null;
}

export interface IndicatorResult {
    indicator_code: string;
    display_name: string;
    unit?: string | null;
    group_by: string[];
    rows: Record<string, JsonValue>[];
}

export interface PeriodLock {
    lock_id: string;
    activity_type?: string | null;
    period_start: string;
    period_end: string;
    reason?: string | null;
    is_active: boolean;
    locked_by: string;
    locked_at: string;
    reopened_by?: string | null;
    reopen_reason?: string | null;
}

export interface TemporaryReference {
    temporary_reference_id: string;
    reference_field: string;
    temporary_id: string;
    resolved_id?: string | null;
    first_seen_at: string;
}

export interface AppendResult {
    index: number;
    outcome: "CREATED" | "DUPLICATE" | "FAILED";
    activity?: Activity | null;
    error_code?: string | null;
    error_message?: string | null;
}

export interface Pagination {
    current_page: number;
    page_size: number;
    sort_by?: string;
    search_text?: string;
}

export interface PageInfo {
    number_of_items: number;
    number_of_pages: number;
}
