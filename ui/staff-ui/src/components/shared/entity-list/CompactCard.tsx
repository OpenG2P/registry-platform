'use client';

import { Link } from '@/i18n/navigation';

export interface CompactCardField {
    label: string;
    value: string;
}

export interface CompactCardProps {
    href: string;
    title: string;
    subtitleLabel: string;
    subtitleValue: string;
    imageUrl?: string | null;
    imageAlt?: string;
    fields?: CompactCardField[];
    isEven?: boolean;
    selectable?: boolean;
    selected?: boolean;
    onSelectChange?: (selected: boolean) => void;
}

function FieldLine({ field }: { field?: CompactCardField }) {
    if (!field) return null;

    return (
        <p className="truncate text-[16px] text-neutral-first" title={`${field.label}: ${field.value}`}>
            <span className="font-normal text-neutral-first/70">
                {field.label}:{' '}
            </span>
            <span className="font-medium">{field.value}</span>
        </p>
    );
}

export default function CompactCard({
    href,
    title,
    subtitleLabel,
    subtitleValue,
    imageUrl,
    imageAlt,
    fields = [],
    isEven = false,
    selectable = false,
    selected = false,
    onSelectChange,
}: CompactCardProps) {
    const displayFields = fields.slice(0, 6);
    const fieldColumns = [0, 2, 4]
        .map((startIndex) => [displayFields[startIndex], displayFields[startIndex + 1]] as const)
        .filter(([firstField, secondField]) => firstField || secondField);

    const tone = isEven ? 'bg-secondary-second/25' : 'bg-neutral-second';
    const imageClass = 'h-12 w-12 shrink-0 rounded-md sm:h-14 sm:w-14 lg:h-16 lg:w-16';

    const image = imageUrl ? (
        <img
            src={imageUrl}
            alt={imageAlt || title}
            className={`${imageClass} object-cover`}
        />
    ) : (
        <div className={`${imageClass} bg-secondary-third`} />
    );

    const identity = (
        <div className="min-w-0 flex-1">
            <h3 className="mb-0.5 truncate text-[16px] font-medium text-primary-second" title={title}>
                {title}
            </h3>
            <p className="truncate text-[16px] text-neutral-first/70" title={`${subtitleLabel} : ${subtitleValue}`}>
                <span className="font-normal">{subtitleLabel} :</span>{' '}
                <span className="font-medium text-neutral-first">{subtitleValue}</span>
            </p>
        </div>
    );

    const fieldsBlock = fieldColumns.length > 0 ? (
        <div className="grid w-full grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:contents">
            {fieldColumns.map(([firstField, secondField], index) => (
                <div key={index} className="min-w-0 lg:flex-1">
                    <FieldLine field={firstField} />
                    <FieldLine field={secondField} />
                </div>
            ))}
        </div>
    ) : null;

    const details = (
        <>
            <div className="flex min-w-0 items-center gap-4 sm:gap-6 lg:flex-1">
                {image}
                {identity}
            </div>
            {fieldsBlock}
        </>
    );

    if (!selectable) {
        return (
            <Link
                href={href}
                className={`flex w-full flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:gap-6 lg:px-8 ${tone}`}
            >
                {details}
            </Link>
        );
    }

    return (
        <div className={`flex w-full items-start gap-3 px-4 py-4 sm:gap-4 sm:px-6 lg:items-center lg:gap-6 lg:px-8 ${tone}`}>
            <label
                className="mt-4 shrink-0 cursor-pointer lg:mt-0"
                onClick={(event) => event.stopPropagation()}
            >
                <input
                    type="checkbox"
                    checked={selected}
                    onChange={(event) => onSelectChange?.(event.target.checked)}
                    className="size-4 accent-primary-second"
                    aria-label={title}
                />
            </label>
            <Link href={href} className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
                {details}
            </Link>
        </div>
    );
}
