'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useFetch } from '@/shared/hooks';
import { useParams } from 'next/navigation';
import { toast } from 'react-toastify';

interface AddScoreModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function AddScoreModal({ isOpen, onClose, onSuccess }: AddScoreModalProps) {
    const t = useTranslations();
    const { registerId } = useParams<{ registerId: string }>();
    const { execute: createScore} = useFetch();

    const [scoreType, setScoreType] = useState('');

    const handleSubmit = async () => {
        if (!scoreType.trim()) {
            toast.warn(t('score_type_required'));
            return;
        }

        const result = await createScore('/api/configuration/registers/score/create-score-definitions', {
            method: 'POST',
            body: JSON.stringify({
                register_id: registerId,
                score_type: scoreType.trim(),
            }),
        });

        console.log(result,"result of score create")


        if (result?.score_definition_id) {
            toast.success(t('toast_score_created'));
            setScoreType('');
            onSuccess?.();
            onClose();
        }
    };

    const handleCancel = () => {
        setScoreType('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-neutral-first/80  z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-200 max-h-150 bg-primary-first rounded-[10px] overflow-hidden flex p-1">
                <div className="relative w-full flex-1 overflow-y-auto rounded-[10px] bg-neutral-second p-4 sm:p-10">
                    <button
                        onClick={handleCancel}
                        className="absolute top-4 right-4 text-secondary-third transition-colors hover:text-neutral-first/70 sm:top-6 sm:right-6"
                    >
                        <X className="h-6 w-6 sm:h-10 sm:w-10" strokeWidth={2} />
                    </button>

                    <h2 className="mb-4 break-words pr-10 text-2xl font-bold text-primary-second">{t('add_score')}</h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-neutral-first mb-1">
                                {t('score_type')}
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder={t('enter_score_type')}
                                    value={scoreType}
                                    onChange={(e) => setScoreType(e.target.value)}
                                    className="w-full px-4 py-2 border border-primary-second rounded-lg outline-none outline-1 outline-primary-second transition-all text-neutral-first/70 placeholder:text-secondary-third"
                                />
                            </div>
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
