"use client";

import { useParams } from "next/navigation";
import { ChangeRequestDetailsView } from "@/features/change-request/components";
import { useBreadcrumb } from "@/shared/hooks";

export default function RegisterChangeRequestDetailsPage() {
    const { type: registerType, id, changeId } = useParams<{
        type: string;
        id: string;
        changeId: string;
    }>();
    const internalRecordId = id ? decodeURIComponent(id) : undefined;

    const breadcrumb = useBreadcrumb({
        registerType,
        internalRecordId,
        changeId,
        includeActiveTab: true,
        includeChangeRequest: true,
    });

    return (
        <ChangeRequestDetailsView
            changeId={changeId}
            breadcrumb={breadcrumb}
        />
    );
}
