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
}: CompactCardProps) {
    const displayFields = fields.slice(0, 6);

    return (
        <Link href={href} className="block w-full">
            <div
                className={`flex items-center gap-4 sm:gap-6 px-4 sm:px-6 lg:px-8 p-4 w-full overflow-hidden ${
                    isEven ? 'bg-secondary-second/25' : 'bg-neutral-second'
                }`}
            >
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
            </div>
        </Link>
    );
}
