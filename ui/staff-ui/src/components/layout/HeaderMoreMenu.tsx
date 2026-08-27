"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { ChevronDown, EllipsisVertical } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useClickOutside } from "@/shared/hooks/useClickOutside";
import { useLang } from "@/features/configuration/registry/hooks/useLang";
import Can from "@/components/shared/Can";
import { CONFIG_NAV_ACTIONS } from "@/features/shared/permissions";

export default function HeaderMoreMenu() {
    const t = useTranslations();
    const router = useRouter();
    const pathname = usePathname();
    const locale = useLocale();
    const [open, setOpen] = useState(false);
    const [langOpen, setLangOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const menuRef = useRef<HTMLDivElement>(null);
    const { languages, languagesLoading } = useLang();

    useClickOutside(menuRef, () => {
        setOpen(false);
        setLangOpen(false);
    }, open);

    const currentLanguage = useMemo(() => {
        const byLocale = languages.find((lang) => lang.language_code === locale);
        if (byLocale) return byLocale;

        const defaultLang = languages.find((lang) => lang.is_default);
        if (defaultLang) return defaultLang;

        return languages[0];
    }, [languages, locale]);

    const closeAll = () => {
        setOpen(false);
        setLangOpen(false);
    };

    const goToConfig = () => {
        closeAll();
        router.push("/configuration/registry/details");
    };

    const handleLanguageChange = (languageCode: string) => {
        closeAll();
        startTransition(() => {
            router.replace({ pathname }, { locale: languageCode });
        });
    };

    const itemClass =
        "w-full flex items-center gap-2.5 px-3 py-2.5 text-[15px] rounded-[8px] mx-1.5 text-neutral-first";
    const itemStyle = { width: "calc(100% - 12px)" };

    return (
        <div className="relative" ref={menuRef}>
            <button
                type="button"
                aria-label={t("more")}
                aria-haspopup="true"
                aria-expanded={open}
                onClick={() => {
                    setOpen((prev) => !prev);
                    setLangOpen(false);
                }}
                className="flex h-9 w-9 items-center justify-center text-neutral-first hover:opacity-70 cursor-pointer"
            >
                <EllipsisVertical size={20} />
            </button>

            {open && (
                <div className="absolute right-0 top-[calc(100%+8px)] z-50 min-w-[200px] bg-neutral-second rounded-[10px] shadow-[0_8px_24px_rgba(42,42,42,0.16)] py-1.5">
                    <Can anyOf={CONFIG_NAV_ACTIONS}>
                        <button
                            type="button"
                            onClick={goToConfig}
                            className={itemClass}
                            style={itemStyle}
                        >
                            <Image
                                src="/images/config/config_icon.png"
                                alt=""
                                width={16}
                                height={16}
                            />
                            {t("configuration")}
                        </button>
                    </Can>

                    {languagesLoading ? (
                        <div className="px-3 py-2.5 mx-1.5 text-[14px] text-neutral-first/50">
                            {t("loading")}
                        </div>
                    ) : languages.length > 0 ? (
                        <div className="relative" style={itemStyle}>
                            <button
                                type="button"
                                disabled={isPending}
                                aria-haspopup="menu"
                                aria-expanded={langOpen}
                                onClick={() => setLangOpen((prev) => !prev)}
                                className={`${itemClass} mx-0 justify-between`}
                                style={{ width: "100%" }}
                            >
                                <span className="flex items-center gap-2.5 min-w-0">
                                    {currentLanguage?.language_flag_base64 ? (
                                        <div className="relative h-4 w-6 shrink-0 overflow-hidden rounded-sm border border-black/10">
                                            <Image
                                                src={currentLanguage.language_flag_base64}
                                                alt=""
                                                fill
                                                sizes="24px"
                                                className="object-cover"
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex h-4 w-6 shrink-0 items-center justify-center rounded-sm border border-black/10">
                                            <span className="text-[7px] leading-none text-neutral-first/40">
                                                --
                                            </span>
                                        </div>
                                    )}
                                    <span className="truncate">
                                        {currentLanguage?.language_label}
                                    </span>
                                </span>
                                <ChevronDown
                                    size={16}
                                    className={`shrink-0 text-neutral-first/60 transition-transform ${langOpen ? "rotate-180" : ""}`}
                                />
                            </button>

                            {langOpen && (
                                <div role="menu" className="mt-1 ml-2">
                                    {languages.map((language) => {
                                        const isCurrent =
                                            language.language_id ===
                                            currentLanguage?.language_id;
                                        return (
                                            <button
                                                key={language.language_id}
                                                type="button"
                                                role="menuitemradio"
                                                aria-checked={isCurrent}
                                                disabled={isPending}
                                                onClick={() =>
                                                    handleLanguageChange(
                                                        language.language_code,
                                                    )
                                                }
                                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-[14px] rounded-[8px] text-neutral-first cursor-pointer ${
                                                    isCurrent
                                                        ? "bg-black/[0.04] font-medium"
                                                        : ""
                                                }`}
                                            >
                                                <span className="flex items-center gap-2.5 min-w-0">
                                                    {language.language_flag_base64 ? (
                                                        <div className="relative h-4 w-6 shrink-0 overflow-hidden rounded-sm border border-black/10">
                                                            <Image
                                                                src={language.language_flag_base64}
                                                                alt=""
                                                                fill
                                                                sizes="24px"
                                                                className="object-cover"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="flex h-4 w-6 shrink-0 items-center justify-center rounded-sm border border-black/10">
                                                            <span className="text-[7px] leading-none text-neutral-first/40">
                                                                --
                                                            </span>
                                                        </div>
                                                    )}
                                                    <span className="truncate">
                                                        {language.language_label}
                                                    </span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
}
