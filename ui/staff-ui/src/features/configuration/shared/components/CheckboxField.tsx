'use client';

import { Check } from 'lucide-react';

interface Props {
    label: string;
    checked: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
}

export default function CheckboxField({
    label,
    checked,
    onChange,
    disabled = false,
}: Props) {
    return (
        <div className="flex min-w-0 items-center gap-3 select-none">
            <div
                onClick={() => !disabled && onChange(!checked)}
                className={`
                    h-5 w-5 shrink-0 rounded border transition-all flex items-center justify-center cursor-pointer
                    ${checked 
                        ? 'bg-amber-600 border-amber-600 shadow-sm' 
                        : 'bg-white border-secondary-second hover:border-amber-600/50'}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
            >
                {checked && <Check size={14} className="text-white" strokeWidth={3} />}
            </div>
            <label 
                onClick={() => !disabled && onChange(!checked)}
                className={`block min-w-0 flex-1 truncate text-sm font-semibold cursor-pointer ${disabled ? 'text-neutral-first/30' : 'text-neutral-first/70'}`}
                title={label}
            >
                {label}
            </label>
        </div>
    );
}