'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { toast } from 'react-toastify';
import { useRouter } from '@/i18n/navigation';
import { TopBar } from '@/components/shared';
import ThemeSelector from '@/features/configuration/registry/components/ThemeSelector';
import ThemeColorEditor from '@/features/configuration/registry/components/ThemeColorEditor';
import { useTheme } from '@/features/configuration/registry/hooks/useTheme';
import { COLOR_ATTRIBUTES } from '@/features/configuration/registry/types';
import { CONFIGURATION_REGISTRY_ACTIONS } from '@/features/shared/permissions';
import Can from '@/components/shared/Can';

const ThemePage = () => {
    const {
        themes,
        themesLoading,
        selectedThemeId,
        themeAttributes,
        attributesLoading,
        selectTheme,
        updateThemeColors,
        removeTheme,
        getAttributeValue,
        loadAttributes,
    } = useTheme();

    const t = useTranslations();
    const router = useRouter();

    const [draftColors, setDraftColors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!themesLoading && themes.length > 0 && !selectedThemeId) {
            handleSelectTheme(themes[0].theme_id);
        }
    }, [themes, themesLoading, selectedThemeId]);

    const handleSelectTheme = async (themeId: string) => {
        await selectTheme(themeId);
        setDraftColors({});
    };


    const handleColorChange = (key: string, value: string) => {
        setDraftColors(prev => ({ ...prev, [key]: value }));
    };

    const getColor = (key: string): string =>
        key in draftColors ? draftColors[key] : getAttributeValue(key);

    const handleSave = async () => {
        if (!selectedThemeId) return;

        const updates = themeAttributes.map((attr) => ({
            attribute_name: attr.attribute_name,
            attribute_value: draftColors[attr.attribute_name] !== undefined ? draftColors[attr.attribute_name] : attr.attribute_value,
        }));

        Object.keys(draftColors).forEach((key) => {
            if (!themeAttributes.some((a) => a.attribute_name === key)) {
                updates.push({
                    attribute_name: key,
                    attribute_value: draftColors[key],
                });
            }
        });

        const result = await updateThemeColors(selectedThemeId, updates);
        if (result !== null) {
            toast.success(t('theme_config_update_success'));
            setDraftColors({});
        }
    };

    const handleResetToFactory = async () => {
        const factoryTheme = themes.find(t => t.is_factory_shipped);
        if (!factoryTheme || !selectedThemeId) return;

        const factoryAttrs = await loadAttributes(factoryTheme.theme_id);
        factoryAttrs.forEach(attr => {
            setDraftColors(prev => ({
                ...prev,
                [attr.attribute_name]: attr.attribute_value
            }));
        });
        toast.success(t('theme_config_reset_success'));
    };

    const handleDelete = async () => {
        if (!selectedThemeId) return;
        const result = await removeTheme(selectedThemeId);
        if (result !== null) {
            toast.success(t('theme_config_remove_success'));
        }
    };

    const selectedTheme = themes.find(t => t.theme_id === selectedThemeId);
    const previewColors = COLOR_ATTRIBUTES.map(a => getColor(a.key));

    return (
        <>
            <TopBar
                breadcrumb={[{ label: t('registry') }, { label: t('registry_theme') }]}
                showFilters={false}
                showPagination={false}
                showAddNewButton={false}
            />

            <div className="mx-3 sm:mx-6 lg:mx-7.5 flex flex-col gap-5 pb-10">
                <div className="bg-neutral-second rounded-[10px] p-4 sm:p-8 grid grid-cols-1 xl:grid-cols-2 gap-6 xl:gap-8 items-center shadow-sm">
                    <div className="flex flex-col gap-1.5 min-w-0">
                        <h1 className="text-[22px] font-bold text-neutral-first m-0 tracking-tight">{t('theme_config_title')}</h1>
                    </div>

                    <div className="flex min-w-0 flex-col items-stretch gap-3 md:flex-row md:items-center xl:justify-end">
                        <div className="w-full min-w-0 md:w-auto md:flex-1 md:max-w-80">
                            <ThemeSelector
                                themes={themes}
                                themesLoading={themesLoading}
                                selectedThemeId={selectedThemeId}
                                onSelectTheme={handleSelectTheme}
                            />
                        </div>
                        <Can action={CONFIGURATION_REGISTRY_ACTIONS.edit}>
                            <button
                                id="create-theme-btn"
                                onClick={() => router.push('/configuration/registry/themes/create')}
                                className="flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-[10px] bg-neutral-first px-5 text-neutral-second shadow-lg shadow-neutral-first/10 transition-all hover:bg-neutral-first/90 active:scale-95 md:w-auto md:flex-1 xl:w-fit xl:flex-none"
                            >
                                <Plus size={16} strokeWidth={3} />
                                <span className="text-sm font-bold">{t('theme_config_new_theme')}</span>
                            </button>
                        </Can>
                    </div>
                </div>

                <ThemeColorEditor
                    selectedThemeId={selectedThemeId}
                    selectedTheme={selectedTheme}
                    attributesLoading={attributesLoading}
                    previewColors={previewColors}
                    getColor={getColor}
                    onColorChange={handleColorChange}
                    onSave={handleSave}
                    onDiscard={() => { setDraftColors({}); }}
                    onDelete={handleDelete}
                    onReset={handleResetToFactory}
                    isFactoryTheme={selectedTheme?.is_factory_shipped || false}
                />
            </div>
        </>
    );
};

export default ThemePage;