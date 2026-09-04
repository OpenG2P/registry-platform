import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useBreadcrumb } from "@/shared/hooks";
import { useRegister } from "@/context/RegisterContext";
import { useRegisterTabs } from "@/context/RegisterTabsContext";
import { createWidgetStore } from "@openg2p/registry-widgets";
import { useRegisterSections } from "./useRegisterSections";

export const useRegisterDetail = (onChangeRequestCreated: () => void) => {
    const t = useTranslations();
    const { type: registerType, id } = useParams<{ type: string; id: string }>();
    const internalRecordId = id ? decodeURIComponent(id) : undefined;

    const widgetStore = useMemo(() => createWidgetStore(), []);

    const { tabs, activeTabIndex, activeTabId, setActiveTabByIndex } = useRegisterTabs();

    const { currentRegister } = useRegister();

    const breadcrumb = useBreadcrumb({
        registerType,
        internalRecordId,
        includeActiveTab: false,
    });

    const {
        tabSections,
        orderedTabSections,
        sectionDataMap,
        handleSectionSave,
        canRenderContent,
    } = useRegisterSections(onChangeRequestCreated);

    return {
        registerType,
        t,
        internalRecordId,
        widgetStore,
        tabs,
        activeTabIndex,
        setActiveTabByIndex,
        activeTabId,
        breadcrumb,
        tabSections,
        orderedTabSections,
        sectionDataMap,
        handleSectionSave,
        canRenderContent,
        currentRegister,
    };
};
