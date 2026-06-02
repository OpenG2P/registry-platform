'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Upload, Trash2, Image as ImageIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import ImageCropper from '@/components/shared/ImageCropper';
import { InputField } from '../../shared/components';
import ThemeSelector from './ThemeSelector';
import LanguageSelector from './LanguageSelector';
import { Theme, Language } from '../types';

const BLANK_LOGO = '/images/config/blank_image.png';

interface EditRegistryProps {
    initialName: string;
    initialImage: string;
    initialThemeId: string | null;
    initialLanguageId: string | null;
    themes: Theme[];
    themesLoading: boolean;
    languages: Language[];
    languagesLoading: boolean;
    embedded?: boolean;
    onSave: (name: string, image: string, themeId: string | null, languageId: string | null) => void;
    onCancel: () => void;
}

export default function EditRegistry({
    initialName,
    initialImage,
    initialThemeId,
    initialLanguageId,
    themes,
    themesLoading,
    languages,
    languagesLoading,
    embedded = false,
    onSave,
    onCancel,
}: EditRegistryProps) {
    const t = useTranslations();
    const [name, setName] = useState(initialName);
    const [image, setImage] = useState(initialImage);
    const [selectedThemeId, setSelectedThemeId] = useState<string | null>(initialThemeId);
    const [selectedLanguageId, setSelectedLanguageId] = useState<string | null>(initialLanguageId);
    const [croppingImage, setCroppingImage] = useState<string | null>(null);
    const [isCropperOpen, setIsCropperOpen] = useState(false);

    useEffect(() => {
        setName(initialName);
        setImage(initialImage);
        setSelectedThemeId(initialThemeId);
        setSelectedLanguageId(initialLanguageId);
    }, [initialName, initialImage, initialThemeId, initialLanguageId]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setCroppingImage(reader.result as string);
            setIsCropperOpen(true);
        };
        reader.readAsDataURL(file);
    };

    const handleCropComplete = (croppedImage: string) => {
        setImage(croppedImage);
        setIsCropperOpen(false);
        setCroppingImage(null);
    };

    const handleCropCancel = () => {
        setIsCropperOpen(false);
        setCroppingImage(null);
    };

    const triggerUpload = () => {
        document.getElementById('registry-image-upload')?.click();
    };

    const hasLogo = Boolean(image && image !== BLANK_LOGO);

    const logoOverlayButtonClass =
        'flex items-center justify-center gap-2 w-23.75 py-1.5 bg-neutral-second rounded-[10px] text-primary-second shadow-md hover:bg-secondary-first transition-all active:scale-95';

    const formBody = (
        <div className="p-8 pb-12 flex flex-col gap-8">
            <div className="flex flex-col lg:flex-row gap-8">
                <div className="flex flex-col gap-3 shrink-0">
                    <span className="text-sm font-semibold text-neutral-first">{t('registry_logo')}</span>
                    <div className="relative group w-30 h-30 bg-secondary-second rounded-[10px] flex items-center justify-center overflow-hidden shrink-0 border border-secondary-second/30">
                        <input
                            type="file"
                            id="registry-image-upload"
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileChange}
                        />
                        {hasLogo ? (
                            <Image
                                src={image}
                                alt={t('register_logo_alt')}
                                width={140}
                                height={140}
                                className="object-contain"
                                unoptimized
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center text-secondary-third">
                                <ImageIcon size={50} strokeWidth={1} />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-neutral-first/40 hidden md:flex flex-col items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <button
                                type="button"
                                onClick={triggerUpload}
                                className={logoOverlayButtonClass}
                            >
                                <Upload size={15} strokeWidth={2.5} />
                                <span className="text-[13px] leading-none">{t('upload')}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setImage(BLANK_LOGO)}
                                className={logoOverlayButtonClass}
                            >
                                <Trash2 size={15} strokeWidth={2.5} />
                                <span className="text-[13px] leading-none">{t('remove')}</span>
                            </button>
                        </div>
                    </div>
                    <div className="flex gap-2 md:hidden w-30">
                        <button
                            type="button"
                            onClick={triggerUpload}
                            className={`${logoOverlayButtonClass} flex-1`}
                        >
                            <Upload size={15} strokeWidth={2.5} />
                            <span className="text-[13px] leading-none">{t('upload')}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setImage(BLANK_LOGO)}
                            className={logoOverlayButtonClass}
                            aria-label={t('remove')}
                        >
                            <Trash2 size={15} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex flex-col gap-6 min-w-0">
                    <InputField
                        label={t('registry_name')}
                        value={name}
                        onChange={setName}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-visible">
                        <div className="flex flex-col gap-2 overflow-visible">
                            <span className="text-sm font-semibold text-neutral-first">{t('registry_theme')}</span>
                            <ThemeSelector
                                themes={themes}
                                themesLoading={themesLoading}
                                selectedThemeId={selectedThemeId}
                                onSelectTheme={setSelectedThemeId}
                            />
                        </div>
                        <div className="flex flex-col gap-2 overflow-visible">
                            <span className="text-sm font-semibold text-neutral-first">{t('registry_language')}</span>
                            <LanguageSelector
                                languages={languages}
                                languagesLoading={languagesLoading}
                                selectedLanguageId={selectedLanguageId}
                                onSelectLanguage={setSelectedLanguageId}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    if (embedded) {
        return (
            <>
                <div className="bg-neutral-second rounded-[10px] overflow-visible shadow-sm border border-secondary-second/40">
                    <div className="px-8 py-5 border-b border-secondary-second flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h2 className="text-[18px] font-bold text-neutral-first m-0 truncate">
                            {name || t('registry_name')}
                        </h2>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onCancel}
                                className="h-10 w-32 rounded-[10px] bg-secondary-second text-neutral-first/70 text-sm font-semibold hover:bg-secondary-third transition-colors"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={() => onSave(name, image, selectedThemeId, selectedLanguageId)}
                                className="h-10 w-32 rounded-[10px] bg-neutral-first text-neutral-second text-sm font-semibold hover:bg-neutral-first/90 transition-colors shadow-lg"
                            >
                                {t('save_changes')}
                            </button>
                        </div>
                    </div>
                    {formBody}
                </div>

                {isCropperOpen && croppingImage && (
                    <ImageCropper
                        image={croppingImage}
                        onCropComplete={handleCropComplete}
                        onCancel={handleCropCancel}
                    />
                )}
            </>
        );
    }

    return (
        <>
            <div className="bg-primary-first/20 rounded-[10px] p-8 border-2 border-dashed border-primary-second w-full flex flex-col font-roboto">
                {formBody}
                <div className="w-full h-px bg-primary-first my-6" />
                <div className="flex gap-3 px-8 pb-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="h-10 px-6 rounded-[10px] bg-secondary-second text-neutral-first/70 text-sm font-semibold"
                    >
                        {t('cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={() => onSave(name, image, selectedThemeId, selectedLanguageId)}
                        className="h-10 px-6 rounded-[10px] bg-neutral-first text-neutral-second text-sm font-semibold"
                    >
                        {t('save')}
                    </button>
                </div>
            </div>

            {isCropperOpen && croppingImage && (
                <ImageCropper
                    image={croppingImage}
                    onCropComplete={handleCropComplete}
                    onCancel={handleCropCancel}
                />
            )}
        </>
    );
}