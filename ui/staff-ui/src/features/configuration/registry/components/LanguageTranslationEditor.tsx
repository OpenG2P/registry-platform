'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { toast } from 'react-toastify';
import { useFetch } from '@/shared/hooks';
import { Upload } from 'lucide-react';
import { InputField } from '../../shared/components';
import { Language } from '../types';
import TranslationJsonEditorPanel from './TranslationJsonEditorPanel';

import { TranslationMap } from '../utils/language.helpers';

type TranslationTab = 'core' | 'domain';

interface LanguageTranslationEditorProps {
    language: Language | undefined;
    languagesLoading: boolean;
    onSaved: () => Promise<void>;
    onCancelEdit: () => void;
}

export default function LanguageTranslationEditor({
    language,
    languagesLoading,
    onSaved,
    onCancelEdit,
}: LanguageTranslationEditorProps) {
    const t = useTranslations();
    const { execute: saveLanguage, loading: saving } = useFetch();
    const { execute: removeLanguage } = useFetch();
    const [searchQuery, setSearchQuery] = useState('');

    const [activeTab, setActiveTab] = useState<TranslationTab>('core');
    const [draftCore, setDraftCore] = useState<TranslationMap>({});
    const [draftDomain, setDraftDomain] = useState<TranslationMap>({});

    const [language_code, setLanguageCode] = useState('');
    const [language_label, setLanguageLabel] = useState('');
    const [language_flag_base64, setLanguageFlagBase64] = useState('');
    const [flagFileName, setFlagFileName] = useState('');
    const isDefaultLanguage = language?.is_default === true;

    useEffect(() => {
        if (!language) {
            setDraftCore({});
            setDraftDomain({});
            setSearchQuery('');
            return;
        }
        setDraftCore(language?.core_translation as TranslationMap || {});
        setDraftDomain(language?.domain_translation as TranslationMap || {});
        setLanguageCode(language.language_code || '');
        setLanguageLabel(language.language_label || '');
        setLanguageFlagBase64(language.language_flag_base64 || '');
        setFlagFileName('');
        setActiveTab('core');
        setSearchQuery('');
    }, [language?.language_id]);

    const handleFlagUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isDefaultLanguage) return;
        const file = e.target.files?.[0];
        if (!file) return;
        setFlagFileName(file.name);
        const reader = new FileReader();
        reader.onload = event => {
            setLanguageFlagBase64(event.target?.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleTranslationUpload = (
        event: React.ChangeEvent<HTMLInputElement>,
        tab: TranslationTab
    ) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = loadEvent => {
            try {
                const parsed = JSON.parse((loadEvent.target?.result as string) || '{}');
                if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                    throw new Error('Invalid translation JSON');
                }

                if (tab === 'core') {
                    setDraftCore(parsed as TranslationMap);
                } else {
                    setDraftDomain(parsed as TranslationMap);
                }
            } catch {
                toast.error(t('invalid_translation_file'));
            } finally {
                event.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleSave = async () => {
        if (!language_code || !language_label) {
            toast.warn(t('fill_required_fields'));
            return;
        }

        const payload: Record<string, unknown> = {
            language_code,
            language_label,
            language_flag_base64,
            core_translation: draftCore,
            domain_translation: draftDomain,
        };
        if (language) {
            payload.language_id = language.language_id;
        }

        const result = await saveLanguage('/api/configuration/registry/language/update-language', {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        if (result) {
            toast.success(t('language_updated_success'));
            await onSaved();
        }
    };

    const handleRemove = async () => {
        if (!language) return;
        if (language.is_default) {
            toast.error(t('cannot_delete_default_language'));
            return;
        }
        toast.info(
            ({ closeToast }) => (
                <div className="p-1">
                    <p className="font-bold text-neutral-first mb-3">
                        {t('confirm_delete_language', { label: language.language_label })}
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={async () => {
                                closeToast();
                                const result = await removeLanguage('/api/configuration/registry/language/remove-language', {
                                    method: 'POST',
                                    body: JSON.stringify({ language_id: language.language_id }),
                                });
                                if (result) {
                                    toast.success(t('language_removed_success'));
                                    await onSaved();
                                }
                            }}
                            className="bg-primary-second text-neutral-second px-4 py-1.5 rounded-full text-sm font-semibold hover:bg-primary-second transition-colors shadow-sm"
                        >
                            {t('remove')}
                        </button>
                        <button
                            onClick={closeToast}
                            className="bg-secondary-first text-neutral-first/70 px-4 py-1.5 rounded-full text-sm font-semibold hover:bg-secondary-second transition-colors"
                        >
                            {t('cancel')}
                        </button>
                    </div>
                </div>
            ),
            {
                position: 'top-right',
                autoClose: false,
                closeOnClick: false,
                draggable: false,
                closeButton: false,
                className: 'rounded-[15px] shadow-xl border border-secondary-first',
            }
        );
    };

    if (!language) {
        return (
            <div className="bg-neutral-second rounded-[10px] p-12 flex flex-col items-center justify-center gap-3">
                <p className="text-base font-medium text-neutral-first">{t('select_language')}</p>
            </div>
        );
    }

    return (
        <div className="bg-neutral-second rounded-[10px] overflow-hidden shadow-sm">
            <div className="px-8 py-5 border-b border-secondary-second flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-[18px] font-bold text-neutral-first m-0">{language_label}</h2>
                </div>
                <div className="flex items-center gap-2">
                <button
                        type="button"
                        onClick={handleRemove}
                        className="h-10 w-32 rounded-[10px] border border-primary-second text-primary-second text-sm font-semibold hover:bg-primary-second/10 transition-colors disabled:opacity-50"
                    >
                        {t('remove')}
                    </button>
                    <button
                        type="button"
                        onClick={onCancelEdit}
                        className="h-10 w-32 rounded-[10px] bg-secondary-second text-neutral-first/70 text-sm font-semibold hover:bg-secondary-third transition-colors disabled:opacity-50"
                    >
                        {t('cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        className="h-10 w-32 rounded-[10px] bg-neutral-first text-neutral-second text-sm font-semibold hover:bg-neutral-first/90 transition-colors shadow-lg disabled:opacity-50"
                    >
                        {t('language_save')}
                    </button>
                   
                   
                </div>
            </div>

            {languagesLoading ? (
                <div className="p-8 flex justify-center">
                    <Image src="/images/common/loading.gif" alt="Loading" width={48} height={48} />
                </div>
            ) : (
                <div className="p-8 flex flex-col gap-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <InputField
                            label={t('language_code')}
                            value={language_code}
                            onChange={setLanguageCode}
                            disabled={isDefaultLanguage}
                        />
                        <InputField
                            label={t('language_label')}
                            value={language_label}
                            onChange={setLanguageLabel}
                            disabled={isDefaultLanguage}
                        />
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-neutral-first">{t('language_flag')}</label>
                            <div className="flex items-end gap-3">
                                <div className="h-10 w-52 px-4 rounded-[10px] border border-primary-second flex items-center gap-3">
                                    {language_flag_base64 && (
                                        <div className="w-10 h-6 relative rounded-[6px] border border-secondary-second overflow-hidden shrink-0 bg-neutral-second">
                                            <Image src={language_flag_base64} alt={t('flag_image')} fill className="object-cover" />
                                        </div>
                                    )}
                                    <span className="text-sm text-neutral-first/50 truncate">
                                        {flagFileName || (language_flag_base64 ? t('flag_image') : t('no_file_selected'))}
                                    </span>
                                </div>
                                <label className="h-10 w-52 px-4 rounded-[10px] border border-primary-second text-primary-second text-sm font-bold hover:bg-primary-second/5 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                                    <Upload size={16} />
                                    {t('upload_flag')}
                                    <input
                                        type="file"
                                        onChange={handleFlagUpload}
                                        className="hidden"
                                        accept="image/*"
                                        disabled={isDefaultLanguage}
                                    />
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[10px] border border-secondary-second p-4 flex flex-col gap-4">
                        <div className="flex items-end gap-2 flex-wrap border-b border-secondary-second">
                            <button
                                type="button"
                                onClick={() => setActiveTab('core')}
                                className={`min-w-40 px-4 py-2 text-[16px] font-medium rounded-t-[10px] transition-all ${
                                    activeTab === 'core'
                                        ? 'bg-neutral-first text-neutral-second'
                                        : 'bg-secondary-second text-neutral-first/70'
                                }`}
                            >
                                {t('core_translation')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('domain')}
                                className={`min-w-40 px-4 py-2 text-[16px] font-medium rounded-t-[10px] transition-all ${
                                    activeTab === 'domain'
                                        ? 'bg-neutral-first text-neutral-second'
                                        : 'bg-secondary-second text-neutral-first/70'
                                }`}
                            >
                                {t('domain_translation')}
                            </button>
                        </div>
                        {activeTab === 'core' ? (
                            <div className="flex flex-col gap-4 p-3">
                                {Object.keys(draftCore).length === 0 && (
                                    <div className="px-3">
                                        <label className="h-10 w-60 px-4 rounded-[10px] border border-primary-second text-primary-second text-sm font-bold hover:bg-primary-second/5 transition-colors flex items-center justify-center gap-2 cursor-pointer">
                                            <Upload size={16} />
                                            {t('upload_translation')}
                                            <input
                                                type="file"
                                                onChange={event => handleTranslationUpload(event, 'core')}
                                                className="hidden"
                                                accept=".json,application/json"
                                            />
                                        </label>
                                    </div>
                                )}
                                {Object.keys(draftCore).length > 0 && (
                                    <TranslationJsonEditorPanel
                                        editorKey={`core-${language.language_id}`}
                                        rootName="Core-translation"
                                        data={draftCore}
                                        setData={setDraftCore}
                                        searchQuery={searchQuery}
                                        onSearchChange={setSearchQuery}
                                        searchLabel={t('search_by_key_or_label')}
                                        searchPlaceholder={t('enter_key_or_label')}
                                        searchInputHeightClass="h-12"
                                    />
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4 p-3">
                                {Object.keys(draftDomain).length === 0 && (
                                    <div className="px-3">
                                        <label className="h-10 w-60 px-4 rounded-[10px] border border-primary-second text-primary-second text-sm font-bold hover:bg-primary-second/5 transition-colors flex items-center justify-center gap-2 cursor-pointer">
                                            <Upload size={16} />
                                            {t('upload_translation')}
                                            <input
                                                type="file"
                                                onChange={event => handleTranslationUpload(event, 'domain')}
                                                className="hidden"
                                                accept=".json,application/json"
                                            />
                                        </label>
                                    </div>
                                )}
                                {Object.keys(draftDomain).length > 0 && (
                                    <TranslationJsonEditorPanel
                                        editorKey={`domain-${language.language_id}`}
                                        rootName="Domain-translation"
                                        data={draftDomain}
                                        setData={setDraftDomain}
                                        searchQuery={searchQuery}
                                        onSearchChange={setSearchQuery}
                                        searchLabel={t('search_by_key_or_label')}
                                        searchPlaceholder={t('enter_key_or_label')}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}