import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "@/i18n/navigation";
import { useFetch } from "@/shared/hooks/useFetch";
import type { ChangeRequest } from "@/features/change-request/types/change-request";
import { ChangeRequestDocument } from "../components/ChangeRequestHeader";
import { isRecordAccessDeniedError } from "@/shared/utils/isRecordAccessDeniedError";

export function useChangeRequestManager(changeId: string) {
    const router = useRouter();
    const [details, setDetails] = useState<ChangeRequest | null>(null);
    const [documents, setDocuments] = useState<ChangeRequestDocument[]>([]);

    const [loadingDetails, setLoadingDetails] = useState(true);
    const [loadingDocuments, setLoadingDocuments] = useState(true);

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

    const { data: documentsData, loading: documentsLoading } = useFetch<{ documents: ChangeRequestDocument[] }>({
        url: "/api/change-request/get-documents",
        enabled: !!changeId,
        options: {
            method: "POST",
            body: JSON.stringify({ change_request_id: changeId }),
        },
    });

    useEffect(() => {
        if (detailsData && isRecordAccessDeniedError(detailsData)) {
            router.replace("/record-access-denied");
            return;
        }
        if (detailsData) setDetails(detailsData);
        setLoadingDetails(detailsLoading);
    }, [detailsData, detailsLoading, router]);

    useEffect(() => {
        if (documentsData?.documents) setDocuments(documentsData.documents);
        setLoadingDocuments(documentsLoading);
    }, [documentsData, documentsLoading]);

    const refetchDetails = useCallback(async () => {
        const result = (await fetchDetails("/api/change-request/get", detailsFetchOptions)) as
            | ChangeRequest
            | { error?: string }
            | null;
        if (result && isRecordAccessDeniedError(result)) {
            router.replace("/record-access-denied");
            return;
        }
        if (result && typeof result === "object" && !("error" in result && result.error)) {
            setDetails(result as ChangeRequest);
        }
    }, [fetchDetails, detailsFetchOptions, router]);

    return {
        details,
        documents,
        loadingDetails,
        loadingDocuments,
        refetchDetails,
    };
}
