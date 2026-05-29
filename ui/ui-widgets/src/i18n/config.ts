import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslations from './locales/en.json';

/**
 * Load translations from the consuming project's locale directory
 * Tries standard paths in order:
 * - /i18/locales/{{lng}}.json (common convention)
 * - /public/i18/locales/{{lng}}.json
 * - /locales/{{lng}}.json
 * - /public/locales/{{lng}}.json
 * - /locales/{{lng}}/translation.json
 * - /public/locales/{{lng}}/translation.json
 */
const loadTranslationsFromProject = async (
  lng: string,
  loadPath?: string | string[]
): Promise<Record<string, any> | null> => {
  const defaultPaths = loadPath || [
    `/i18/locales/${lng}.json`,
    `/public/i18/locales/${lng}.json`,
    `/locales/${lng}.json`,
    `/public/locales/${lng}.json`,
    `/locales/${lng}/translation.json`,
    `/public/locales/${lng}/translation.json`,
  ];

  const paths = Array.isArray(defaultPaths) ? defaultPaths : [defaultPaths];

  for (const path of paths) {
    try {
      const response = await fetch(path);
      if (response.ok) {
        const translations = await response.json();
        return translations;
      }
    } catch (error) {
      // Continue to next path
      continue;
    }
  }

  return null;
};

/**
 * Initialize i18n for the widget library
 * Can be customized by passing custom resources or configuration
 * 
 * If no resources are provided, it will attempt to automatically load translations
 * from the consuming project's locale directory.
 * 
 * If options are provided and the default instance is already initialized,
 * creates a new i18n instance to avoid reinitialization issues.
 */
export const initI18n = async (options?: {
  resources?: Record<string, any>;
  lng?: string;
  fallbackLng?: string;
  debug?: boolean;
  loadPath?: string | string[];
  autoLoad?: boolean;
}) => {
  const {
    resources,
    lng = 'en',
    fallbackLng = 'en',
    debug = false,
    loadPath,
    autoLoad = true, // Auto-load by default
  } = options || {};

  let finalResources = resources;

  // If no resources provided and autoLoad is enabled, try to load from project
  if (!finalResources && autoLoad) {
    const loadedTranslations = await loadTranslationsFromProject(lng, loadPath);
    if (loadedTranslations) {
      finalResources = {
        [lng]: {
          translation: loadedTranslations,
        },
      };
    }
  }

  // Fallback to default English translations if nothing loaded
  if (!finalResources) {
    finalResources = {
      en: {
        translation: enTranslations,
      },
    };
  }

  // If options are provided and default instance is already initialized,
  // create a new instance to avoid reinitialization issues
  if (options && i18n.isInitialized) {
    const newI18n = i18n.createInstance();
    await newI18n
      .use(initReactI18next)
      .init({
        resources: finalResources,
        lng,
        fallbackLng,
        debug,
        interpolation: {
          escapeValue: false, // React already escapes values
        },
        defaultNS: 'translation',
        ns: ['translation'],
      });
    return newI18n;
  }

  // Use default instance (either not initialized yet, or no options provided)
  if (!i18n.isInitialized) {
    await i18n
      .use(initReactI18next)
      .init({
        resources: finalResources,
        lng,
        fallbackLng,
        debug,
        interpolation: {
          escapeValue: false, // React already escapes values
        },
        defaultNS: 'translation',
        ns: ['translation'],
      });
  }

  return i18n;
};

// Initialize with default English translations if not already initialized
// Note: This is async, but we initialize synchronously with default resources
// Auto-loading will happen in WidgetProvider if needed
if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources: {
        en: {
          translation: enTranslations,
        },
      },
      lng: 'en',
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false,
      },
      defaultNS: 'translation',
      ns: ['translation'],
    });
}

export default i18n;
