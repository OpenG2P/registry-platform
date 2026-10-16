'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LayoutGrid, List, EllipsisVertical, ChevronDown, X } from 'lucide-react';
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
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [narrowMenu, setNarrowMenu] = useState(false);
    const [menuTop, setMenuTop] = useState(0);

    const hasViewToggle = showViewToggle && !!onViewChange;
    const hasExtraItems = extraItems.length > 0;

    useClickOutside(containerRef, () => {
        setKebabOpen(false);
        setOpenSubmenuId(null);
    }, kebabOpen);

    useEffect(() => {
        if (!kebabOpen) return;

        const closeOnScroll = (event: Event) => {
            if (menuRef.current && event.target instanceof Node && menuRef.current.contains(event.target)) {
                return;
            }
            setKebabOpen(false);
            setOpenSubmenuId(null);
        };

        window.addEventListener('scroll', closeOnScroll, true);
        return () => window.removeEventListener('scroll', closeOnScroll, true);
    }, [kebabOpen]);

    if (!hasViewToggle && !hasExtraItems) {
        return null;
    }

    const handleViewChange = (mode: ViewMode) => {
        onViewChange?.(mode);
        setKebabOpen(false);
        setOpenSubmenuId(null);
    };

    const handleItemClick = (item: MoreMenuItem) => {
        if (item.divider || item.disabled) return;

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
                ref={buttonRef}
                onClick={() => {
                    if (!kebabOpen && buttonRef.current) {
                        const narrow = window.matchMedia('(max-width: 639px)').matches;
                        setNarrowMenu(narrow);
                        if (narrow) {
                            setMenuTop(buttonRef.current.getBoundingClientRect().bottom + 8);
                        }
                    }
                    setKebabOpen((prev) => !prev);
                    setOpenSubmenuId(null);
                }}
                className="flex h-7 w-8 items-center justify-center rounded-[8px] bg-primary-first sm:h-8.5 sm:w-10 sm:rounded-[10px]"
            >
                <EllipsisVertical className="size-3.5 sm:size-[18px]" />
            </button>

            {kebabOpen && (
                <div
                    ref={menuRef}
                    className={
                        narrowMenu
                            ? 'fixed inset-x-3 z-[60] max-h-[70vh] overflow-y-auto rounded-[10px] bg-neutral-second py-1.5 shadow-[0_8px_24px_rgba(42,42,42,0.16)]'
                            : 'absolute right-0 top-[calc(100%+8px)] z-50 min-w-[240px] rounded-[10px] bg-neutral-second py-1.5 shadow-[0_8px_24px_rgba(42,42,42,0.16)]'
                    }
                    style={narrowMenu ? { top: menuTop } : undefined}
                >
                    <div className="flex justify-end px-2 pt-1">
                        <button
                            type="button"
                            aria-label={t.has('close') ? t('close') : 'Close'}
                            onClick={() => {
                                setKebabOpen(false);
                                setOpenSubmenuId(null);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-[8px] text-neutral-first/70 hover:bg-secondary-first hover:text-neutral-first"
                        >
                            <X size={16} />
                        </button>
                    </div>
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

    if (item.divider) {
        return <div className="my-1.5 mx-3 border-t border-primary-second/40" />;
    }

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
