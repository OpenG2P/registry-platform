"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useRbac } from "@/context/RbacContext";
import { ACTIVITY_ACTIONS } from "@/features/shared/permissions";
import type { TabConfig } from "@/features/shared/types";
import { useActivityRegisters } from "./useActivityRegisters";
import { useSubjectActivities } from "./useSubjectActivities";

/** URL value of ?tab= for the Activities tab (never a configured tab id, which are UUIDs). */
export const ACTIVITIES_TAB_ID = "activities";

interface Options {
    internalRecordId?: string;
    registerId?: string;
    tabs: TabConfig[];
    activeTabIndex: number;
    setActiveTabByIndex: (index: number) => void;
}

/**
 * Adds an "Activities" tab after a record profile's configured tabs. It shows
 * with activity:view, unless the record has no activities and the instance has
 * no activity registers.
 */
export function useRecordActivitiesTab({ internalRecordId, registerId, tabs, activeTabIndex, setActiveTabByIndex }: Options) {
    const { can, loading: rbacLoading } = useRbac();
    const allowed = !rbacLoading && can(ACTIVITY_ACTIONS.view);
    const { registers, loading: registersLoading } = useActivityRegisters(allowed);
    const { groups, loading, error, reload } = useSubjectActivities(internalRecordId, allowed);
    const visible = allowed && (groups.length > 0 || registers.length > 0);

    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const isActive = visible && searchParams.get("tab") === ACTIVITIES_TAB_ID;

    const allTabs = useMemo<TabConfig[]>(
        () => (visible
            ? [...tabs, { tab_id: ACTIVITIES_TAB_ID, register_id: registerId ?? "", tab_label: "Activities", tab_order: tabs.length + 1 }]
            : tabs),
        [visible, tabs, registerId],
    );

    const onTabChange = useCallback((index: number) => {
        if (visible && index === tabs.length) {
            const params = new URLSearchParams(searchParams.toString());
            params.set("tab", ACTIVITIES_TAB_ID);
            router.push(`${pathname}?${params.toString()}`);
            return;
        }
        setActiveTabByIndex(index);
    }, [visible, tabs.length, searchParams, router, pathname, setActiveTabByIndex]);

    return {
        tabs: allTabs,
        activeTabIndex: isActive ? tabs.length : activeTabIndex,
        onTabChange,
        isActive,
        groups,
        registers,
        loading: loading || registersLoading,
        error,
        reload,
    };
}
