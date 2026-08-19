export const STATIC_INPUT_MECHANISMS = [
    {
        mechanism_id: 'intake-form',
        mechanism_type: 'INTAKE_FORM' as const,
        labelKey: 'intake_forms',
    },
    {
        mechanism_id: 'import-file',
        mechanism_type: 'IMPORT_FILE' as const,
        labelKey: 'import_from_file',
    },
    {
        mechanism_id: 'vc',
        mechanism_type: 'VERIFIABLE_CREDENTIAL' as const,
        labelKey: 'import_from_vc',
    },
] as const;
