'use client';

import { useMemo, useState } from 'react';
import { TopBar } from '@/components/shared';
import Image from 'next/image';
import { ArrowRight, ImageIcon, Palette, Languages, SquarePen } from 'lucide-react';
import { useFetch } from '@/shared/hooks/useFetch';
import { useLogoDimensions, getLogoDisplaySize } from '@/shared/hooks';
import { convertImageToBase64 } from '@/features/configuration/shared';
import { toast } from 'react-toastify';
import Can from '@/components/shared/Can';
import { CONFIGURATION_REGISTRY_ACTIONS } from '@/features/shared/permissions';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/features/configuration/registry/hooks/useTheme';
import { useLang } from '@/features/configuration/registry/hooks/useLang';
import EditRegistry from '@/features/configuration/registry/components/EditRegistry';
import { Link, useRouter, usePathname } from '@/i18n/navigation';

const BLANK_LOGO = '/images/config/blank_image.png';

const RegistryConfigurationPage = () => {
	const t = useTranslations();
	const router = useRouter();
	const pathname = usePathname();
	const { themes, themesLoading } = useTheme();
	const { languages, languagesLoading } = useLang();
	const [isEditing, setIsEditing] = useState(false);
	const [configurationId, setConfigurationId] = useState<string | null>(null);
	const [registryName, setRegistryName] = useState(t('registry_name'));
	const [image, setImage] = useState(BLANK_LOGO);
	const [favicon, setFavicon] = useState(BLANK_LOGO);
	const [themeId, setThemeId] = useState<string | null>(null);
	const [languageId, setLanguageId] = useState<string | null>(null);

	const { data: registryData, loading: registryLoading } = useFetch({ url: '/api/configuration/registry/get' });
	const { execute: saveRegistry } = useFetch();

	const resolvedThemeId = registryData?.registry_theme_id ?? themeId;
	const resolvedLanguageId = registryData?.registry_language_id ?? languageId;
	const resolvedLogo = registryData?.registry_logo || image;
	const resolvedFavicon = registryData?.registry_favicon || favicon;
	const resolvedName = registryData?.registry_name || registryName;

	const selectedTheme = useMemo(
		() => themes.find(th => th.theme_id === resolvedThemeId),
		[themes, resolvedThemeId]
	);

	const selectedLanguage = useMemo(
		() => languages.find(lang => lang.language_id === resolvedLanguageId),
		[languages, resolvedLanguageId]
	);

	const hasCustomLogo = Boolean(resolvedLogo && resolvedLogo !== BLANK_LOGO);
	const hasCustomFavicon = Boolean(resolvedFavicon && resolvedFavicon !== BLANK_LOGO);
	const logoDimensions = useLogoDimensions(hasCustomLogo ? resolvedLogo : null);
	const logoDisplaySize = getLogoDisplaySize(logoDimensions, {
		squareHeight: 120,
		horizontalHeight: 120,
		maxHorizontalWidth: 720,
	});
	const isHorizontalLogo = logoDisplaySize.isHorizontal;
	const isLoading = registryLoading || themesLoading || languagesLoading;

	const startEditing = () => {
		if (registryData) {
			setConfigurationId(registryData.configuration_id);
			setRegistryName(registryData.registry_name || t('registry_name'));
			setImage(registryData.registry_logo || BLANK_LOGO);
			setFavicon(registryData.registry_favicon || BLANK_LOGO);
			setThemeId(registryData.registry_theme_id || null);
			setLanguageId(registryData.registry_language_id || null);
		}
		setIsEditing(true);
	};

	const handleSave = async (
		newName: string,
		newImage: string,
		newFavicon: string,
		newThemeId: string | null,
		newLanguageId: string | null
	) => {
		const base64Logo = await convertImageToBase64(newImage);
		const base64Favicon = await convertImageToBase64(newFavicon);

		const endpoint =
			configurationId || registryData?.configuration_id
				? '/api/configuration/registry/update'
				: '/api/configuration/registry/create';

		const payload =
			configurationId || registryData?.configuration_id
				? {
						configuration_id: configurationId || registryData?.configuration_id,
						registry_name: newName,
						registry_logo: base64Logo,
						registry_favicon: base64Favicon,
						registry_theme_id: newThemeId,
						registry_language_id: newLanguageId,
					}
				: {
						registry_name: newName,
						registry_logo: base64Logo,
						registry_favicon: base64Favicon,
						registry_theme_id: newThemeId,
						registry_language_id: newLanguageId,
					};

		const result = await saveRegistry(endpoint, {
			method: 'POST',
			body: JSON.stringify(payload),
		});

		if (result?.configuration_id) {
			setConfigurationId(result.configuration_id);
			setRegistryName(newName);
			setImage(newImage);
			setFavicon(newFavicon);
			setThemeId(newThemeId);
			setLanguageId(newLanguageId);
			setIsEditing(false);
			toast.success(t('toast_registry_config_saved'));

			const newLangObj = languages.find(l => l.language_id === newLanguageId);
			if (newLangObj?.language_code) {
				router.replace(pathname, { locale: newLangObj.language_code });
				router.refresh();
			} else {
				window.location.reload();
			}
		}
	};

	return (
		<>
			<TopBar
				breadcrumb={[{ label: t('registry') }]}
				showFilters={false}
				showPagination={false}
				showAddNewButton={false}
			/>

			<div className="mx-7.5 pb-10 max-w-5xl">
				{isLoading ? (
					<div className="bg-neutral-second rounded-[10px] p-12 flex justify-center shadow-sm border border-secondary-second/40">
						<Image src="/images/common/loading.gif" alt="Loading" width={48} height={48} />
					</div>
				) : isEditing ? (
					<EditRegistry
						embedded
						initialName={registryName}
						initialImage={image}
						initialFavicon={favicon}
						initialThemeId={registryData?.registry_theme_id || themeId}
						initialLanguageId={registryData?.registry_language_id || languageId}
						themes={themes}
						themesLoading={themesLoading}
						languages={languages}
						languagesLoading={languagesLoading}
						onSave={handleSave}
						onCancel={() => setIsEditing(false)}
					/>
				) : (
					<div className="relative bg-neutral-second rounded-[10px] p-8  border border-secondary-second/40 flex flex-col gap-8">
						<Can action={CONFIGURATION_REGISTRY_ACTIONS.edit}>
							<button
								type="button"
								onClick={startEditing}
								className="absolute top-6 right-6 z-10 bg-neutral-second px-4 py-2 rounded-[10px] border border-secondary-second shadow-sm flex items-center gap-2 text-sm font-semibold text-neutral-first whitespace-nowrap"
							>
								<SquarePen size={18} strokeWidth={2} />
								<span>{t('edit_registry_details')}</span>
							</button>
						</Can>

						<div className="flex flex-col gap-6 pb-6 border-b border-secondary-second pr-4 md:pr-56">
							<div className="flex flex-col sm:flex-row gap-8 items-start">
								<div className="flex flex-col gap-2 min-w-0 w-full sm:w-auto sm:max-w-[min(100%,28rem)]">
									<span className="text-sm text-neutral-first/60">{t('registry_logo')}</span>
									<div className="h-30 min-w-30 w-full max-w-full relative rounded-[10px] overflow-hidden flex items-center justify-center border border-secondary-second/40 bg-secondary-first/30 px-3">
										{hasCustomLogo ? (
											<Image
												src={resolvedLogo}
												alt={t('registry_logo_alt')}
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
											<div className="w-30 h-30 flex flex-col items-center justify-center text-neutral-first/40 gap-1">
												<ImageIcon size={40} strokeWidth={1.5} />
												<span className="text-xs">{t('no_file_selected')}</span>
											</div>
										)}
									</div>
								</div>
								<div className="flex flex-col gap-2 shrink-0">
									<span className="text-sm text-neutral-first/60">{t('registry_favicon')}</span>
									<div className="w-30 h-30 relative rounded-[10px] overflow-hidden flex items-center justify-center border border-secondary-second/40 bg-secondary-first/30 p-3">
										{hasCustomFavicon ? (
											<Image
												src={resolvedFavicon}
												alt={t('registry_favicon_alt')}
												width={120}
												height={120}
												className="h-24 w-24 object-contain"
												unoptimized
											/>
										) : (
											<div className="w-full h-full flex flex-col items-center justify-center text-neutral-first/40 gap-1">
												<ImageIcon size={40} strokeWidth={1.5} />
												<span className="text-xs">{t('no_file_selected')}</span>
											</div>
										)}
									</div>
								</div>
							</div>
							{!isHorizontalLogo && (
								<div className="flex flex-col gap-2 min-w-0">
									<span className="text-sm text-neutral-first/60">{t('registry_name')}</span>
									<h2 className="text-[26px] font-bold text-primary-second m-0 truncate">
										{resolvedName}
									</h2>
								</div>
							)}
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
							<div className="rounded-[10px] border border-secondary-second p-5 flex flex-col h-full bg-secondary-first/20">
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 rounded-[10px] bg-primary-first/15 flex items-center justify-center text-primary-second shrink-0">
										<Palette size={18} />
									</div>
									<div className="flex flex-col min-w-0">
										<span className="text-sm text-neutral-first/60">{t('registry_theme')}</span>
										<span className="text-base font-semibold text-neutral-first truncate">
											{selectedTheme?.theme_mnemonic || t('no_items_found')}
										</span>
									</div>
								</div>
								<div className="mt-auto pt-3 flex flex-row items-center gap-3 min-h-10">
									{selectedTheme?.is_factory_shipped && (
										<span className="text-xs font-medium text-neutral-first/50 w-fit px-2 py-0.5 rounded-full bg-secondary-second shrink-0">
											Factory
										</span>
									)}
									<Link
										href="/configuration/registry/themes"
										className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-primary-second hover:underline shrink-0"
									>
										{t('registry_themes')}
										<ArrowRight size={14} />
									</Link>
								</div>
							</div>

							<div className="rounded-[10px] border border-secondary-second p-5 flex flex-col h-full bg-secondary-first/20">
								<div className="flex items-center gap-3">
									{selectedLanguage?.language_flag_base64 ? (
										<div className="w-10 h-7 relative rounded-sm overflow-hidden shrink-0 border">
											<Image
												src={selectedLanguage.language_flag_base64}
												alt={selectedLanguage.language_label}
												fill
												className="object-cover"
											/>
										</div>
									) : (
										<div className="w-10 h-10 rounded-[10px] bg-primary-first/15 flex items-center justify-center text-primary-second shrink-0">
											<Languages size={18} />
										</div>
									)}
									<div className="flex flex-col min-w-0">
										<span className="text-sm text-neutral-first/60">{t('registry_language')}</span>
										<span className="text-base font-semibold text-neutral-first truncate">
											{selectedLanguage?.language_label || t('no_items_found')}
										</span>
									</div>
								</div>
								<div className="mt-auto pt-3 flex flex-row items-center gap-3 min-h-10">
									<Link
										href="/configuration/registry/languages"
										className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-primary-second hover:underline shrink-0"
									>
										{t('registry_languages')}
										<ArrowRight size={14} />
									</Link>
								</div>
							</div>

						</div>
					</div>
				)}
			</div>
		</>
	);
};

export default RegistryConfigurationPage;