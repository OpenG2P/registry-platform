import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "@/i18n/navigation";
import { useFetch } from "@/shared/hooks/useFetch";
import type { ChangeRequest } from "@/features/change-request/types/change-request";
import { isRecordAccessDeniedError } from "@/shared/utils/isRecordAccessDeniedError";

export function useChangeRequest(changeId: string) {
    const router = useRouter();
    const [details, setDetails] = useState<ChangeRequest | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(!!changeId);

    const detailsFetchOptions = useMemo(
        () => ({
            method: "POST" as const,
            body: JSON.stringify({ change_request_id: changeId }),
        }),
        [changeId],
    );

    const { data: detailsData, loading: detailsLoading, execute: fetchDetails } =
        useFetch<ChangeRequest>({
            url: "/api/change-request/get",
            enabled: !!changeId,
            options: detailsFetchOptions,
        });

    useEffect(() => {
        if (detailsData && isRecordAccessDeniedError(detailsData)) {
            router.replace("/record-access-denied");
            return;
        }
        if (detailsData) setDetails(detailsData);
        setLoadingDetails(detailsLoading);
    }, [detailsData, detailsLoading, router]);

    const refetchDetails = useCallback(async () => {
        if (!changeId) return;
        const result = await fetchDetails("/api/change-request/get", detailsFetchOptions);
        if (!result) return;

        if (isRecordAccessDeniedError(result)) {
            router.replace("/record-access-denied");
            return;
        }

        const error =
            typeof result === "object" && result !== null && "error" in result
                ? (result as { error?: unknown }).error
                : undefined;
        if (typeof error === "string" && error.trim()) return;

        if (typeof result === "object" && result !== null && "change_request_id" in result) {
            setDetails(result as ChangeRequest);
        }
    }, [changeId, fetchDetails, detailsFetchOptions, router]);

    // Don't treat background refetch as initial load (keeps header mounted while status updates)
    const isInitialLoading = !details && loadingDetails;

    return {
        details,
        loading: changeId ? isInitialLoading : false,
        loadingDetails: changeId ? isInitialLoading : false,
        refetchDetails,
    };
}
