import { useEffect, useMemo } from "react";
import { useRouter } from "@/i18n/navigation";
import { useFetch } from "@/shared/hooks/useFetch";
import { isRecordAccessDeniedError } from "@/shared/utils/isRecordAccessDeniedError";
import { useRegister } from "@/context/RegisterContext";
import { useRegisterTabs } from "@/context/RegisterTabsContext";
import { useRegisterRecord } from "@/context/RegisterRecordContext";
import {
    TabSection,
    TabSectionData,
} from "@/features/register/types";
import { useSectionSave } from "./useSectionSave";
import { useRbac } from "@/context/RbacContext";
import { CHANGE_REQUEST_ACTIONS } from "@/features/shared/permissions";
import { buildSectionsDataMap } from "@/features/shared/utils";

export const useRegisterSections = (onChangeRequestCreated: () => void) => {
    const router = useRouter();
    const { internalRecordId } = useRegisterRecord();
    const { activeTabId } = useRegisterTabs();
    const { currentRegister } = useRegister();
    const { can } = useRbac();

    // list of tab sections
    const { data: tabSections, loading: loadingSections } = useFetch<TabSection[]>({
        url: `/api/register/get-sections`,
        enabled: !!activeTabId,
        options: {
            method: "POST",
            body: JSON.stringify({
                tab_id: activeTabId,
            }),
        },
    });

    const { data: tabSectionsData, loading: loadingData } = useFetch<TabSectionData[]>({
        url: `/api/register/tab-sections-data`,
        enabled:
            !!currentRegister?.register_id && !!activeTabId && !!internalRecordId,
        options: {
            method: "POST",
            body: JSON.stringify({
                register_id: currentRegister?.register_id,
                internal_record_id: internalRecordId,
                tab_id: activeTabId,
            }),
        },
    });
    // Redirect to record access denied page if the record is access denied
    const isRecordAccessDenied =
        tabSectionsData != null && isRecordAccessDeniedError(tabSectionsData);

    useEffect(() => {
        if (isRecordAccessDenied) {
            router.replace("/record-access-denied");
        }
    }, [isRecordAccessDenied, router]);

    const sectionDataMap = useMemo(() => {
        if (
            !tabSectionsData ||
            isRecordAccessDenied ||
            !Array.isArray(tabSectionsData)
        ) {
            return undefined;
        }

        return buildSectionsDataMap(tabSectionsData);
    }, [tabSectionsData, isRecordAccessDenied]);

    const orderedTabSections = useMemo(() => {
        if (!tabSections) return [];

        return [...tabSections]
            .sort((a, b) => (a.section_order ?? 0) - (b.section_order ?? 0))
            .filter((section) => {
                // API may wrap section fields inside section_data
                const schema = section.section_ui_schema ?? section.section_data?.section_ui_schema;
                return (
                    schema &&
                    Object.keys(schema).length > 0 &&
                    Array.isArray(schema.panels) &&
                    schema.panels.length > 0
                );
            })
            .map((section) => {
                // Flatten section_data into the section (API response wraps fields inside section_data)
                const sectionData = section.section_data;

                const section_id = section.section_id;
                const section_register_id = section.section_register_id ?? sectionData?.section_register_id ?? section.register_id;
                const section_ui_schema = section.section_ui_schema ?? sectionData?.section_ui_schema;
                const register_purpose = section.register_purpose ?? sectionData?.register_purpose;
                const register_relation = section.register_relation ?? sectionData?.register_relation;

                let hideEditButton = false;
                if (
                    (register_purpose === "REGISTER" ||
                        register_purpose === "PROGRAM_APPLICATION") &&
                    register_relation !== "SELF"
                ) {
                    hideEditButton = true;
                } else if (
                    register_purpose === "TABLE" &&
                    register_relation !== "DESCENDANT"
                ) {
                    hideEditButton = true;
                }

                if (!can(CHANGE_REQUEST_ACTIONS.create)) {
                    hideEditButton = true
                }

                return {
                    section_id,
                    section_register_id,
                    section_ui_schema,
                    hideEditButton,
                };
            });
    }, [tabSections]);

    const { handleSectionSave } = useSectionSave(
        onChangeRequestCreated,
        tabSections ?? undefined
    );

    const isSchemaStale =
        tabSections &&
        tabSections.length > 0 &&
        tabSections[0].tab_id !== activeTabId;

    const isFetching = loadingSections || loadingData || isRecordAccessDenied;

    const canRenderContent = !!(
        tabSections &&
        currentRegister &&
        internalRecordId &&
        !isSchemaStale &&
        !isFetching
    );
    return {
        tabSections,
        orderedTabSections,
        sectionDataMap,
        handleSectionSave,
        canRenderContent,
    };
};