import { useWidgetContext } from '../components/WidgetProvider';

export const useWidgetTranslation = () => {
  const { translate: translateFunction } = useWidgetContext();

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

    if (translateFunction) {
      return translateFunction(keyOrString, options) || options?.defaultValue || keyOrString;
    }

    return options?.defaultValue || keyOrString;
  };

  const translateConfig = (
    value: string | undefined | null,
    fallback?: string
  ): string => {
    if (!value) {
      return fallback || '';
    }

    if (translateFunction) {
      try {
        const translated = translateFunction(value, { defaultValue: value });

        if (!translated || translated === value) {
          return value;
        }

        return translated;
      } catch {
        return value;
      }
    }

    return value;
  };

  return {
    t: translate,
    translate,
    translateConfig,
  };
};
