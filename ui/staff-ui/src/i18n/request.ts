import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
import { clientSafeConfig } from '@/app/api/_lib/client-safe-config';
import { getOrigin } from '@/app/api/_lib/get-origin';
import { getLanguageMessages } from '@/features/configuration/registry/utils/language.helpers';

export default getRequestConfig(async ({ requestLocale }) => {
    let locale = await requestLocale;

    if (!locale || !routing.locales.includes(locale as any)) {
        locale = routing.defaultLocale;
    }

    const origin = await getOrigin();
    await clientSafeConfig.fetchRegistryConfig(origin);
    const config = clientSafeConfig.getAll();

    let messages = getLanguageMessages(config.language_config);

    if (config.language_config?.language_code !== locale) {
        const dynamicLang = await clientSafeConfig.fetchLanguageConfigByCode(locale as string, origin);
        messages = getLanguageMessages(dynamicLang);
    }

    return {
        locale,
        messages,
    };
});