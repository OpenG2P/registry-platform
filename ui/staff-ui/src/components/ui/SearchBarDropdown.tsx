"use client";

import { useClickOutside } from "@/shared/hooks/useClickOutside";
import { useState, useRef, useEffect } from "react";
import { useTranslations } from 'next-intl';
import { MdOutlineArrowDropDown } from "react-icons/md";

export interface DropdownOption {
    value: string;
    label: string;
}

interface SearchBarDropdownProps {
    options: DropdownOption[];
    selected: string;
    onChange: (value: string) => void;
}

const SearchBarDropdown = ({
    options,
    selected,
    onChange,
}: SearchBarDropdownProps) => {
    const t = useTranslations();
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useClickOutside(dropdownRef, () => setOpen(false), open);

    // Auto-select first option
    useEffect(() => {
        if (!selected || !options.some(o => o.value === selected)) {
            if (options.length > 0) {
                onChange(options[0].value);
            }
        }
    }, [selected, options, onChange]);

    const selectedLabel =
        options.find((o) => o.value === selected)?.label || t('select');

    return (
        <div ref={dropdownRef} className="relative z-10 -mx-px w-[46%] max-w-56 shrink-0 min-w-0 sm:w-auto sm:min-w-45 sm:max-w-none">
            {/* BUTTON */}
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={`flex h-14 w-full items-center justify-between rounded-[10px] border border-primary-second bg-neutral-second px-3 sm:px-6 gap-2 sm:gap-5 text-base sm:text-[20px] font-semibold text-neutral-first transition-colors
                ${open
                    ? "rounded-b-none border-b-0"
                    : `rounded-r-none border-r-0 after:absolute after:right-0 after:top-2.5 after:bottom-2.5 after:w-px after:bg-primary-second after:content-['']`}
                `}
            >
                <span className={`min-w-0 truncate text-base sm:text-[20px] ${open ? "text-neutral-first/50 font-medium" : "text-neutral-first font-medium"}`}>
                    {selectedLabel}
                </span>

                <span className={`shrink-0 text-3xl sm:text-4xl transition-transform duration-200 opacity-60 ${open ? "rotate-180" : ""}`}>
                    <MdOutlineArrowDropDown />
                </span>
            </button>

            {/* DROPDOWN (OVERLAY) */}
            {open && (
                <div
                    className="absolute w-full z-20 overflow-hidden rounded-b-[10px] border border-t-0 border-primary-second bg-neutral-second">
                    {options.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                                onChange(opt.value);
                                setOpen(false);
                            }}
                            className={`block w-full min-h-14 h-auto px-3 sm:px-6 py-2 text-left text-base sm:text-[20px] font-medium break-words transition-colors ${selected === opt.value ? "bg-secondary-second" : ""}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SearchBarDropdown;
