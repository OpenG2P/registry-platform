'use client';

import { ReactNode, useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import ConfigSidebar from './ConfigSidebar';

export type ConfigActiveOption =
    | "registry"
    | "registry-details"
    | "registry-themes"
    | "registry-languages"
    | "registers"
    | "intake-forms"
    | "data-models"
    | "ingest-configurations"
    | "outgest-configurations"
    | "ingest-key-paths"
    | "ingest-semantic-patterns"
    | "ingest-manage-subscription"
    | "ingest-templates"
    | "outgest-topics"
    | "outgest-templates"
    | "awe-policy-config"

interface ConfigLayoutProps {
    children: ReactNode;
    activeOption: ConfigActiveOption;
}

export const ConfigLayout = ({ children, activeOption }: ConfigLayoutProps) => {
    const t = useTranslations();
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        setMenuOpen(false);
    }, [activeOption]);

    useEffect(() => {
        if (!menuOpen) return;

        const media = window.matchMedia('(min-width: 1024px)');
        const closeOnDesktop = () => {
            if (media.matches) setMenuOpen(false);
        };
        closeOnDesktop();
        media.addEventListener('change', closeOnDesktop);

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setMenuOpen(false);
        };
        window.addEventListener('keydown', onKeyDown);

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            media.removeEventListener('change', closeOnDesktop);
            window.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [menuOpen]);

    const closeMenu = () => setMenuOpen(false);

    return (
        <div className="min-h-screen mx-auto bg-secondary-first flex">
            <div className="mt-4 hidden shrink-0 lg:block">
                <ConfigSidebar activeOption={activeOption} />
            </div>
            <div className="flex-1 flex flex-col min-h-0 min-w-0">
                <div className="sticky top-17.5 z-50 bg-secondary-first lg:hidden">
                    <div className="flex h-14 items-center px-3 sm:px-6">
                        <button
                            type="button"
                            onClick={() => setMenuOpen(open => !open)}
                            aria-expanded={menuOpen}
                            className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-primary-first px-4 text-sm font-semibold text-neutral-first"
                        >
                            {menuOpen ? <X size={18} /> : <Menu size={18} />}
                            <span>{t('configuration')}</span>
                        </button>
                    </div>
                    {menuOpen && (
                        <div className="absolute left-0 right-0 top-full z-40 flex h-[calc(100dvh-4.375rem-3.5rem)] overflow-hidden">
                            <div className="h-full min-h-0 w-72 max-w-[85vw] overflow-y-auto bg-primary-first rounded-r-[10px]">
                                <ConfigSidebar activeOption={activeOption} onNavigate={closeMenu} />
                            </div>
                            <button
                                type="button"
                                aria-label={t('close')}
                                className="h-full min-w-0 flex-1 bg-neutral-first/40"
                                onClick={closeMenu}
                            />
                        </div>
                    )}
                </div>
                {children}
            </div>
        </div>
    );
};

export default ConfigLayout;
