"use client";

import { useCallback, useMemo } from "react";

import { TabsLayout } from "@/components/shared";
import { ChangeRequestHeader } from "@/features/change-request/components";
import { ApprovalList, ApprovalListSkeleton } from "@/features/approval/components";


import {
    createWidgetStore,
} from "@openg2p/registry-widgets";
import { useTranslations } from "next-intl";
import {
    useChangeRequest,
    useChangeRequestDocuments,
    useRegisterSectionsFromCR,
} from "@/features/change-request/hooks";
import {
    useApprovalTasks,
    useSubmitApprovalDecision,
} from "@/features/approval/hooks";
import { parseAweCurrentStage } from "@/features/approval/utils/aweStatusSummary";
import { REGISTRY_CHANGE_REQUEST_ARTIFACT } from "@/features/approval/constants";
import { useFetch } from "@/shared/hooks/useFetch";
import { buildSectionDataMap } from "@/features/shared/utils";
import { ChangeRequestValuesTabs } from "./ChangeRequestValuesTabs";
import CRHeaderSkeleton from "./CRHeaderSkeleton";
import SectionSchemaSkeleton from "./SectionSchemaSkeleton";

interface ChangeRequestSequenceCheck {
    change_request_id: string;
    internal_record_id: string;
    has_earlier_pending_change_requests: boolean;
    number_of_earlier_pending_change_requests: number;
    approval_decision_blocked: boolean;
}

interface Props {
    changeId: string;
    breadcrumb: { label: string; href?: string }[];
}

export default function ChangeRequestDetailsView({ changeId, breadcrumb }: Props) {
    const t = useTranslations();
    const { details, loadingDetails, refetchDetails } = useChangeRequest(changeId);
    const { documents, loading: loadingDocuments } = useChangeRequestDocuments(changeId);

    const approvalArtifactContext = useMemo(() => {
        if (!details?.change_request_id) return null;
        const currentStage =
            parseAweCurrentStage(details.awe_request_status_summary) ?? 1;
        return {
            artifactId: details.change_request_id,
            artifactType: REGISTRY_CHANGE_REQUEST_ARTIFACT,
            currentStage,
        };
    }, [details?.change_request_id, details?.awe_request_status_summary]);

    const { tasks, loadingTasks, refetchTasks } = useApprovalTasks(details?.awe_request_id);

    const refreshAfterDecision = useCallback(async () => {
        await refetchTasks();
        // Header reads CR approval_status — refetch after tasks so backend status is committed
        await refetchDetails();
    }, [refetchTasks, refetchDetails]);

    const { submitDecision } = useSubmitApprovalDecision(
        approvalArtifactContext,
        refreshAfterDecision,
    );

    const sequenceCheckOptions = useMemo(
        () => ({
            method: "POST" as const,
            body: JSON.stringify({ change_request_id: changeId }),
        }),
        [changeId],
    );

    const { data: sequenceCheckData, loading: loadingSequenceCheck } =
        useFetch<ChangeRequestSequenceCheck>({
            url: "/api/change-request/check-sequence",
            enabled: !!changeId,
            options: sequenceCheckOptions,
        });

    const approvalDecisionBlocked = sequenceCheckData?.approval_decision_blocked ?? false;

    const widgetStoreOld = useMemo(() => createWidgetStore(), []);
    const widgetStoreNew = useMemo(() => createWidgetStore(), []);
    const sectionId = details?.section_id;
    const sectionRegisterId = details?.section_register_id || "";
    const isListSection = details?.is_list || false;

    const { sectionUISchema, loadingSchema } = useRegisterSectionsFromCR({ sectionId });

    const newSectionData = useMemo(
        () =>
            buildSectionDataMap(
                sectionRegisterId,
                details?.change_payload,
                details?.documents || null,
                isListSection
            ),
        [details?.change_payload, isListSection, sectionRegisterId]
    );

    const oldSectionData = useMemo(
        () =>
            buildSectionDataMap(
                sectionRegisterId,
                details?.current_register_data,
                details?.documents || null,
                isListSection
            ),
        [details?.current_register_data, isListSection, sectionRegisterId]
    );

    return (
        <TabsLayout breadcrumb={breadcrumb}>
            <div className="flex gap-7.5">
                <div className="w-full lg:w-[75%]">
                    {!details && (loadingDetails || loadingDocuments) ? (
                        <CRHeaderSkeleton />
                    ) : (
                        details && (
                            <ChangeRequestHeader
                                details={details}
                                documents={documents}
                            />
                        )
                    )}

                    {loadingSchema ? (
                        <SectionSchemaSkeleton />
                    ) : (
                        details && (
                            <ChangeRequestValuesTabs
                                widgetStoreNew={widgetStoreNew}
                                widgetStoreOld={widgetStoreOld}
                                newSectionData={newSectionData}
                                oldSectionData={oldSectionData}
                                sectionUISchema={sectionUISchema}
                                t={t}
                                changeId={changeId}
                            />
                        )
                    )}
                </div>

                <div className="w-full lg:w-[25%]">
                    {loadingDetails ||
                    loadingSequenceCheck ||
                    (!!details?.awe_request_id && loadingTasks) ? (
                        <ApprovalListSkeleton />
                    ) : (
                        <ApprovalList
                            tasks={tasks}
                            isPending={details?.approval_status === "PENDING"}
                            approvalDecisionBlocked={approvalDecisionBlocked}
                            onSubmitDecision={submitDecision}
                        />
                    )}
                </div>
            </div>
        </TabsLayout>
    );
}
