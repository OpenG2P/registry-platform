'use client';

import { useClickOutside } from "@/shared/hooks";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

interface CapsuleDropdownProps {
    label: string;
    items: string[];
    value?: string;
    onChange?: (value: string) => void;
    onOpen?: () => void;
    emptyMessage?: string;
    maxWidth?: string;
}

export default function CapsuleDropdown(props: CapsuleDropdownProps) {
    const t = useTranslations();
    const { label, items, value, onChange, onOpen, emptyMessage, maxWidth } = props;
    const fallbackEmptyMessage = emptyMessage || t('no_items_available');

    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState<string | undefined>(undefined);

    const dropdownRef = useRef<HTMLDivElement>(null);

    useClickOutside(dropdownRef, () => setOpen(false), open);

    useEffect(() => {
        if (value !== undefined) {
            setSelected(value);
        } else {
            setSelected(undefined);
        }
    }, [value]);

    function handleSelect(value: string) {
        setSelected(value);
        setOpen(false);
        onChange?.(value);
    }

    function handleToggle() {
        if (!open) {
            onOpen?.();
        }
        setOpen(!open);
    }

    return (
        <div className="flex w-full min-w-0 flex-col gap-1 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            <span className="w-full min-w-0 truncate text-[16px] font-medium text-neutral-first sm:w-25" title={label}>
                {label}
            </span>

            <div ref={dropdownRef} className={`relative z-10 w-full min-w-0 ${maxWidth || 'sm:w-35'}`}>
                <div
                    onClick={handleToggle}
                    className={`flex w-full min-w-0 items-center justify-between gap-2.5 rounded-[10px] border border-primary-second bg-neutral-second px-4 py-1 ${open ? 'rounded-b-none border-b-transparent' : ''}`}
                    title={selected}
                >
                    <span className={`min-w-0 truncate text-[16px] font-medium ${open ? 'text-neutral-first/50' : 'text-neutral-first'}`} title={selected ?? t('select')}>
                        {selected ?? t('select')}
                    </span>

                    <ChevronDown
                        aria-hidden="true"
                        strokeWidth={2}
                        className={`h-3 w-3 shrink-0 text-neutral-first transition-transform sm:h-4 sm:w-4 ${open ? 'rotate-180' : ''}`}
                    />
                </div>

                {open && (
                    <div className="absolute left-0 py-1 top-full w-full bg-neutral-second border border-primary-second border-t-0 rounded-b-[10px] overflow-hidden">
                        {(
                            items.length === 0 ?
                                (
                                    <div className="px-4 py-3 text-[16px] text-neutral-first truncate" title={fallbackEmptyMessage}>
                                        {fallbackEmptyMessage}
                                    </div>
                                )
                                : (
                                    items.map((item) => (
                                        <div
                                            key={item}
                                            onClick={() => handleSelect(item)}
                                            className="px-4 py-1 text-[16px] cursor-pointer hover:bg-secondary-first text-neutral-first font-medium truncate"
                                            title={item}
                                        >
                                            {item}
                                        </div>
                                    ))
                                )
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}