'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Upload, Trash2, Image as ImageIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import ImageCropper from '@/components/shared/ImageCropper';
import { InputField } from '../../shared/components';
import ThemeSelector from './ThemeSelector';
import LanguageSelector from './LanguageSelector';
import { Theme, Language } from '../types';
import { useLogoDimensions, getLogoDisplaySize } from '@/shared/hooks';

const BLANK_LOGO = '/images/config/blank_image.png';
const MAX_IMAGE_SIZE_BYTES = 1 * 1024 * 1024;

interface EditRegistryProps {
    initialName: string;
    initialImage: string;
    initialFavicon: string;
    initialThemeId: string | null;
    initialLanguageId: string | null;
    themes: Theme[];
    themesLoading: boolean;
    languages: Language[];
    languagesLoading: boolean;
    embedded?: boolean;
    onSave: (
        name: string,
        image: string,
        favicon: string,
        themeId: string | null,
        languageId: string | null
    ) => void;
    onCancel: () => void;
}

type CropTarget = 'logo' | 'favicon';

export default function EditRegistry({
    initialName,
    initialImage,
    initialFavicon,
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
    const [favicon, setFavicon] = useState(initialFavicon);
    const [selectedThemeId, setSelectedThemeId] = useState<string | null>(initialThemeId);
    const [selectedLanguageId, setSelectedLanguageId] = useState<string | null>(initialLanguageId);
    const [croppingImage, setCroppingImage] = useState<string | null>(null);
    const [cropTarget, setCropTarget] = useState<CropTarget>('logo');
    const [isCropperOpen, setIsCropperOpen] = useState(false);

    useEffect(() => {
        setName(initialName);
        setImage(initialImage);
        setFavicon(initialFavicon);
        setSelectedThemeId(initialThemeId);
        setSelectedLanguageId(initialLanguageId);
    }, [initialName, initialImage, initialFavicon, initialThemeId, initialLanguageId]);

    const handleFileChange = (target: CropTarget) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        if (file.size > MAX_IMAGE_SIZE_BYTES) {
            const label = target === 'favicon' ? t('registry_favicon') : t('registry_logo');
            toast.error(t('registry_image_size_limit', { label, maxSize: '1MB' }));
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setCropTarget(target);
            setCroppingImage(reader.result as string);
            setIsCropperOpen(true);
        };
        reader.readAsDataURL(file);
    };

    const handleCropComplete = (croppedImage: string) => {
        if (cropTarget === 'favicon') {
            setFavicon(croppedImage);
        } else {
            setImage(croppedImage);
        }
        setIsCropperOpen(false);
        setCroppingImage(null);
    };

    const handleCropCancel = () => {
        setIsCropperOpen(false);
        setCroppingImage(null);
    };

    const triggerUpload = (target: CropTarget) => {
        document.getElementById(`registry-${target}-upload`)?.click();
    };

    const hasLogo = Boolean(image && image !== BLANK_LOGO);
    const hasFavicon = Boolean(favicon && favicon !== BLANK_LOGO);
    const logoDimensions = useLogoDimensions(hasLogo ? image : null);
    const logoDisplaySize = getLogoDisplaySize(logoDimensions, {
        squareHeight: 120,
        horizontalHeight: 120,
        maxHorizontalWidth: 720,
    });
    const isHorizontalLogo = logoDisplaySize.isHorizontal;

    const logoOverlayButtonClass =
        'flex items-center justify-center gap-2 w-23.75 py-1.5 bg-neutral-second rounded-[10px] text-primary-second shadow-md hover:bg-secondary-first transition-all active:scale-95';

    const formBody = (
        <div className="p-8 pb-12 flex flex-col gap-8">
            <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
                <div className="flex flex-col gap-3 min-w-0 w-full lg:w-auto lg:max-w-[min(100%,28rem)]">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold text-neutral-first">{t('registry_logo')}</span>
                        <span className="text-[10px] text-secondary-third">{t('max_size_1mb')}</span>
                    </div>
                    <div className="relative group h-30 min-w-30 w-full max-w-full bg-secondary-second rounded-[10px] flex items-center justify-center overflow-hidden border border-secondary-second/30 px-3">
                        <input
                            type="file"
                            id="registry-logo-upload"
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileChange('logo')}
                        />
                        {hasLogo ? (
                            <Image
                                src={image}
                                alt={t('register_logo_alt')}
                                width={logoDisplaySize.width}
                                height={logoDisplaySize.height}
                                className={
                                    isHorizontalLogo
                                        ? "h-30 w-auto max-w-full object-contain"
                                        : "h-24 w-24 object-contain"
                                }
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
                                onClick={() => triggerUpload('logo')}
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
                    <div className="flex gap-2 md:hidden w-full">
                        <button
                            type="button"
                            onClick={() => triggerUpload('logo')}
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

                <div className="flex flex-col md:flex-row gap-6 lg:gap-8 flex-1 min-w-0 w-full items-start">
                    <div className="flex flex-col gap-3 shrink-0">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-semibold text-neutral-first">{t('registry_favicon')}</span>
                            <span className="text-[10px] text-secondary-third">{t('max_size_1mb')}</span>
                        </div>
                        <div className="relative group w-30 h-30 bg-secondary-second rounded-[10px] flex items-center justify-center overflow-hidden border border-secondary-second/30">
                            <input
                                type="file"
                                id="registry-favicon-upload"
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileChange('favicon')}
                            />
                            {hasFavicon ? (
                                <Image
                                    src={favicon}
                                    alt={t('registry_favicon_alt')}
                                    width={120}
                                    height={120}
                                    className="h-24 w-24 object-contain"
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
                                    onClick={() => triggerUpload('favicon')}
                                    className={logoOverlayButtonClass}
                                >
                                    <Upload size={15} strokeWidth={2.5} />
                                    <span className="text-[13px] leading-none">{t('upload')}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFavicon(BLANK_LOGO)}
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
                                onClick={() => triggerUpload('favicon')}
                                className={`${logoOverlayButtonClass} flex-1`}
                            >
                                <Upload size={15} strokeWidth={2.5} />
                                <span className="text-[13px] leading-none">{t('upload')}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setFavicon(BLANK_LOGO)}
                                className={logoOverlayButtonClass}
                                aria-label={t('remove')}
                            >
                                <Trash2 size={15} strokeWidth={2.5} />
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 overflow-visible min-w-0 flex-1">
                        <span className="text-sm font-semibold text-neutral-first">{t('registry_theme')}</span>
                        <ThemeSelector
                            themes={themes}
                            themesLoading={themesLoading}
                            selectedThemeId={selectedThemeId}
                            onSelectTheme={setSelectedThemeId}
                        />
                    </div>
                    <div className="flex flex-col gap-2 overflow-visible min-w-0 flex-1">
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

            {!isHorizontalLogo && (
                <InputField
                    label={t('registry_name')}
                    value={name}
                    onChange={setName}
                />
            )}
        </div>
    );

    if (embedded) {
        return (
            <>
                <div className="bg-neutral-second rounded-[10px] overflow-visible shadow-sm border border-secondary-second/40">
                    <div className="px-8 py-5 border-b border-secondary-second flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h2 className="text-[18px] font-bold text-neutral-first m-0 truncate">
                            {t('edit_registry_details')}
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
                                onClick={() => onSave(name, image, favicon, selectedThemeId, selectedLanguageId)}
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
                        lockAspect={cropTarget === 'favicon' ? 1 : undefined}
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
                        onClick={() => onSave(name, image, favicon, selectedThemeId, selectedLanguageId)}
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
                    lockAspect={cropTarget === 'favicon' ? 1 : undefined}
                />
            )}
        </>
    );
}