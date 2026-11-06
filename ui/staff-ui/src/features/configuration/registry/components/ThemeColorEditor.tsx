'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Palette, Trash2, Upload, Image as ImageIcon } from 'lucide-react';
import ColorPicker from './ColorPicker';
import ConfirmRemovePopup from '@/features/configuration/shared/components/ConfirmRemovePopup';
import { Theme, COLOR_ATTRIBUTES, IMAGE_ATTRIBUTES } from '../types';
import { CONFIGURATION_REGISTRY_ACTIONS } from '@/features/shared/permissions';
import Can from '@/components/shared/Can';

interface ThemeColorEditorProps {
    selectedThemeId: string | null;
    selectedTheme: Theme | undefined;
    attributesLoading: boolean;
    previewColors: string[];
    getColor: (key: string) => string;
    onColorChange: (key: string, value: string) => void;
    onSave: () => void;
    onDiscard: () => void;
    onDelete: () => void;
    onReset: () => void;
    isFactoryTheme: boolean;
}

export default function ThemeColorEditor({
    selectedThemeId,
    selectedTheme,
    attributesLoading,
    previewColors,
    getColor,
    onColorChange,
    onSave,
    onDiscard,
    onDelete,
    onReset,
    isFactoryTheme,
}: ThemeColorEditorProps) {
    const t = useTranslations();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const handleFileChange = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                onColorChange(key, reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    if (!selectedThemeId) {
        return (
            <div className="bg-neutral-second rounded-[10px] p-12 flex flex-col items-center justify-center gap-3">
                <p className="text-base font-medium text-neutral-first">{t('theme_config_select_to_edit')}</p>
            </div>
        );
    }

    return (
        <div className="bg-neutral-second rounded-[10px] overflow-hidden">
            <div className="px-4 py-5 sm:px-8 border-b border-secondary-second flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                    <div className="min-w-0">
                        <h2 className="text-[18px] font-bold text-neutral-first m-0 truncate" title={selectedTheme?.theme_mnemonic}>{selectedTheme?.theme_mnemonic}</h2>
                    </div>
                </div>

                {selectedThemeId !== 'NEW' && (
                    <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                        <Can action={CONFIGURATION_REGISTRY_ACTIONS.edit}>
                            <button
                                id="reset-theme-btn"
                                onClick={onReset}
                                disabled={isFactoryTheme}
                                className="h-8.5 w-full sm:w-auto px-4 rounded-[10px] bg-neutral-first text-neutral-second text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {t("reset")}
                            </button>

                            <button
                                id="delete-theme-btn"
                                onClick={() => setShowDeleteConfirm(true)}
                                disabled={isFactoryTheme}
                                className="h-8.5 w-full sm:w-auto px-4 rounded-[10px] bg-neutral-first text-neutral-second text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {t("remove")}
                            </button>
                        </Can>
                    </div>
                )}
            </div>

            {attributesLoading ? (
                <div className="p-6 flex flex-col gap-8">
                    <div>
                        <div className="h-6 w-32 bg-secondary-first rounded animate-pulse mb-4" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2].map(i => <div key={i} className="h-20 bg-secondary-first rounded-[10px] animate-pulse" />)}
                        </div>
                    </div>
                    <div>
                        <div className="h-6 w-32 bg-secondary-first rounded animate-pulse mb-4" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-secondary-first rounded-[10px] animate-pulse" />)}
                        </div>
                    </div>
                    <div>
                        <div className="h-6 w-32 bg-secondary-first rounded animate-pulse mb-4" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2].map(i => <div key={i} className="h-20 bg-secondary-first rounded-[10px] animate-pulse" />)}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="p-4 sm:p-8 flex flex-col gap-8">

                    <div className="rounded-[10px] overflow-hidden border border-secondary-second shadow-sm bg-neutral-second">
                        <div className="h-1.5 flex">
                            {previewColors.map((c, i) => (
                                <div key={i} className="flex-1" style={{ backgroundColor: c }} />
                            ))}
                        </div>
                        <div className="px-4 py-3.5 sm:px-5 flex flex-wrap items-center justify-between gap-3">
                            <span className="text-[14px] font-medium text-secondary-third">{t('theme_config_palette_preview')}</span>
                            <div className="flex flex-wrap gap-2">
                                {previewColors.map((c, i) => (
                                    <span
                                        key={i}
                                        className="w-6 h-6 rounded-full border border-neutral-second shadow-inner"
                                        style={{ backgroundColor: c }}
                                        title={COLOR_ATTRIBUTES[i]?.label}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold text-primary-second uppercase tracking-wider mb-4">{t('theme_group_primary')}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {COLOR_ATTRIBUTES.filter(a => a.key.startsWith('primary')).map(attr => (
                                <ColorPicker
                                    key={attr.key}
                                    id={`color-${attr.key}`}
                                    label={t(`theme_attr_${attr.key}_label`)}
                                    value={getColor(attr.key)}
                                    onChange={v => onColorChange(attr.key, v)}
                                    disabled={isFactoryTheme}
                                />
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold text-primary-second uppercase tracking-wider mb-4">{t('theme_group_secondary')}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {COLOR_ATTRIBUTES.filter(a => a.key.startsWith('secondary')).map(attr => (
                                <ColorPicker
                                    key={attr.key}
                                    id={`color-${attr.key}`}
                                    label={t(`theme_attr_${attr.key}_label`)}
                                    value={getColor(attr.key)}
                                    onChange={v => onColorChange(attr.key, v)}
                                    disabled={isFactoryTheme}
                                />
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold text-primary-second uppercase tracking-wider mb-4">{t('theme_group_neutral')}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {COLOR_ATTRIBUTES.filter(a => a.key.startsWith('neutral')).map(attr => (
                                <ColorPicker
                                    key={attr.key}
                                    id={`color-${attr.key}`}
                                    label={t(`theme_attr_${attr.key}_label`)}
                                    value={getColor(attr.key)}
                                    onChange={v => onColorChange(attr.key, v)}
                                    disabled={isFactoryTheme}
                                />
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold text-primary-second uppercase tracking-wider mb-4">{t('theme_group_images')}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {IMAGE_ATTRIBUTES.map(attr => {
                                const val = getColor(attr.key);
                                return (
                                    <div key={attr.key} className="flex flex-col gap-2">
                                        <div className="flex flex-col px-1">
                                            <span className="text-base font-medium text-neutral-first break-words">
                                                {t(`theme_attr_${attr.key}_label`)}
                                                {attr.key === 'dashboard_image' && ' (1200 X 600 px)'}
                                            </span>
                                        </div>
                                        <div className="relative group w-full h-48 bg-secondary-second rounded-[10px] flex items-center justify-center overflow-hidden shrink-0">
                                            <input
                                                type="file"
                                                id={`image-upload-${attr.key}`}
                                                className="hidden"
                                                accept="image/*"
                                                onChange={e => handleFileChange(attr.key, e)}
                                                disabled={isFactoryTheme}
                                            />
                                            {val && val !== '/images/config/blank_image.png' ? (
                                                <Image
                                                    src={val}
                                                    alt={t(`theme_attr_${attr.key}_label`)}
                                                    width={300}
                                                    height={300}
                                                    className="max-h-full max-w-full object-contain"
                                                    unoptimized
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center text-secondary-third">
                                                    <ImageIcon size={80} strokeWidth={1} />
                                                </div>
                                            )}

                                            {!isFactoryTheme && (
                                                <div className="absolute inset-0 bg-neutral-first/40 hidden md:flex flex-col items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                    <button
                                                        onClick={() => document.getElementById(`image-upload-${attr.key}`)?.click()}
                                                        className="flex items-center justify-center gap-2 w-23.75 py-1.5 bg-neutral-second rounded-[10px] text-primary-second shadow-md hover:bg-secondary-first transition-all active:scale-95"
                                                    >
                                                        <Upload size={15} strokeWidth={2.5} />
                                                        <span className="text-[13px] leading-none">{t('upload')}</span>
                                                    </button>
                                                    {val && val !== '/images/config/blank_image.png' && (
                                                        <button
                                                            onClick={() => onColorChange(attr.key, '')}
                                                            className="flex items-center justify-center gap-2 w-23.75 py-1.5 bg-neutral-second rounded-[10px] text-primary-second shadow-md hover:bg-secondary-first transition-all active:scale-95"
                                                        >
                                                            <Trash2 size={15} strokeWidth={2.5} />
                                                            <span className="text-[13px] leading-none">{t('remove')}</span>
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {!isFactoryTheme && (
                                            <div className="flex gap-2 md:hidden w-full">
                                                <button
                                                    type="button"
                                                    onClick={() => document.getElementById(`image-upload-${attr.key}`)?.click()}
                                                    className="flex min-w-0 flex-1 items-center justify-center gap-2 py-1.5 bg-neutral-second rounded-[10px] text-primary-second shadow-md border border-secondary-second"
                                                >
                                                    <Upload size={15} strokeWidth={2.5} />
                                                    <span className="text-[13px] leading-none">{t('upload')}</span>
                                                </button>
                                                {val && val !== '/images/config/blank_image.png' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onColorChange(attr.key, '')}
                                                        className="flex shrink-0 items-center justify-center gap-2 px-3 py-1.5 bg-neutral-second rounded-[10px] text-primary-second shadow-md border border-secondary-second"
                                                        aria-label={t('remove')}
                                                    >
                                                        <Trash2 size={15} strokeWidth={2.5} />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {selectedThemeId !== 'NEW' && (
                        <div className="mt-8 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-6 border-t border-secondary-second">
                            <button
                                id="discard-theme-btn"
                                onClick={onDiscard}
                                className="px-6 h-10 w-full sm:w-auto rounded-[10px] bg-secondary-second text-neutral-first/70 text-sm font-semibold hover:bg-secondary-third transition-colors"
                            >
                                {t('theme_config_discard')}
                            </button>
                            <button
                                id="save-theme-btn"
                                onClick={onSave}
                                disabled={isFactoryTheme}
                                className="px-6 h-10 w-full sm:w-auto rounded-[10px] bg-neutral-first text-neutral-second text-sm font-semibold hover:bg-neutral-first/90 transition-colors shadow-lg active:scale-95 transform disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {t('theme_config_save_changes')}
                            </button>
                        </div>
                    )}
                </div>
            )}


            {showDeleteConfirm && (
                <ConfirmRemovePopup
                    messageKey="theme_config_remove_confirm_simple"
                    onClose={() => setShowDeleteConfirm(false)}
                    onConfirm={() => {
                        onDelete();
                        setShowDeleteConfirm(false);
                    }}
                />
            )}
        </div>
    );
}
