'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useFetch } from '@/shared/hooks';
import { toast } from 'react-toastify';
import type { ScoreDefinition } from '../shared/types/registers';

interface EditScoreModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    initialData?: ScoreDefinition | null;
}

export default function EditScoreModal({ isOpen, onClose, onSuccess, initialData }: EditScoreModalProps) {
    const t = useTranslations();
    const { execute: updateScore } = useFetch();

    const [isEnabled, setIsEnabled] = useState(() => initialData?.is_enabled ?? true);

    const handleSubmit = async () => {
        if (!initialData?.score_definition_id) return;

        const result = await updateScore('/api/configuration/registers/score/update-score-definitions', {
            method: 'POST',
            body: JSON.stringify({
                score_definition_id: initialData.score_definition_id,
                is_enabled: isEnabled,
            }),
        });

        const updated = result as { score_definition_id?: string; error?: string } | null;
        if (updated?.score_definition_id && !updated.error) {
            toast.success(t('toast_score_updated'));
            onSuccess?.();
            onClose();
        }
    };

    const handleCancel = () => {
        onClose();
    };

    if (!isOpen || !initialData) return null;

    return (
        <div className="fixed inset-0 bg-neutral-first/80 z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-200 max-h-150 bg-primary-first rounded-[10px] overflow-hidden flex p-1">
                <div className="relative w-full flex-1 overflow-y-auto rounded-[10px] bg-neutral-second p-4 sm:p-10">
                    <button
                        onClick={handleCancel}
                        className="absolute top-4 right-4 text-secondary-third transition-colors hover:text-neutral-first/70 sm:top-6 sm:right-6"
                    >
                        <X className="h-6 w-6 sm:h-10 sm:w-10" strokeWidth={2} />
                    </button>

                    <h2 className="mb-4 break-words pr-10 text-2xl font-bold text-primary-second">{t('edit_score')}</h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-neutral-first mb-2">
                                {t('score_type')}
                            </label>
                            <div className="w-full break-words rounded-lg border border-secondary-first bg-secondary-second/25 px-4 py-2 text-neutral-first/70">
                                {initialData.score_type}
                            </div>
                        </div>

                        <div className="flex items-center gap-3 mt-2">
                            <input
                                type="checkbox"
                                id="score_is_enabled"
                                checked={isEnabled}
                                onChange={(e) => setIsEnabled(e.target.checked)}
                                className="h-4 w-4 rounded border-primary-second text-primary-second focus:ring-primary-second"
                            />
                            <label htmlFor="score_is_enabled" className="text-sm font-semibold text-neutral-first">
                                {t('status')}
                            </label>
                        </div>

                        <div className="flex flex-wrap gap-4 pt-6">
                            <button
                                onClick={handleCancel}
                                className="rounded-[10px] bg-secondary-third px-6 py-2.5 text-neutral-first sm:px-12"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={handleSubmit}
                                className="rounded-[10px] bg-neutral-first px-6 py-2.5 text-neutral-second sm:px-12"
                            >
                                {t('save')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
