'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Option = {
    label: string;
    value: string;
};

interface CustomDropdownProps {
    label?: string;
    options: Option[];
    value?: string;
    onChange?: (value: string) => void;
    loading?: boolean;
    placeholder?: string;
    disabled?: boolean;
    searchable?: boolean;
    menuMaxHeight?: number;
}

type MenuPosition = {
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    placement: 'bottom' | 'top';
};

const DEFAULT_MENU_MAX_HEIGHT = 220;
const SEARCH_THRESHOLD = 8;

export default function CustomDropdown({
    label,
    options,
    value,
    onChange,
    loading,
    placeholder = 'Select',
    disabled,
    searchable,
    menuMaxHeight = DEFAULT_MENU_MAX_HEIGHT,
}: CustomDropdownProps) {
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState<string | undefined>(value);
    const [search, setSearch] = useState('');
    const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
    const [mounted, setMounted] = useState(false);

    const triggerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const showSearch = searchable ?? options.length > SEARCH_THRESHOLD;

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        setSelected(value);
    }, [value]);

    const updateMenuPosition = useCallback(() => {
        const trigger = triggerRef.current;
        if (!trigger) return;

        const rect = trigger.getBoundingClientRect();
        const gap = 4;
        const spaceBelow = window.innerHeight - rect.bottom - gap;
        const spaceAbove = rect.top - gap;
        const openDown = spaceBelow >= 160 || spaceBelow >= spaceAbove;
        const placement = openDown ? 'bottom' : 'top';
        const availableSpace = openDown ? spaceBelow : spaceAbove;
        const maxHeight = Math.min(
            menuMaxHeight,
            Math.max(120, availableSpace - 8),
        );

        const top = openDown
            ? rect.bottom + gap
            : Math.max(8, rect.top - gap - maxHeight);

        setMenuPosition({
            top,
            left: rect.left,
            width: rect.width,
            maxHeight,
            placement,
        });
    }, [menuMaxHeight]);

    useEffect(() => {
        if (!open) {
            setMenuPosition(null);
            setSearch('');
            return;
        }

        updateMenuPosition();

        const handleReposition = () => updateMenuPosition();
        window.addEventListener('resize', handleReposition);
        window.addEventListener('scroll', handleReposition, true);

        return () => {
            window.removeEventListener('resize', handleReposition);
            window.removeEventListener('scroll', handleReposition, true);
        };
    }, [open, updateMenuPosition]);

    useEffect(() => {
        if (!open) return;

        const handleMouseDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (triggerRef.current?.contains(target)) return;
            if (menuRef.current?.contains(target)) return;
            setOpen(false);
        };

        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [open]);

    const selectedItem = options.find((opt) => opt.value === selected);

    const filteredOptions = useMemo(() => {
        if (!showSearch || !search.trim()) return options;
        const query = search.trim().toLowerCase();
        return options.filter(
            (opt) =>
                opt.label.toLowerCase().includes(query) ||
                opt.value.toLowerCase().includes(query),
        );
    }, [options, search, showSearch]);

    const handleSelect = (val: string) => {
        setSelected(val);
        setOpen(false);
        setSearch('');
        onChange?.(val);
    };

    const handleToggle = () => {
        if (disabled) return;
        setOpen((prev) => !prev);
    };

    const menu =
        open && !disabled && menuPosition && mounted ? (
            <div
                ref={menuRef}
                role="listbox"
                className="fixed z-[200] flex flex-col bg-neutral-second border border-primary-second rounded-[10px] shadow-lg overflow-hidden"
                style={{
                    top: menuPosition.top,
                    left: menuPosition.left,
                    width: menuPosition.width,
                    maxHeight: menuPosition.maxHeight,
                }}
            >
                {showSearch && (
                    <div className="shrink-0 border-b border-primary-second/40 p-2">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search..."
                            className="w-full rounded-[8px] border border-primary-second bg-neutral-second px-3 py-1.5 text-[14px] text-neutral-first outline-none focus:border-primary-second"
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                        />
                    </div>
                )}
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
                    {loading ? (
                        <div className="px-4 py-2 text-[16px]">Loading...</div>
                    ) : filteredOptions.length === 0 ? (
                        <div className="px-4 py-2 text-[16px] text-neutral-first/60">
                            No data available
                        </div>
                    ) : (
                        filteredOptions.map((opt) => (
                            <div
                                key={opt.value}
                                role="option"
                                aria-selected={opt.value === selected}
                                onClick={() => handleSelect(opt.value)}
                                className={`px-4 py-2 text-[16px] cursor-pointer truncate hover:bg-secondary-first ${
                                    opt.value === selected
                                        ? 'bg-secondary-first/70 font-medium'
                                        : ''
                                }`}
                                title={opt.label}
                            >
                                {opt.label}
                            </div>
                        ))
                    )}
                </div>
            </div>
        ) : null;

    return (
        <div className="w-full">
            {label && (
                <label
                    className="block text-[16px] font-medium text-neutral-first truncate"
                    title={label}
                >
                    {label}
                </label>
            )}

            <div className="relative mt-2">
                <div
                    ref={triggerRef}
                    onClick={handleToggle}
                    className={`flex cursor-pointer items-center justify-between gap-2.5 rounded-[10px] border border-primary-second bg-neutral-second px-4 py-2 truncate ${
                        open ? 'ring-1 ring-primary-second/40' : ''
                    } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                    <span
                        className="truncate text-[16px]"
                        title={
                            loading
                                ? 'Loading...'
                                : selectedItem?.label || placeholder
                        }
                    >
                        {loading
                            ? 'Loading...'
                            : selectedItem?.label || placeholder}
                    </span>

                    <Image
                        src="/images/common/down_arrow.png"
                        alt=""
                        width={14}
                        height={8}
                        className={`h-auto shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                    />
                </div>

                {mounted && menu ? createPortal(menu, document.body) : null}
            </div>
        </div>
    );
}
