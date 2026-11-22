import { useCallback, useMemo } from "react";
import { useFetch } from "@/shared/hooks/useFetch";

export const useIntakeSubmissions = (
    registerId?: string,
    params?: {
        searchText?: string;
        currentPage?: number;
        pageSize?: number;
        sortBy?: string | null;
        filterBy?: unknown;
    }
) => {
    const fetchOptions = useMemo(
        () => ({
            method: "POST" as const,
            body: JSON.stringify({
                register_id: registerId,
                search_text: params?.searchText,
                current_page: params?.currentPage,
                page_size: params?.pageSize,
                filter_by: params?.filterBy ?? "",
                ...(params?.sortBy ? { sort_by: params.sortBy } : {}),
            }),
        }),
        [registerId, params?.searchText, params?.currentPage, params?.pageSize, params?.sortBy, params?.filterBy],
    );

    const { data, loading, execute } = useFetch<any>({
        url: "/api/intake-form/search-in-intake-form-submission",
        options: fetchOptions,
        enabled: !!registerId,
    });
    const submissions = data?.submissions;
    const paginationInfo = data?.pagination;

    const refetch = useCallback(async () => {
        if (!registerId) return;
        await execute("/api/intake-form/search-in-intake-form-submission", fetchOptions);
    }, [registerId, execute, fetchOptions]);

    return {
        submissions,
        paginationInfo,
        loading,
        refetch,
    };
};
