"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { ChangeRequestDetailsView } from "@/features/change-request/components";
import { useTranslations } from "next-intl";

export default function ChangeRequestDetailsPage() {
    const t = useTranslations();

    const { changeId } = useParams<{
        changeId: string;
    }>();

    const breadcrumb = useMemo(
        () => [
            {
                label: t("change_request"),
                href: "/change-request",
            },
            {
                label: "",
            },
        ],
        [t]
    );

    return (
        <ChangeRequestDetailsView
            changeId={changeId}
            breadcrumb={breadcrumb}
        />
    );
}
