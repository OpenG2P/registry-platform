import type { RegisterField } from '@/features/configuration/shared/hooks/useRegisterFields';
import type { Attribute } from '@/features/configuration/shared/types/attributes';
import type { GeoLevel } from '@/features/configuration/shared/types/geo';

export type PolicyFilterField = {
    id: string;
    label: string;
    dataType: string;
};

export function fromRegisterFields(fields: RegisterField[]): PolicyFilterField[] {
    return fields.map((field) => ({
        id: field.field_name,
        label: `${field.field_name} (${field.data_type})`,
        dataType: field.data_type,
    }));
}

export function fromAttributes(attributes: Attribute[]): PolicyFilterField[] {
    return attributes.map((attribute) => ({
        id: attribute.attribute_id,
        label: attribute.attribute_display || attribute.attribute_code,
        dataType: 'string',
    }));
}

export function fromGeoLevels(levels: GeoLevel[]): PolicyFilterField[] {
    return levels.map((level) => ({
        id: level.level_id,
        label: level.level_mnemonic || level.level_id,
        dataType: 'string',
    }));
}

export function getPolicyFilterFieldLabel(
    fields: PolicyFilterField[],
    fieldId: string,
): string {
    return fields.find((field) => field.id === fieldId)?.label ?? fieldId;
}
