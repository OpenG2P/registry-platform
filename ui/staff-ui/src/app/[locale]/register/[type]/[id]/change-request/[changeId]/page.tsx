"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChangeRequestDetailsView } from "@/features/change-request/components";
import { useRegister } from "@/context/RegisterContext";

export default function RegisterChangeRequestDetailsPage() {
    const t = useTranslations();
    const { type: registerType, id, changeId } = useParams<{
        type: string;
        id: string;
        changeId: string;
    }>();
    const internalRecordId = id ? decodeURIComponent(id) : undefined;
    const searchParams = useSearchParams();
    const recordName = searchParams.get("record_name")?.trim() || "";
    const { currentRegister } = useRegister();

    const recordQuery = recordName
        ? `?record_name=${encodeURIComponent(recordName)}`
        : "";
    const crParams = new URLSearchParams();
    const tab = searchParams.get("tab");
    if (tab) crParams.set("tab", tab);
    if (recordName) crParams.set("record_name", recordName);
    const crQuery = crParams.toString() ? `?${crParams.toString()}` : "";

    const breadcrumb = [
        ...(currentRegister && registerType
            ? [{
                label: t(currentRegister.register_subject) ?? currentRegister.register_subject,
                href: `/register/${registerType}`,
            }]
            : []),
        ...(registerType && internalRecordId
            ? [{
                label: recordName,
                href: `/register/${registerType}/${internalRecordId}${recordQuery}`,
            }]
            : []),
        ...(registerType && internalRecordId
            ? [{
                label: t("change_request"),
                href: `/register/${registerType}/${internalRecordId}/change-request${crQuery}`,
            }]
            : []),
        { label: t("details") },
    ];

    return (
        <ChangeRequestDetailsView
            changeId={changeId}
            breadcrumb={breadcrumb}
        />
    );
}
