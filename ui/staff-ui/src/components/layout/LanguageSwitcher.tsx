'use client';

import { useRouter, usePathname } from '@/i18n/navigation';
import { useLocale } from 'next-intl';
import Image from 'next/image';
import { useRef, useState, useTransition, useMemo } from 'react';
import { useClickOutside } from '@/shared/hooks/useClickOutside';
import { useLang } from '@/features/configuration/registry/hooks/useLang';

export default function LanguageSwitcher() {
    const router = useRouter();
    const pathname = usePathname();
    const locale = useLocale();
    const [isPending, startTransition] = useTransition();
    const { languages, languagesLoading } = useLang();

    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useClickOutside(dropdownRef, () => setOpen(false), open);

    const handleLanguageChange = (languageCode: string) => {
        setOpen(false);
        startTransition(() => {
            router.replace({ pathname }, { locale: languageCode });
        });
    };

    const currentLanguage = useMemo(() => {
        const byLocale = languages.find(lang => lang.language_code === locale);
        if (byLocale) return byLocale;

        const defaultLang = languages.find(lang => lang.is_default);
        if (defaultLang) return defaultLang;

        return languages[0];
    }, [languages, locale]);

    if (languagesLoading) {
        return (
            <div className="flex items-center rounded-[10px] gap-2 px-4 py-2 min-w-35 text-[14px] text-neutral-first/50">
                Loading...
            </div>
        );
    }

    if (!currentLanguage || languages.length === 0) {
        return null;
    }

    return (
        <div className="relative inline-block" ref={dropdownRef}>
            <button
                onClick={() => setOpen(prev => !prev)}
                disabled={isPending}
                className="flex items-center justify-between rounded-[10px] gap-2 px-4 py-2 min-w-35 text-[16px] font-medium cursor-pointer transition-all focus:outline-none"
            >
                <div className="flex items-center gap-2">
                    {currentLanguage.language_flag_base64 ? (
                        <div className="w-6 h-4 relative rounded-sm overflow-hidden shrink-0 border">
                            <Image
                                src={currentLanguage.language_flag_base64}
                                alt={currentLanguage.language_label}
                                fill
                                sizes="28px"
                                className="object-cover"
                            />
                        </div>
                    ) : (
                        <div className="w-6 h-4 rounded-sm shrink-0 border flex items-center justify-center">
                            <span className="text-[7px] text-neutral-first/40 leading-none">--</span>
                        </div>
                    )}
                    <span className="text-neutral-first text-[14px] font-normal leading-normal">
                        {currentLanguage.language_label}
                    </span>
                </div>

                <Image
                    src="/images/common/down_arrow.png"
                    alt="toggle"
                    width={14}
                    height={14}
                    className={`h-auto transition-transform ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {open && (
                <div className="absolute top-full left-0 mt-2 min-w-35 ring-1 ring-black/10 rounded-[10px] bg-neutral-second overflow-hidden z-50">
                    {languages.map(language => (
                        <button
                            key={language.language_id}
                            onClick={() => handleLanguageChange(language.language_code)}
                            className="flex items-center justify-between gap-2 px-4 py-2 min-w-35 text-[16px] font-medium cursor-pointer transition-all focus:outline-none w-full"
                        >
                            <div className="flex items-center gap-2">
                                {language.language_flag_base64 ? (
                                    <div className="w-6 h-4 relative rounded-sm overflow-hidden shrink-0 border">
                                        <Image
                                            src={language.language_flag_base64}
                                            alt={language.language_label}
                                            fill
                                            sizes="28px"
                                            className="object-cover"
                                        />
                                    </div>
                                ) : (
                                    <div className="w-6 h-4 rounded-sm shrink-0 border flex items-center justify-center">
                                        <span className="text-[7px] text-neutral-first/40 leading-none">--</span>
                                    </div>
                                )}
                                <span className="text-neutral-first text-[14px] font-normal leading-normal">
                                    {language.language_label}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}