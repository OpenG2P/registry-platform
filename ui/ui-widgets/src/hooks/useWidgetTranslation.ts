import { useWidgetContext } from '../components/WidgetProvider';

/**
 * Custom hook for widget translations
 * Provides translation function with widget-specific namespace and fallback support
 */
export const useWidgetTranslation = () => {
  const { translate: translateFunction } = useWidgetContext();

  /**
   * Translate a key with flexible namespace support
   * Supports translation keys in various formats and direct strings
   * 
   * Translation key formats supported:
   * - "widgets:common.addItem" - Namespaced key (for widget-specific translations)
   * - "Name" - Direct string (will be looked up in flat translation structure)
   * - "sections.personalDetails" - Nested key (for backward compatibility)
   * 
   * With flat translation structure, direct strings like "Name" are automatically
   * translated by looking them up in the translation resources.
   * 
   * @param keyOrString - Translation key (e.g., "widgets:common.addItem") or direct string (e.g., "Name")
   * @param options - Translation options (interpolation values, default value, etc.)
   * @returns Translated string or original string if translation not found
   */
  const translate = (
    keyOrString: string | undefined | null,
    options?: {
      defaultValue?: string;
      [key: string]: any;
    }
  ): string => {
    if (!keyOrString) {
      return options?.defaultValue || '';
    }

    // Use the provided translation function or fallback to the key
    if (translateFunction) {
      return translateFunction(keyOrString, options) || options?.defaultValue || keyOrString;
    }
    
    // Fallback to key if no translation function available
    return options?.defaultValue || keyOrString;
  };

  /**
   * Translate widget config property
   * Attempts to translate the value, but if translation is not found,
   * returns the original value as-is (graceful fallback)
   * 
   * This function will:
   * - Try to translate any string value
   * - If translation exists, use the translated value
   * - If translation doesn't exist (returns same value or throws), use original value
   * - This prevents errors when literal strings like "XXXX-XXXX-XXXX" are used
   */
  const translateConfig = (
    value: string | undefined | null,
    fallback?: string
  ): string => {
    if (!value) {
      return fallback || '';
    }
    
    // Try to translate the value
    if (translateFunction) {
      try {
        // Pass defaultValue to ensure we get the original value if translation fails
        const translated = translateFunction(value, { defaultValue: value });
        
        // If translation returns empty, null, undefined, or the exact same value,
        // it means no translation was found - return the original value
        if (!translated || translated === value) {
          return value;
        }
        
        // Translation found, return it
        return translated;
      } catch (error) {
        // If translation throws an error (e.g., missing key warning), return original value
        return value;
      }
    }
    
    // No translation function available, return value as-is
    return value;
  };

  // No need of this getLanguage and changeLanguage functions

  /**
   * Get current language
   */
  // const getLanguage = (): string => {
  //   return i18n.language || 'en';
  // };

  /**
   * Change language
   */
  // const changeLanguage = (lng: string): Promise<void> => {
  //   return i18n.changeLanguage(lng).then(() => undefined);
  // };

  return {
    t: translate,
    translate,
    translateConfig,
    // getLanguage,
    // changeLanguage,
    // i18n: null,
  };
};
