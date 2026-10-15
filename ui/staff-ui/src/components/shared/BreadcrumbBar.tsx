"use client";

import Image from "next/image";
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

type BreadcrumbItem = {
    label: string;
    href?: string;
};

interface BreadcrumbBarProps {
    breadcrumb?: BreadcrumbItem[];
}

export default function BreadcrumbBar({ breadcrumb = [] }: BreadcrumbBarProps) {
    const t = useTranslations();
    if (breadcrumb.length === 0) {
        return (
            <div className="flex min-w-0 items-end gap-2">
                <Link href="/" passHref>
                    <div className="flex h-7.5 shrink-0 cursor-pointer items-end pb-0.5 pr-2">
                        <Image src="/images/common/home.png" width={22} height={22} alt={t('home')} className="h-4 w-4 sm:h-[22px] sm:w-[22px]" />
                    </div>
                </Link>

                {[1, 2].map(i => (
                    <div key={i} className="flex items-end gap-2">
                        <div className="h-5.75 w-20 rounded bg-secondary-third" />
                        <div className="h-5.75 w-20 rounded bg-secondary-third" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="flex w-full max-w-full flex-wrap items-center gap-x-2 gap-y-1">
            <Link href="/" passHref className="shrink-0">
                <div className="flex h-7.5 shrink-0 cursor-pointer items-center pr-2">
                    <Image src="/images/common/home.png" width={22} height={22} alt={t('home')} className="h-4 w-4 sm:h-5 sm:w-5 lg:h-[22px] lg:w-[22px]" />
                </div>
            </Link>

            {breadcrumb.map((item, index) => {
                const isLast = index === breadcrumb.length - 1;
                const textColor = isLast ? "text-neutral-first" : "text-neutral-first/50";
                const labelClass = `block whitespace-nowrap ${textColor}`;

                return (
                    <div
                        key={index}
                        className="flex shrink-0 items-center gap-2"
                    >
                        <div className="text-base font-medium leading-snug sm:text-[20px]">
                            {item.href && !isLast ? (
                                <Link href={item.href} title={item.label} className={labelClass}>{item.label}</Link>
                            ) : (
                                <span title={item.label} className={labelClass}>{item.label}</span>
                            )}
                        </div>
                        {!isLast && (
                            <div className="flex shrink-0 items-center">
                                <Image
                                    src="/images/common/breadcrumb_arrow.png"
                                    width={8}
                                    height={14}
                                    alt={t('arrow')}
                                    className="h-3.5 w-2"
                                />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
