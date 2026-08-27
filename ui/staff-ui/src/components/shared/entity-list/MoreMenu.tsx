'use client';

import { ReactNode, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LayoutGrid, List, EllipsisVertical, ChevronDown } from 'lucide-react';
import { useClickOutside } from '@/shared/hooks/useClickOutside';
import { MoreMenuItem, ViewMode } from './types';

interface MoreMenuProps {
    view?: ViewMode;
    onViewChange?: (mode: ViewMode) => void;
    showViewToggle?: boolean;
    extraItems?: MoreMenuItem[];
}

const itemClass =
    'w-full flex items-center gap-2.5 px-3 py-2.5 text-[15px] leading-4 rounded-[8px] mx-1.5 text-neutral-first text-left';
const itemStyle = { width: 'calc(100% - 12px)' };

function MenuIcon({ children }: { children: ReactNode }) {
    return (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center [&>svg]:block [&>svg]:h-4 [&>svg]:w-4">
            {children}
        </span>
    );
}

export default function MoreMenu({
    view,
    onViewChange,
    showViewToggle = true,
    extraItems = [],
}: MoreMenuProps) {
    const t = useTranslations();
    const [kebabOpen, setKebabOpen] = useState(false);
    const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const hasViewToggle = showViewToggle && !!onViewChange;
    const hasExtraItems = extraItems.length > 0;

    useClickOutside(containerRef, () => {
        setKebabOpen(false);
        setOpenSubmenuId(null);
    }, kebabOpen);

    if (!hasViewToggle && !hasExtraItems) {
        return null;
    }

    const handleViewChange = (mode: ViewMode) => {
        onViewChange?.(mode);
        setKebabOpen(false);
        setOpenSubmenuId(null);
    };

    const handleItemClick = (item: MoreMenuItem) => {
        if (item.disabled) return;

        if (item.children?.length) {
            setOpenSubmenuId((prev) => (prev === item.id ? null : item.id));
            return;
        }

        item.onClick?.();
        setKebabOpen(false);
        setOpenSubmenuId(null);
    };

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                aria-label={t.has('more') ? t('more') : 'More options'}
                aria-haspopup="true"
                aria-expanded={kebabOpen}
                onClick={() => {
                    setKebabOpen((prev) => !prev);
                    setOpenSubmenuId(null);
                }}
                className="w-10 h-8.5 flex items-center justify-center rounded-[10px] bg-primary-first"
            >
                <EllipsisVertical size={18} />
            </button>

            {kebabOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] z-50 min-w-[240px] bg-neutral-second rounded-[10px] shadow-[0_8px_24px_rgba(42,42,42,0.16)] py-1.5">
                    {hasExtraItems && (
                        <>
                            {extraItems.map((item) => (
                                <ExtraMenuItem
                                    key={item.id}
                                    item={item}
                                    isSubmenuOpen={openSubmenuId === item.id}
                                    onClick={handleItemClick}
                                />
                            ))}
                            {hasViewToggle && (
                                <div className="my-1.5 mx-3 border-t border-primary-second/40" />
                            )}
                        </>
                    )}

                    {hasViewToggle && (
                        <>
                            <button
                                type="button"
                                onClick={() => handleViewChange('card')}
                                className={`${itemClass} ${
                                    view === 'card'
                                        ? 'bg-primary-first font-medium text-neutral-first'
                                        : 'text-neutral-first'
                                }`}
                                style={itemStyle}
                            >
                                <MenuIcon>
                                    <LayoutGrid size={16} />
                                </MenuIcon>
                                <span className="min-w-0 truncate">
                                    {t.has('card_view') ? t('card_view') : 'Card view'}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleViewChange('list')}
                                className={`${itemClass} ${
                                    view === 'list'
                                        ? 'bg-primary-first font-medium text-neutral-first'
                                        : 'text-neutral-first'
                                }`}
                                style={itemStyle}
                            >
                                <MenuIcon>
                                    <List size={16} />
                                </MenuIcon>
                                <span className="min-w-0 truncate">
                                    {t.has('list_view') ? t('list_view') : 'List view'}
                                </span>
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

function ExtraMenuItem({
    item,
    isSubmenuOpen,
    onClick,
}: {
    item: MoreMenuItem;
    isSubmenuOpen: boolean;
    onClick: (item: MoreMenuItem) => void;
}) {
    const hasChildren = !!item.children?.length;

    return (
        <div className="relative">
            <button
                type="button"
                disabled={item.disabled && !hasChildren}
                onClick={() => onClick(item)}
                className={`${itemClass} ${
                    item.disabled && !hasChildren
                        ? 'text-neutral-first/50 cursor-default'
                        : ''
                } ${isSubmenuOpen ? 'bg-primary-first font-medium' : ''}`}
                style={itemStyle}
            >
                {item.icon ? <MenuIcon>{item.icon}</MenuIcon> : null}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {hasChildren && (
                    <ChevronDown
                        size={16}
                        className={`block h-4 w-4 shrink-0 text-neutral-first/60 transition-transform ${
                            isSubmenuOpen ? 'rotate-180' : ''
                        }`}
                    />
                )}
            </button>

            {hasChildren && isSubmenuOpen && (
                <div role="menu" className="mt-1 ml-2">
                    {item.children!.map((child) => (
                        <button
                            key={child.id}
                            type="button"
                            role="menuitem"
                            disabled={child.disabled}
                            onClick={() => onClick(child)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-[14px] leading-4 rounded-[8px] text-left text-neutral-first ${
                                child.disabled
                                    ? 'text-neutral-first/50 cursor-default'
                                    : 'cursor-pointer'
                            }`}
                        >
                            <span className="truncate">{child.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
