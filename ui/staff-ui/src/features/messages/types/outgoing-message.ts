export interface OutgoingMessage {
    outgest_id: string;
    payload_id: string;
    change_request_id?: string | null;
    intake_form_submission_id?: string | null;
    internal_record_id: string;
    register_id: string;
    register_mnemonic?: string | null;
    data_model_id: string;
    data_model_mnemonic?: string | null;
    topic_id: string;
    websub_topic?: string | null;
    created_at: string;
    changed_by?: string | null;
    changed_at?: string | null;
    approved_by?: string | null;
    approved_at?: string | null;
    changed_by_partner_id?: string | null;
    partner_mnemonic?: string | null;
    transformation_status?: string | null;
    transformation_datetime?: string | null;
    transformation_number_of_attempts?: number | null;
    transformation_latest_error_code?: string | null;
    publish_status?: string | null;
    publish_datetime?: string | null;
    publish_number_of_attempts?: number | null;
    publish_latest_error_code?: string | null;
}
