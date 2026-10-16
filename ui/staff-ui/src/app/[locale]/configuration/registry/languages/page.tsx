'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { TopBar } from '@/components/shared';
import { useRouter } from '@/i18n/navigation';
import { useLang } from '@/features/configuration/registry/hooks/useLang';
import LanguageSelector from '@/features/configuration/registry/components/LanguageSelector';
import LanguageTranslationEditor from '@/features/configuration/registry/components/LanguageTranslationEditor';
import AddLanguageModal from '@/features/configuration/registry/components/AddLanguageModal';
import Can from '@/components/shared/Can';
import { CONFIGURATION_REGISTRY_ACTIONS } from '@/features/shared/permissions';

const LanguagesConfigurationPage = () => {
    const t = useTranslations();
    const router = useRouter();
    const { languages, languagesLoading, fetchLanguages } = useLang();
    const [selectedLanguageId, setSelectedLanguageId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const selectedLanguage = languages.find(l => l.language_id === selectedLanguageId);

    useEffect(() => {
        if (!languagesLoading && languages.length > 0 && !selectedLanguageId) {
            setSelectedLanguageId(languages[0].language_id);
        }
    }, [languages, languagesLoading, selectedLanguageId]);

    return (
        <>
            <TopBar
                breadcrumb={[{ label: t('registry') }, { label: t('languages') }]}
                showFilters={false}
                showPagination={false}
                showAddNewButton={false}
            />

            <div className="mx-3 sm:mx-6 lg:mx-7.5 flex flex-col gap-5 pb-10">
                <div className="bg-neutral-second rounded-[10px] p-4 sm:p-8 grid grid-cols-1 xl:grid-cols-2 gap-6 xl:gap-8 items-center shadow-sm">
                    <div className="flex flex-col gap-1.5 min-w-0">
                        <h1 className="text-[22px] font-bold text-neutral-first m-0 tracking-tight">Language configuration</h1>
                    </div>
                    <div className="flex min-w-0 flex-col items-stretch gap-3 md:flex-row md:items-center xl:justify-end">
                        <div className="w-full min-w-0 md:w-auto md:flex-1 md:max-w-80">
                            <LanguageSelector
                                languages={languages}
                                languagesLoading={languagesLoading}
                                selectedLanguageId={selectedLanguageId}
                                onSelectLanguage={id => {
                                    setSelectedLanguageId(id);
                                }}
                            />
                        </div>
                        <Can action={CONFIGURATION_REGISTRY_ACTIONS.edit}>
                            <button
                                id="create-language-btn"
                                onClick={() => setIsModalOpen(true)}
                                className="flex h-10 w-full min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] bg-neutral-first px-5 text-neutral-second shadow-lg shadow-neutral-first/10 transition-all hover:bg-neutral-first/90 active:scale-95 md:w-auto md:flex-1 xl:w-fit xl:flex-none"
                            >
                                <Plus size={16} strokeWidth={3} />
                                <span className="text-sm font-bold">{t('add_new_language')}</span>
                            </button>
                        </Can>
                    </div>
                </div>

                <LanguageTranslationEditor
                    language={selectedLanguage}
                    languagesLoading={languagesLoading}
                    onCancelEdit={() => {
                        setSelectedLanguageId(null);
                    }}
                    onSaved={async () => {
                        await fetchLanguages();
                        router.refresh();
                    }}
                />
            </div>
            {isModalOpen && (
                <AddLanguageModal
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={async () => {
                        await fetchLanguages();
                    }}
                />
            )}
        </>
    );
};

export default LanguagesConfigurationPage;