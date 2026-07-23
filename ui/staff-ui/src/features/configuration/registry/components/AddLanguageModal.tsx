'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import { useFetch } from '@/shared/hooks';
import { BaseModal, InputField } from '../../shared/components';
import { readAndValidateJson, type TranslationMap } from '../utils/language.helpers';

interface AddLanguageModalProps {
    onClose: () => void;
    onSuccess: () => Promise<void>;
}

export default function AddLanguageModal({ onClose, onSuccess }: AddLanguageModalProps) {
    const t = useTranslations();
    const { execute: saveLanguage } = useFetch();

    const [language_code, setLanguageCode] = useState('');
    const [language_label, setLanguageLabel] = useState('');
    const [language_flag_base64, setLanguageFlagBase64] = useState('');
    const [flagFileName, setFlagFileName] = useState('');
    const [core_translation, setCoreTranslation] = useState<TranslationMap>({});
    const [domain_translation, setDomainTranslation] = useState<TranslationMap>({});
    const [coreFileName, setCoreFileName] = useState('');
    const [domainFileName, setDomainFileName] = useState('');

    const handleFlagUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFlagFileName(file.name);
        const reader = new FileReader();
        reader.onload = event => {
            setLanguageFlagBase64(event.target?.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleCoreUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const json = await readAndValidateJson(file);
            setCoreTranslation(json);
            setCoreFileName(file.name);
        } catch (error: any) {
            toast.error(error.message || t('something_went_wrong'));
        }
    };

    const handleDomainUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const json = await readAndValidateJson(file, { allowEmpty: true });
            setDomainTranslation(json);
            setDomainFileName(file.name);
        } catch (error: any) {
            toast.error(error.message || t('something_went_wrong'));
        }
    };

    const handleSave = async () => {
        if (!language_code || !language_label || !language_flag_base64) {
            toast.warn(t('fill_required_fields'));
            return;
        }

        try {
            const result = await saveLanguage('/api/configuration/registry/language/create-language', {
                method: 'POST',
                body: JSON.stringify({
                    language_code,
                    language_label,
                    language_flag_base64,
                    core_translation,
                    domain_translation,
                }),
            });

            if (result) {
                toast.success(t('language_created_success'));
                await onSuccess();
                onClose();
            } else {
                toast.error(t('save_failed'));
            }
        } catch {
            toast.error(t('error_occurred'));
        }
    };

    return (
        <BaseModal
            title={t('add_new_language')}
            onClose={onClose}
            primaryActionLabel={t('save')}
            onPrimaryAction={handleSave}
            maxWidth="max-w-3xl"
        >
            <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField
                        label={`${t('language_code')} *`}
                        value={language_code}
                        onChange={setLanguageCode}
                    />
                    <InputField
                        label={`${t('language_label')} *`}
                        value={language_label}
                        onChange={setLanguageLabel}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-2 min-w-0">
                        <label className="text-sm font-semibold text-neutral-first">{`${t('language_flag')} *`}</label>
                        <div className="flex flex-col gap-3 min-w-0">
                            <div className="h-10 w-full px-4 rounded-[10px] border border-primary-second flex items-center gap-3 min-w-0">
                                {language_flag_base64 && (
                                    <div className="w-10 h-6 relative rounded-[6px] border border-secondary-second overflow-hidden shrink-0 bg-neutral-second">
                                        <Image src={language_flag_base64} alt={t('flag_image')} fill className="object-cover" />
                                    </div>
                                )}
                                <span className="text-sm text-neutral-first/50 truncate">
                                    {flagFileName || (language_flag_base64 ? t('flag_image') : t('no_flag_uploaded'))}
                                </span>
                            </div>
                            <label className="h-10 w-full px-4 rounded-[10px] border border-primary-second text-primary-second text-sm font-bold hover:bg-primary-second/5 transition-colors flex items-center justify-center gap-2 cursor-pointer">
                                <Upload size={16} />
                                {t('upload_flag')}
                                <input type="file" onChange={handleFlagUpload} className="hidden" accept="image/*" />
                            </label>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 min-w-0">
                        <label className="text-sm font-semibold text-neutral-first">{t('core_translation')}</label>
                        <div className="flex flex-col gap-3 min-w-0">
                            <div className="h-10 w-full px-4 rounded-[10px] border border-primary-second flex items-center min-w-0">
                                <span className="text-sm text-neutral-first/50 truncate">
                                    {coreFileName || `${t('no_file_selected')}`}
                                </span>
                            </div>
                            <label className="h-10 w-full px-4 rounded-[10px] border border-primary-second text-primary-second text-sm font-bold hover:bg-primary-second/5 transition-colors flex items-center justify-center gap-2 cursor-pointer">
                                <Upload size={16} />
                                {t('upload_translation')}
                                <input type="file" onChange={handleCoreUpload} className="hidden" accept=".json,application/json" />
                            </label>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 min-w-0">
                        <label className="text-sm font-semibold text-neutral-first">{t('domain_translation')}</label>
                        <div className="flex flex-col gap-3 min-w-0">
                            <div className="h-10 w-full px-4 rounded-[10px] border border-primary-second flex items-center min-w-0">
                                <span className="text-sm text-neutral-first/50 truncate">
                                    {domainFileName || `${t('no_file_selected')}`}
                                </span>
                            </div>
                            <label className="h-10 w-full px-4 rounded-[10px] border border-primary-second text-primary-second text-sm font-bold hover:bg-primary-second/5 transition-colors flex items-center justify-center gap-2 cursor-pointer">
                                <Upload size={16} />
                                {t('upload_translation')}
                                <input type="file" onChange={handleDomainUpload} className="hidden" accept=".json,application/json" />
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </BaseModal>
    );
}