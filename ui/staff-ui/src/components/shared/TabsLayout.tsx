'use client';

import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { BreadcrumbBar } from "@/components/shared";
import { TabsResponse } from "@/features/shared/types";
import { useTranslations } from "next-intl";

interface Props {
    breadcrumb: { label: string; href?: string }[];
    tabs?: TabsResponse | null;
    activeTab?: number;
    onTabChange?: (index: number) => void;
    children: ReactNode;
    rightContent?: ReactNode;
}

export default function TabsLayout({
    breadcrumb,
    tabs,
    activeTab,
    onTabChange,
    children,
    rightContent,
}: Props) {
    const t = useTranslations();
    const [isMoreOpen, setIsMoreOpen] = useState(false);
    const moreMenuRef = useRef<HTMLDivElement | null>(null);
    const [maxVisibleTabs, setMaxVisibleTabs] = useState(5);

    useLayoutEffect(() => {
        const compact = window.matchMedia("(max-width: 374px)");
        const wide = window.matchMedia("(min-width: 640px)");
        const update = () => {
            if (wide.matches) setMaxVisibleTabs(5);
            else if (compact.matches) setMaxVisibleTabs(1);
            else setMaxVisibleTabs(2);
        };
        update();
        compact.addEventListener("change", update);
        wide.addEventListener("change", update);
        return () => {
            compact.removeEventListener("change", update);
            wide.removeEventListener("change", update);
        };
    }, []);

    const allTabs = tabs?.tabs ?? [];
    const visibleTabs = allTabs.slice(0, maxVisibleTabs);
    const moreTabs = allTabs.slice(maxVisibleTabs);
    const hasMoreTabs = moreTabs.length > 0;

    const isMoreActive =
        hasMoreTabs && activeTab !== undefined && activeTab >= maxVisibleTabs;

    useEffect(() => {
        if (!isMoreOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (
                moreMenuRef.current &&
                !moreMenuRef.current.contains(event.target as Node)
            ) {
                setIsMoreOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isMoreOpen]);

    // if activeTab change then close the dropdown of more tab
    useEffect(() => {
        setIsMoreOpen(false);
    }, [activeTab]);

    const activeMoreTab =
        hasMoreTabs &&
        activeTab !== undefined &&
        activeTab >= maxVisibleTabs &&
        activeTab < allTabs.length
            ? allTabs[activeTab]
            : undefined;

    return (
        <div className="min-h-screen bg-secondary-first">
            <div className="px-3 pt-5 sm:px-6 lg:px-7.5">
                <BreadcrumbBar breadcrumb={breadcrumb} />
            </div>

            <div className="px-3 py-4 sm:px-6 sm:py-6 lg:px-7.5">
                {tabs && activeTab !== undefined && onTabChange && (
                    <div className="flex flex-wrap items-center justify-between gap-3 px-0 sm:gap-4 sm:px-4 lg:px-10">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                            {visibleTabs.map((tab, index) => {
                                const tabIndex = index;
                                const isActive = activeTab === tabIndex;

                                return (
                                    <button
                                        key={tab.tab_id}
                                        onClick={() => onTabChange(tabIndex)}
                                        className={`min-w-0 max-w-full px-3 py-2 text-base font-medium text-neutral-first rounded-t-[10px] transition-all sm:min-w-30 sm:max-w-45 sm:px-4 sm:text-[18px] ${
                                            isActive
                                                ? "bg-primary-first"
                                                : "bg-secondary-second"
                                        }`}
                                    >
                                        <span className="block w-full truncate text-center">
                                            {t(tab.tab_label) || tab.tab_label}
                                        </span>
                                    </button>
                                );
                            })}

                            {hasMoreTabs && (
                                <div className="relative" ref={moreMenuRef}>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setIsMoreOpen((prev) => !prev)
                                        }
                                        className={`inline-flex max-w-full min-w-0 items-center justify-center gap-2 px-3 py-2 rounded-t-[10px] text-base font-medium text-neutral-first transition-all sm:min-w-30 sm:px-4 sm:text-[18px] ${
                                            isMoreActive
                                                ? "bg-primary-first"
                                                : "bg-secondary-second"
                                        }`}
                                    >
                                        <span className="truncate">
                                            {activeMoreTab
                                                ? t(activeMoreTab.tab_label) ||
                                                  activeMoreTab.tab_label
                                                : t("more") || "More"}
                                        </span>
                                        <ChevronDown
                                            className={`ml-1 h-4 w-4 shrink-0 transition-transform sm:h-5 sm:w-5 ${
                                                isMoreOpen ? "rotate-180" : ""
                                            }`}
                                        />
                                    </button>

                                    {isMoreOpen && (
                                        <div className="origin-top-left outline-none absolute left-0 mt-0 min-w-30 rounded-b-[10px] rounded-r-[10px] bg-neutral-second border border-primary-first drop-shadow-[0_2px_6px_rgba(0,0,0,0.25)] z-50">
                                            <div className="py-1">
                                                {moreTabs.map((tab, index) => {
                                                    const tabIndex =
                                                        maxVisibleTabs +
                                                        index;
                                                    const isActive =
                                                        activeTab === tabIndex;

                                                    return (
                                                        <button
                                                            key={tab.tab_id}
                                                            type="button"
                                                            onClick={() => {
                                                                onTabChange(
                                                                    tabIndex
                                                                );
                                                                setIsMoreOpen(
                                                                    false
                                                                );
                                                            }}
                                                            className={`block w-full max-w-[min(15.5rem,calc(100vw-2rem))] text-left px-3 py-2 text-base font-medium transition-colors sm:px-4 sm:text-[18px] ${
                                                                isActive
                                                                    ? "bg-primary-first/25 text-neutral-first font-semibold"
                                                                    : "text-neutral-first"
                                                            }`}
                                                        >
                                                            {t(
                                                                tab.tab_label
                                                            ) || tab.tab_label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        {rightContent}
                    </div>
                )}
                {children}
            </div>
        </div>
    );
}
