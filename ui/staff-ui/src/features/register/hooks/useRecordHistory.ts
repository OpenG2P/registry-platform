import { useFetch } from "@/shared/hooks/useFetch";

interface useRecordHistoryDatesParams {
    register_id?: string;
    internal_record_id?: string;
    tab_id?: string;
}

export const useRecordHistoryDates = (params: useRecordHistoryDatesParams) => {
    const {
        data: datesData,
        loading: loadingDates,
    } = useFetch<{ dates: string[] }>({
        url: "/api/register/get-version-dates",
        enabled: !!params.register_id && !!params.internal_record_id && !!params.tab_id,
        options: {
            method: "POST",
            body: JSON.stringify({
                register_id: params.register_id,
                internal_record_id: params.internal_record_id,
                tab_id: params.tab_id,
            }),
        },
    });

    return {
        datesData,
        loadingDates,
    };
};

interface useRecordHistoryChangesParams {
    register_id?: string;
    internal_record_id?: string;
    tab_id?: string;
    truncated_created_date?: string | null;
}

export const useRecordHistoryChanges = (params: useRecordHistoryChangesParams) => {
    const {
        data: changesData,
        loading: loadingChanges,
    } = useFetch<any>({
        url: "/api/register/get-versions-for-date",
        enabled: !!params.register_id && !!params.internal_record_id && !!params.tab_id && !!params.truncated_created_date,
        options: {
            method: "POST",
            body: JSON.stringify({
                register_id: params.register_id,
                internal_record_id: params.internal_record_id,
                tab_id: params.tab_id,
                truncated_created_date: params.truncated_created_date,
            }),
        },
    });

    return {
        changesData,
        loadingChanges: !!params.truncated_created_date ? loadingChanges : false,
    };
};

interface VersionSectionRecord {
    internal_record_id?: string;
    documents?: unknown[];
    [key: string]: unknown;
}

export interface VersionSectionData {
    register_id: string;
    internal_record_id: string;
    tab_id: string;
    truncated_created_date: string;
    section_id: string;
    section_mnemonic: string;
    section_register_id: string;
    is_list: boolean;
    is_primary_section: boolean;
    change_request_id?: string | null;
    submission_id?: string | null;
    created_at?: string | null;
    created_by?: string | null;
    approved_at?: string | null;
    approved_by?: string | null;
    request_id?: string | null;
    records: VersionSectionRecord[];
}

interface useVersionSectionDataParams {
    register_id?: string;
    internal_record_id?: string;
    tab_id?: string;
    section_id?: string | null;
    truncated_created_date?: string | null;
    change_request_id?: string | null;
    submission_id?: string | null;
}

export const useVersionSectionData = (params: useVersionSectionDataParams) => {
    const versionId = params.change_request_id || params.submission_id;
    const {
        data: versionSectionData,
        loading: loadingVersionSection,
    } = useFetch<VersionSectionData>({
        url: "/api/register/get-version-section-data",
        enabled: !!params.register_id && !!params.internal_record_id && !!params.tab_id
            && !!params.section_id && !!params.truncated_created_date && !!versionId,
        options: {
            method: "POST",
            body: JSON.stringify({
                register_id: params.register_id,
                internal_record_id: params.internal_record_id,
                tab_id: params.tab_id,
                section_id: params.section_id,
                truncated_created_date: params.truncated_created_date,
                change_request_id: params.change_request_id || undefined,
                submission_id: params.change_request_id ? undefined : params.submission_id,
            }),
        },
    });

    return {
        versionSectionData,
        loadingVersionSection: versionId ? loadingVersionSection : false,
    };
};
