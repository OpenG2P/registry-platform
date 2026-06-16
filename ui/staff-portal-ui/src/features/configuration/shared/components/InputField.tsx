'use client';

interface Props {
    label?: string;
    value: string | number;
    onChange: (value: string) => void;
    placeholder?: string;
    type?: string;
    disabled?: boolean;
    min?: number;
    max?: number;
}

export default function InputField({
    label,
    value,
    onChange,
    placeholder,
    type = 'text',
    disabled = false,
    min,
    max,
}: Props) {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const nextValue = e.target.value;
        if (nextValue !== '' && min !== undefined && Number(nextValue) < min) {
            return;
        }
        if (nextValue !== '' && max !== undefined && Number(nextValue) > max) {
            return;
        }
        onChange(nextValue);
    };

    return (
        <div>
            {label && (
                <label
                    className="block text-[16px] font-medium text-neutral-first truncate"
                    title={label}
                >
                    {label}
                </label>
            )}
            <input
                type={type}
                value={value}
                placeholder={placeholder}
                disabled={disabled}
                min={min}
                max={max}
                onChange={handleChange}
                className={`w-full border border-primary-second py-2 px-4 rounded-[10px] outline-none text-[16px] disabled:opacity-50 disabled:cursor-not-allowed ${label ? 'mt-2' : ''}`}
            />
        </div>
    );
}