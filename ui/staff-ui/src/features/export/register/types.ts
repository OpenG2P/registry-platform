export type ExportFormat = 'XLSX' | 'CSV';

export type ExportScope = 'all' | 'selected';

export interface ExportRegisterRecordsPayload {
    current_page?: number;
    page_size?: number;
    sort_by?: string | null;
    filter_by?: unknown;
    search_text?: string;
    register_id: string;
    export_format: ExportFormat;
    selected_internal_record_ids: string[];
}

export interface ExportRegisterRecordsResponse {
    export_id: string;
    status: string;
}

export interface ExportQueueRecord {
    export_id: string;
    register_id: string;
    export_status: string;
    queued_at: string;
    export_latest_timestamp?: string | null;
    total_records_exported?: number | null;
    export_format: string;
    file_presigned_url?: string | null;
    file_url_expires_at?: string | null;
    export_latest_error_code?: string | null;
}

export interface ExportQueueApiResponse {
    records: ExportQueueRecord[];
    pagination?: {
        number_of_items?: number;
        number_of_pages?: number;
    };
}
