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
