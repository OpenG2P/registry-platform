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
    const rowClass = `flex items-center gap-4 sm:gap-6 px-4 sm:px-6 lg:px-8 py-4 w-full overflow-hidden ${
        isEven ? 'bg-secondary-second/25' : 'bg-neutral-second'
    }`;

    const body = (
        <>
            {imageUrl ? (
                <img
                    src={imageUrl}
                    alt={imageAlt || title}
                    className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-md object-cover shrink-0"
                />
            ) : (
                <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-secondary-third rounded-md shrink-0" />
            )}

            <div className="flex-1 min-w-0">
                <h3 className="font-medium text-primary-second text-[16px] mb-0.5">{title}</h3>
                <p className="text-[16px] text-neutral-first/70">
                    <span className="font-normal">{subtitleLabel} :</span>{' '}
                    <span className="font-medium text-neutral-first">{subtitleValue}</span>
                </p>
            </div>

            {[0, 2, 4].map((startIndex) => {
                const firstField = displayFields[startIndex];
                const secondField = displayFields[startIndex + 1];

                return (
                    <div key={startIndex} className="flex-1 min-w-0">
                        {firstField ? (
                            <p className="text-[16px] text-neutral-first truncate">
                                <span className="font-normal text-neutral-first/70">
                                    {firstField.label}:{' '}
                                </span>
                                <span className="font-medium">{firstField.value}</span>
                            </p>
                        ) : (
                            <p className="text-[16px] invisible">&nbsp;</p>
                        )}
                        {secondField ? (
                            <p className="text-[16px] text-neutral-first truncate">
                                <span className="font-normal text-neutral-first/70">
                                    {secondField.label}:{' '}
                                </span>
                                <span className="font-medium">{secondField.value}</span>
                            </p>
                        ) : (
                            <p className="text-[16px] invisible">&nbsp;</p>
                        )}
                    </div>
                );
            })}
        </>
    );

    if (!selectable) {
        return (
            <Link href={href} className="block w-full">
                <div className={rowClass}>{body}</div>
            </Link>
        );
    }

    return (
        <div className={rowClass}>
            <label
                className="shrink-0 flex items-center justify-center cursor-pointer"
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
            <Link href={href} className="flex items-center gap-4 sm:gap-6 flex-1 min-w-0">
                {body}
            </Link>
        </div>
    );
}
