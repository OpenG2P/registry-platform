'use client';

import { useState, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { useClickOutside } from '@/shared/hooks';
import { useTranslations } from 'next-intl';

interface ConfigurationTabsProps {
    activeTab: string;
    setActiveTab: (tab: any) => void;
    tabLabels: Record<string, string>;
}

const MAX_VISIBLE_TABS = 2;

const TabsDropdown = ({
    options,
    activeTab,
    onTabChange,
    labelMap,
    isMore = false
}: {
    options: string[],
    activeTab: string,
    onTabChange: (tab: any) => void,
    labelMap: Record<string, string>,
    isMore?: boolean
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const isActiveInDropdown = options.includes(activeTab);
    const t = useTranslations();
    const visibleLabel = isActiveInDropdown
        ? labelMap[activeTab]
        : (isMore ? (t('more') || 'More') : labelMap[activeTab]);

    useClickOutside(dropdownRef, () => setIsOpen(false), isOpen);

    return (
        <div className="relative min-w-0 flex-1 text-center sm:flex-none" ref={dropdownRef}>
            <div>
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    title={visibleLabel}
                    className={`inline-flex w-full min-w-0 max-w-45 items-center justify-center rounded-t-[10px] px-2 py-2 text-[18px] font-medium sm:w-auto sm:min-w-30 sm:px-4
             ${isActiveInDropdown ? 'bg-primary-first text-neutral-first' : 'bg-secondary-second text-neutral-first '
                        }`}
                >
                    <span className="truncate" title={visibleLabel}>
                        {visibleLabel}
                    </span>
                    <ChevronDown className={`ml-2 h-6 w-6 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {isOpen && (
                <div className="absolute right-0 left-auto z-50 mt-0 min-w-30 max-w-45 origin-top-right
                rounded-b-[10px] rounded-l-[10px] border border-primary-first bg-neutral-second outline-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.25)]
                sm:left-0 sm:right-auto sm:origin-top-left sm:rounded-l-none sm:rounded-r-[10px]
                ">
                    <div className="py-1">
                        {options.map((option) => (
                            <button
                                key={option}
                                title={labelMap[option]}
                                onClick={() => {
                                    onTabChange(option);
                                    setIsOpen(false);
                                }}
                                className={`block w-full text-left px-4 py-2 font-medium text-[18px] truncate whitespace-nowrap transition-colors ${activeTab === option
                                    ? 'bg-primary-first/25 text-neutral-first font-semibold'
                                    : 'text-neutral-first'
                                    }`}
                            >
                                {labelMap[option]}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default function ConfigurationTabs({
    activeTab,
    setActiveTab,
    tabLabels
}: ConfigurationTabsProps) {
    const tabKeys = Object.keys(tabLabels);
    const inlineTabs = tabKeys.slice(0, MAX_VISIBLE_TABS);
    const moreTabs = tabKeys.slice(MAX_VISIBLE_TABS);

    return (
        <div className="flex h-full min-w-0 items-end gap-2">
            {inlineTabs.map((key) => (
                <button
                    key={key}
                    title={tabLabels[key]}
                    onClick={() => setActiveTab(key as any)}
                    className={`min-w-0 max-w-45 flex-1 rounded-t-[10px] px-2 py-2 text-[18px] font-medium sm:min-w-30 sm:flex-none sm:px-4
      ${activeTab === key
                            ? 'bg-primary-first text-neutral-first'
                            : 'bg-secondary-second text-neutral-first'
                        }`}
                >
                    <span className="block w-full truncate text-center" title={tabLabels[key]}>
                        {tabLabels[key]}
                    </span>
                </button>
            ))}

            {moreTabs.length > 0 && (
                <TabsDropdown
                    options={moreTabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    labelMap={tabLabels}
                    isMore
                />
            )}
        </div>
    );
}
