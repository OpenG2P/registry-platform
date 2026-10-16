"use client";
import Image from "next/image";
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import Link from 'next/link';

import { ProfileDropdown, NotificationInbox, HeaderMoreMenu } from '@/components/layout';
import { useRuntimeConfig } from "@/context/RuntimeConfigContext";
import { useLogoDimensions } from '@/shared/hooks';

export default function Header() {
    const t = useTranslations();
    const locale = useLocale();
    const { config } = useRuntimeConfig();
    const [isScrolled, setIsScrolled] = useState(false);
    const logoSrc = config?.registryLogo || "/images/common/openg2p_logo.png";
    const logoDimensions = useLogoDimensions(logoSrc);
    const isHorizontalLogo = logoDimensions?.isHorizontal ?? false;

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 0);
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <header className={`w-full bg-neutral-second fixed top-0 left-0 right-0 z-50 flex justify-center overflow-visible ${isScrolled ? "shadow-[0px_4px_10px_0px_rgba(0,0,0,0.15)]" : ""}`}>
            <div className="flex h-17.5 w-full min-w-0 items-center justify-between gap-2 px-3 sm:px-6">
                <Link href={`/${locale}`} className={`flex min-w-0 flex-1 items-center overflow-hidden ${isHorizontalLogo ? "max-w-[min(70vw,72rem)]" : "h-full gap-2"}`}>
                    {isHorizontalLogo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={logoSrc}
                            alt="Registry Logo"
                            className="h-12 max-h-full w-auto max-w-full object-contain object-left sm:h-14"
                        />
                    ) : (
                        <Image
                            src={logoSrc}
                            alt="Registry Logo"
                            width={40}
                            height={40}
                            className="h-8 w-8 shrink-0 object-contain sm:h-10 sm:w-10"
                            unoptimized
                        />
                    )}
                    {!isHorizontalLogo && (
                        <div className="min-w-0">
                            <span
                                className="block truncate text-base font-medium not-italic leading-normal text-neutral-first sm:text-[20px]"
                                style={{ fontFamily: 'Roboto' }}
                            >
                                {config?.registryName ? t(config?.registryName) : t('registryGen2')}
                            </span>
                        </div>
                    )}
                </Link>

                {/* Desktop Navigation */}
                <div className="flex items-center gap-4">
                    <NotificationInbox />
                    <ProfileDropdown />
                    <HeaderMoreMenu />

                </div>
            </div>
        </header>
    );
}
