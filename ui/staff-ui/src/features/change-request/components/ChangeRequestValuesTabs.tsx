"use client";

import { useState } from "react";
import {
    SectionRenderer,
} from "@openg2p/registry-widgets";
import { RegistryWidgetProvider } from "@/shared/widgets";
import { useDeduplication } from "@/features/change-request/hooks";
import DeduplicationCard from "./DeduplicationCard";

type TabType = "change_request_values" | "cr_possible_duplicates" | "register_possible_duplicates";

export function ChangeRequestValuesTabs({
    widgetStoreNew,
    widgetStoreOld,
    newSectionData,
    oldSectionData,
    sectionUISchema,
    t,
    changeId,
    hostContext,
}: any) {
    const [activeTab, setActiveTab] = useState<TabType>("change_request_values");

    const { results: crResults, loading: crLoading } = useDeduplication(changeId, "change-request");
    const { results: regResults, loading: regLoading } = useDeduplication(changeId, "register");

    const tabClass = (isActive: boolean) =>
        `relative shrink-0 px-3 py-2 text-[14px] font-medium whitespace-nowrap rounded-t-[10px] text-neutral-first transition-all sm:px-6 sm:text-[16px] lg:px-8 lg:text-[18px] ${
            isActive ? "bg-primary-first" : "bg-secondary-second"
        }`;

    return (
        <div className="min-w-0">
            <div className="mb-0 flex flex-wrap items-end gap-2 sm:ml-7.5">
                <button
                    onClick={() => setActiveTab("change_request_values")}
                    className={tabClass(activeTab === "change_request_values")}
                >
                    {t("new_and_old_values")}
                </button>

                <button
                    onClick={() => setActiveTab("cr_possible_duplicates")}
                    className={tabClass(activeTab === "cr_possible_duplicates")}
                >
                    {t("cr_possible_duplicates")}
                    {crResults.length > 0 && (
                        <span className="absolute -top-2 right-1 flex h-5 w-5 items-center justify-center rounded-[10px] bg-toast-failed text-[10px] font-bold text-neutral-second shadow-sm sm:-top-3 sm:right-3 sm:h-6 sm:w-6 sm:text-[12px]">
                            {String(crResults.length).padStart(2, "0")}
                        </span>
                    )}
                </button>

                <button
                    onClick={() => setActiveTab("register_possible_duplicates")}
                    className={tabClass(activeTab === "register_possible_duplicates")}
                >
                    {t("register_possible_duplicates")}
                    {regResults.length > 0 && (
                        <span className="absolute -top-2 right-1 flex h-5 w-5 items-center justify-center rounded-[10px] bg-toast-failed text-[10px] font-bold text-neutral-second shadow-sm sm:-top-3 sm:right-3 sm:h-6 sm:w-6 sm:text-[12px]">
                            {String(regResults.length).padStart(2, "0")}
                        </span>
                    )}
                </button>
            </div>

            {activeTab === "change_request_values" && newSectionData && sectionUISchema && (
                <div className="flex flex-col gap-4">
                    <RegistryWidgetProvider
                        store={widgetStoreNew}
                        schemaData={newSectionData}
                        hostContext={hostContext}
                    >
                        <SectionRenderer
                            section={sectionUISchema}
                            hideEditButton={true}
                            mode="CRView"
                            changeRequestType="new"
                        />
                    </RegistryWidgetProvider>

                    <RegistryWidgetProvider
                        store={widgetStoreOld}
                        schemaData={oldSectionData}
                        hostContext={hostContext}
                    >
                        <SectionRenderer
                            section={sectionUISchema}
                            hideEditButton={true}
                            mode="CRView"
                            changeRequestType="old"
                        />
                    </RegistryWidgetProvider>
                </div>
            )}

            {activeTab === "cr_possible_duplicates" && (
                <DeduplicationCard results={crResults} loading={crLoading} type="change-request" t={t} />
            )}

            {activeTab === "register_possible_duplicates" && (
                <DeduplicationCard results={regResults} loading={regLoading} type="register" t={t} />
            )}
        </div>
    );
}
