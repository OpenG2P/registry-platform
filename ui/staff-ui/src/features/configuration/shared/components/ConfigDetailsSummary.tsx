import React from 'react';
import { Pencil, Eye } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ConfigDetailsSummaryProps {
    title: string;
    description?: string;
    extraInfo1?: string;
    extraInfo2?: string;
    onEdit?: () => void;
    onView?: () => void;
}

export default function ConfigDetailsSummary({
    title,
    description,
    extraInfo1,
    extraInfo2,
    onEdit,
    onView
}: ConfigDetailsSummaryProps) {
    const t = useTranslations();

    return (
        <div className="mx-3 mb-0 sm:mx-6 lg:mx-8">
            <div
                className="flex min-h-15 items-center justify-between rounded-[10px] border border-dashed border-primary-second bg-primary-first/20 px-4 py-2 shadow-sm sm:px-8 lg:h-15 lg:px-12 lg:py-0"
                style={{ borderStyle: 'dashed', borderWidth: '1px' }}
            >
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 sm:gap-6 lg:flex-nowrap lg:gap-10">
                    <div className="min-w-0 max-w-full sm:min-w-30 sm:max-w-xs lg:max-w-none">
                        <span className="block truncate text-base font-medium text-neutral-first/70" title={title}>{title}</span>
                    </div>

                    <div className="min-w-0 max-w-75 flex-1">
                        <span className="block truncate text-sm text-neutral-first/70" title={description}>{description}</span>
                    </div>

                    {extraInfo1 && (
                        <div className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-neutral-first/70" title={extraInfo1}>{extraInfo1}</span>
                        </div>
                    )}
                    {extraInfo2 && (
                        <div className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-neutral-first/70" title={extraInfo2}>{extraInfo2}</span>
                        </div>
                    )}
                </div>

                <div className="ml-3 flex shrink-0 items-center gap-3 lg:ml-8">
                    {onView && (
                        <button
                            onClick={onView}
                            className="bg-neutral-second p-2 rounded-[10px] hover:bg-secondary-first transition-colors shadow-sm flex items-center justify-center shrink-0"
                            title={t('view_details') || "View Details"}
                        >
                            <Eye size={16} className="text-neutral-first" />
                        </button>
                    )}
                    {onEdit && (
                        <button
                            onClick={onEdit}
                            className="bg-neutral-second p-2 rounded-[10px] hover:bg-secondary-first transition-colors shadow-sm flex items-center justify-center shrink-0"
                            title={t('common.edit') || "Edit"}
                        >
                            <Pencil size={16} className="text-neutral-first" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}


