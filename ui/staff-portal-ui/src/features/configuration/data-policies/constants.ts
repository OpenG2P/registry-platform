export const POLICY_TARGET = {
    REGISTER_RECORD: 'REGISTER_RECORD',
    ATTRIBUTE: 'ATTRIBUTE',
    GEO: 'GEO',
} as const;

export type PolicyTargetValue = (typeof POLICY_TARGET)[keyof typeof POLICY_TARGET];

export const POLICY_TARGET_OPTIONS = [
    {
        value: POLICY_TARGET.REGISTER_RECORD,
        labelKey: 'policy_target_register_record',
        isGlobal: false,
    },
    {
        value: POLICY_TARGET.ATTRIBUTE,
        labelKey: 'policy_target_attribute',
        isGlobal: true,
    },
    {
        value: POLICY_TARGET.GEO,
        labelKey: 'policy_target_geo',
        isGlobal: true,
    },
] as const;

export function isGlobalPolicyTarget(target: string): boolean {
    return POLICY_TARGET_OPTIONS.find((option) => option.value === target)?.isGlobal ?? false;
}

export function getPolicyTargetLabelKey(target?: string | null): string | undefined {
    return POLICY_TARGET_OPTIONS.find((option) => option.value === target)?.labelKey;
}

export function resolveRegisterIdForTarget(target: string, registerId: string): string {
    return isGlobalPolicyTarget(target) ? '' : registerId;
}

export function isValidPolicyTarget(target: string): target is PolicyTargetValue {
    return POLICY_TARGET_OPTIONS.some((option) => option.value === target);
}
