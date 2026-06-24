import type { LanguageConfig } from '@/app/api/_lib/client-safe-config.types';
import sampleCore from '../../../../../sample-locale/en/core.json';

export type TranslationValue =
    | string
    | number
    | boolean
    | TranslationValue[]
    | { [key: string]: TranslationValue };

export type TranslationMap = Record<string, TranslationValue>;

export function toTranslationMap(input: unknown): TranslationMap {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return {};
    }
    return { ...(input as TranslationMap) };
}

// English core translations are bundled as a compile-time fallback for platform UI.
const EN_FALLBACK: TranslationMap = toTranslationMap(sampleCore);

/** Merges English fallback, then API core/domain (API wins on duplicate keys). */
export function getLanguageMessages(
    language?: Pick<LanguageConfig, 'core_translation' | 'domain_translation'> | null
): TranslationMap {
    const core = toTranslationMap(language?.core_translation);
    const domain = toTranslationMap(language?.domain_translation);
    return { ...EN_FALLBACK, ...core, ...domain };
}


export const readAndValidateJson = (
    file: File,
    options?: { allowEmpty?: boolean }
): Promise<TranslationMap> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                const json = JSON.parse(content);
                
                if (typeof json !== 'object' || json === null || Array.isArray(json)) {
                    reject(new Error('Invalid JSON: Must be a JSON object'));
                    return;
                }

                const map = toTranslationMap(json);
                if (Object.keys(map).length === 0 && !options?.allowEmpty) {
                    reject(new Error('Invalid JSON: Must contain at least one valid key/value pair'));
                    return;
                }

                resolve(map);
            } catch (error) {
                reject(new Error('Invalid JSON file'));
            }
        };
        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };
        reader.readAsText(file);
    });
};
