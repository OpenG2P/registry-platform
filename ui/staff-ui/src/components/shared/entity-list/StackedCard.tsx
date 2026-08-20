'use client';

import { ReactNode } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { KeyValue } from '@/components/ui/KeyValue';

export interface StackedCardField {
    label: string;
    value: string;
    valueClassName?: string;
}

export interface StackedCardColumn {
    fields?: StackedCardField[];
    content?: ReactNode;
}

export interface StackedCardProps {
    title: string;
    columns: StackedCardColumn[];
    onViewDetails?: () => void;
    viewDetailsDisabled?: boolean;
}

export default function StackedCard({
    title,
    columns,
    onViewDetails,
    viewDetailsDisabled = false,
}: StackedCardProps) {
    const t = useTranslations();
    const heading = title?.trim() || '—';

    return (
        <div className="rounded-[10px] bg-neutral-second px-10 py-5">
            <h3
                className="mb-4 min-w-0 text-[20px] font-semibold leading-snug tracking-tight text-neutral-first line-clamp-2 md:text-[22px]"
                title={heading !== '—' ? heading : undefined}
            >
                {heading}
            </h3>

            <div className="grid grid-cols-4 items-stretch gap-6 text-[16px] text-neutral-first/50">
                {columns.map((column, index) => (
                    <div key={index} className="flex h-full min-h-0 flex-col">
                        <div
                            className={`flex flex-1 flex-col space-y-2 ${
                                index > 0 ? 'border-l-2 border-secondary-second pl-6' : ''
                            }`}
                        >
                            {column.content ??
                                column.fields?.map((field, fieldIndex) => (
                                    <KeyValue
                                        key={`${field.label}-${fieldIndex}`}
                                        label={field.label}
                                        value={field.value}
                                        valueClassName={field.valueClassName}
                                    />
                                ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="my-4 border-t border-secondary-second" />

            <div className="flex items-center justify-between">
                <button
                    type="button"
                    disabled={viewDetailsDisabled || !onViewDetails}
                    onClick={() => onViewDetails?.()}
                    className="flex items-center gap-2 text-[14px] font-normal text-neutral-first opacity-60 transition hover:opacity-100 disabled:cursor-default disabled:opacity-40 disabled:hover:opacity-40"
                >
                    {t.has('view_details') ? t('view_details') : 'View details'}
                    <Image
                        src="/images/common/arrow_next_01.png"
                        alt=""
                        width={14}
                        height={14}
                    />
                </button>
            </div>
        </div>
    );
}
