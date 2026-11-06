'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ScoreDefinition } from '../shared/types/registers';

interface ViewScoreDefinitionModalProps {
    onClose: () => void;
    data: ScoreDefinition;
}

/** Mount only when open; no `isOpen` prop so the tree is not created until needed. */
export default function ViewScoreDefinitionModal({
    onClose,
    data,
}: ViewScoreDefinitionModalProps) {
    const t = useTranslations();

    return (
        <div className="fixed inset-0 bg-neutral-first/80 z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-200 max-h-[95vh] bg-primary-first rounded-[10px] overflow-hidden flex p-1">
                <div className="relative w-full flex-1 overflow-y-auto rounded-[10px] bg-neutral-second p-4 sm:p-10">
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute top-4 right-4 text-secondary-third transition-colors hover:text-neutral-first/70 focus:outline-none sm:top-6 sm:right-6"
                    >
                        <X className="h-6 w-6 sm:h-10 sm:w-10" strokeWidth={2} />
                    </button>

                    <h2 className="mb-6 break-words pr-10 text-2xl font-bold text-primary-second">
                        {data.score_type} — {t('details')}
                    </h2>

                    <div className="space-y-6">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start">
                            <div className="w-full text-[16px] font-medium text-secondary-third sm:w-55 sm:shrink-0">
                                {t('score_definition_id')}
                            </div>
                            <div className="min-w-0 flex-1 break-words text-[16px] font-bold text-neutral-first">
                                {data.score_definition_id || '-'}
                            </div>
                        </div>

                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start">
                            <div className="w-full text-[16px] font-medium text-secondary-third sm:w-55 sm:shrink-0">
                                {t('score_type')}
                            </div>
                            <div className="min-w-0 flex-1 break-words text-[16px] font-bold text-neutral-first">
                                {data.score_type || '-'}
                            </div>
                        </div>

                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start">
                            <div className="w-full text-[16px] font-medium text-secondary-third sm:w-55 sm:shrink-0">
                                {t('mnemonic')}
                            </div>
                            <div className="min-w-0 flex-1 break-words text-[16px] font-bold text-neutral-first">
                                {data.register_mnemonic || '-'}
                            </div>
                        </div>

                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start">
                            <div className="w-full text-[16px] font-medium text-secondary-third sm:w-55 sm:shrink-0">
                                {t('status')}
                            </div>
                            <div className="min-w-0 flex-1 break-words text-[16px] font-bold text-neutral-first">
                                {data.is_enabled ? t('active') : t('inactive')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
