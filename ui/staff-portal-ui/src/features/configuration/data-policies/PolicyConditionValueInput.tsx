'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { POLICY_TARGET } from './constants';
import { useAttributeValues } from '@/features/configuration/shared/hooks/useAttributeValues';
import {
    getGeoLevelValueLabel,
    useGeoLevelValues,
} from '@/features/configuration/shared/hooks/useGeoLevelValues';
import FilterSelect from './FilterSelect';
import {
    type ConditionOperator,
    usesMultiValue,
    usesNoValue,
} from './policyFilterExpression';

interface PolicyConditionValueInputProps {
    policyTarget: string;
    fieldId: string;
    operator: ConditionOperator;
    valueInput: string;
    onChange: (valueInput: string) => void;
    disabled?: boolean;
}

function MultiValueSelect({
    options,
    valueInput,
    onChange,
    loading,
    disabled,
    placeholder,
}: {
    options: { label: string; value: string }[];
    valueInput: string;
    onChange: (valueInput: string) => void;
    loading?: boolean;
    disabled?: boolean;
    placeholder?: string;
}) {
    const selected = useMemo(
        () =>
            valueInput
                .split(',')
                .map((part) => part.trim())
                .filter(Boolean),
        [valueInput],
    );

    return (
        <select
            multiple
            value={selected}
            onChange={(event) => {
                const values = Array.from(event.target.selectedOptions).map(
                    (option) => option.value,
                );
                onChange(values.join(', '));
            }}
            disabled={disabled || loading}
            className="min-h-[42px] w-full border border-primary-second rounded-[10px] px-4 py-2 text-[16px] bg-neutral-second outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 focus:border-primary-second disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {!options.length && placeholder && (
                <option value="" disabled>
                    {loading ? 'Loading...' : placeholder}
                </option>
            )}
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
}

function RegisterValueInput({
    operator,
    valueInput,
    onChange,
    disabled,
}: {
    operator: ConditionOperator;
    valueInput: string;
    onChange: (valueInput: string) => void;
    disabled?: boolean;
}) {
    const t = useTranslations();
    const multiValue = usesMultiValue(operator);

    return (
        <input
            type="text"
            value={valueInput}
            onChange={(event) => onChange(event.target.value)}
            placeholder={
                multiValue ? t('filter_values_placeholder') : t('filter_value_placeholder')
            }
            disabled={disabled}
            className="w-full border border-primary-second rounded-[10px] px-4 py-2 text-[16px] bg-neutral-second outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 focus:border-primary-second disabled:opacity-50 disabled:cursor-not-allowed"
        />
    );
}

function AttributeValueInput({
    fieldId,
    operator,
    valueInput,
    onChange,
    disabled,
}: {
    fieldId: string;
    operator: ConditionOperator;
    valueInput: string;
    onChange: (valueInput: string) => void;
    disabled?: boolean;
}) {
    const t = useTranslations();
    const { allAttributeValues, loading } = useAttributeValues(fieldId, 1, 500);
    const options = allAttributeValues.map((value) => ({
        label: value.value_display || value.value_code,
        value: value.value_id,
    }));
    const multiValue = usesMultiValue(operator);

    if (multiValue) {
        return (
            <MultiValueSelect
                options={options}
                valueInput={valueInput}
                onChange={onChange}
                loading={loading}
                disabled={disabled || !fieldId}
                placeholder={t('select_attribute_value')}
            />
        );
    }

    return (
        <FilterSelect
            options={options}
            value={valueInput}
            onChange={onChange}
            loading={loading}
            disabled={disabled || !fieldId}
            placeholder={t('select_attribute_value')}
        />
    );
}

function GeoValueInput({
    fieldId,
    operator,
    valueInput,
    onChange,
    disabled,
}: {
    fieldId: string;
    operator: ConditionOperator;
    valueInput: string;
    onChange: (valueInput: string) => void;
    disabled?: boolean;
}) {
    const t = useTranslations();
    const { allGeoLevelValues, loading } = useGeoLevelValues(fieldId);
    const options = allGeoLevelValues.map((value) => ({
        label: getGeoLevelValueLabel(value),
        value: value.level_value_id,
    }));
    const multiValue = usesMultiValue(operator);

    if (multiValue) {
        return (
            <MultiValueSelect
                options={options}
                valueInput={valueInput}
                onChange={onChange}
                loading={loading}
                disabled={disabled || !fieldId}
                placeholder={t('select_geo_value')}
            />
        );
    }

    return (
        <FilterSelect
            options={options}
            value={valueInput}
            onChange={onChange}
            loading={loading}
            disabled={disabled || !fieldId}
            placeholder={t('select_geo_value')}
        />
    );
}

export default function PolicyConditionValueInput({
    policyTarget,
    fieldId,
    operator,
    valueInput,
    onChange,
    disabled,
}: PolicyConditionValueInputProps) {
    if (usesNoValue(operator)) {
        return <span />;
    }

    if (policyTarget === POLICY_TARGET.ATTRIBUTE) {
        return (
            <AttributeValueInput
                fieldId={fieldId}
                operator={operator}
                valueInput={valueInput}
                onChange={onChange}
                disabled={disabled}
            />
        );
    }

    if (policyTarget === POLICY_TARGET.GEO) {
        return (
            <GeoValueInput
                fieldId={fieldId}
                operator={operator}
                valueInput={valueInput}
                onChange={onChange}
                disabled={disabled}
            />
        );
    }

    return (
        <RegisterValueInput
            operator={operator}
            valueInput={valueInput}
            onChange={onChange}
            disabled={disabled}
        />
    );
}
