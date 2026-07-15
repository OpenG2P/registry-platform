const TEMPLATE_MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024;
const TEMPLATE_ACCEPT = '.json.j2';

function isTemplateFile(file: File): boolean {
    return file.name.toLowerCase().endsWith('.json.j2');
}

export function validateTemplateUpload(
    file: File,
    t: (key: string) => string,
): string | null {
    if (!isTemplateFile(file)) {
        return t('template_file_type_limit');
    }

    if (file.size > TEMPLATE_MAX_FILE_SIZE_BYTES) {
        return t('template_file_size_limit');
    }

    return null;
}

export { TEMPLATE_ACCEPT };
export const TEMPLATE_UPLOAD_HINT_KEY = 'template_upload_hint';
