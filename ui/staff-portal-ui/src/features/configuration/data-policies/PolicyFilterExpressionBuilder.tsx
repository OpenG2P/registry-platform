'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import {
    POLICY_TARGET,
    isGlobalPolicyTarget,
} from './constants';
import type { PolicyFilterField } from './policyFilterFields';
import FilterSelect from './FilterSelect';
import PolicyConditionValueInput from './PolicyConditionValueInput';
import {
    type FilterConditionState,
    type FilterGroupState,
    type FilterNodeState,
    type FilterRootState,
    type GroupOperator,
    type ConditionOperator,
    createEmptyCondition,
    createEmptyGroup,
    createDefaultFilterRoot,
    getOperatorsForFieldType,
    usesNoValue,
} from './policyFilterExpression';

interface PolicyFilterExpressionBuilderProps {
    root: FilterRootState;
    policyTarget: string;
    fields: PolicyFilterField[];
    fieldsLoading?: boolean;
    onChange: (root: FilterRootState) => void;
    disabled?: boolean;
}

function ConditionRow({
    condition,
    policyTarget,
    fields,
    fieldsLoading,
    onChange,
    onRemove,
    disabled,
}: {
    condition: FilterConditionState;
    policyTarget: string;
    fields: PolicyFilterField[];
    fieldsLoading?: boolean;
    onChange: (c: FilterConditionState) => void;
    onRemove: () => void;
    disabled?: boolean;
}) {
    const t = useTranslations();

    const fieldOptions = useMemo(
        () =>
            fields.map((field) => ({
                label: field.label,
                value: field.id,
            })),
        [fields],
    );

    const selectedField = fields.find((field) => field.id === condition.field_id);
    const operatorOptions = getOperatorsForFieldType(selectedField?.dataType ?? 'string').map(
        (op) => ({ label: t(`filter_operator_${op}`), value: op }),
    );

    const showValue = !usesNoValue(condition.operator);

    return (
        <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] gap-3 items-center rounded-[10px] border border-primary-second/30 bg-neutral-second/40 px-4 py-2">
            <FilterSelect
                options={fieldOptions}
                value={condition.field_id}
                onChange={(fieldId) => {
                    const field = fields.find((item) => item.id === fieldId);
                    const ops = getOperatorsForFieldType(field?.dataType ?? 'string');
                    onChange({
                        ...condition,
                        field_id: fieldId,
                        operator: ops.includes(condition.operator) ? condition.operator : ops[0],
                        valueInput: '',
                    });
                }}
                loading={fieldsLoading}
                placeholder={t('field')}
                disabled={disabled || !fields.length}
            />
            <FilterSelect
                options={operatorOptions}
                value={condition.operator}
                onChange={(op) =>
                    onChange({
                        ...condition,
                        operator: op as ConditionOperator,
                        valueInput: usesNoValue(op as ConditionOperator) ? '' : condition.valueInput,
                    })
                }
                disabled={disabled || !condition.field_id}
                placeholder={t('filter_operator')}
            />
            {showValue ? (
                <PolicyConditionValueInput
                    policyTarget={policyTarget}
                    fieldId={condition.field_id}
                    operator={condition.operator}
                    valueInput={condition.valueInput}
                    onChange={(valueInput) => onChange({ ...condition, valueInput })}
                    disabled={disabled}
                />
            ) : (
                <span />
            )}
            <button
                type="button"
                onClick={onRemove}
                disabled={disabled}
                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] text-secondary-third hover:bg-secondary-first hover:text-toast-failed disabled:opacity-50"
                title={t('remove')}
            >
                <X size={18} />
            </button>
        </div>
    );
}

function GroupEditor({
    group,
    policyTarget,
    fields,
    fieldsLoading,
    depth,
    onChange,
    onRemove,
    onReset,
    disabled,
}: {
    group: FilterGroupState;
    policyTarget: string;
    fields: PolicyFilterField[];
    fieldsLoading?: boolean;
    depth: number;
    onChange: (group: FilterGroupState) => void;
    onRemove?: () => void;
    onReset?: () => void;
    disabled?: boolean;
}) {
    const t = useTranslations();

    const logicOptions = [
        { label: t('filter_logic_and'), value: 'AND' },
        { label: t('filter_logic_or'), value: 'OR' },
    ];

    return (
        <div
            className={`space-y-3 ${depth > 0 ? 'ml-3 border-l-2 border-primary-second/40 pl-3' : ''}`}
        >
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-[10rem] max-w-xs shrink-0">
                    <label className="block text-[16px] font-medium text-neutral-first truncate">
                        {depth === 0 ? t('filter_combine_rules') : t('filter_combine_rules_nested')}
                    </label>
                    <div className="mt-2">
                        <FilterSelect
                            options={logicOptions}
                            value={group.operator}
                            onChange={(op) => onChange({ ...group, operator: op as GroupOperator })}
                            disabled={disabled}
                        />
                    </div>
                    <p className="mt-1 text-sm text-secondary-third leading-snug">
                        {group.operator === 'AND'
                            ? t('filter_combine_rules_and_hint')
                            : t('filter_combine_rules_or_hint')}
                    </p>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 shrink-0 ml-auto">
                    <button
                        type="button"
                        disabled={disabled || !fields.length}
                        onClick={() =>
                            onChange({
                                ...group,
                                children: [...group.children, createEmptyCondition()],
                            })
                        }
                        className="text-sm font-semibold text-primary-second hover:underline disabled:opacity-50"
                    >
                        + {t('condition')}
                    </button>
                    {group.allowNestedGroups !== false && (
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={() =>
                                onChange({
                                    ...group,
                                    children: [...group.children, createEmptyGroup()],
                                })
                            }
                            className="text-sm font-semibold text-neutral-first/70 hover:underline disabled:opacity-50"
                        >
                            + {t('group')}
                        </button>
                    )}
                    {onRemove && (
                        <button
                            type="button"
                            onClick={onRemove}
                            disabled={disabled}
                            className="text-sm font-semibold text-toast-failed hover:underline disabled:opacity-50"
                        >
                            {t('remove')}
                        </button>
                    )}
                    {onReset && (
                        <button
                            type="button"
                            onClick={onReset}
                            disabled={disabled}
                            className="text-sm font-semibold text-secondary-third hover:underline disabled:opacity-50"
                        >
                            {t('reset_filter')}
                        </button>
                    )}
                </div>
            </div>

            {group.children.length > 0 && (
                <div className="space-y-1.5 w-full">
                    {group.children.map((child) =>
                        child.type === 'GROUP' ? (
                            <GroupEditor
                                key={child.id}
                                group={child}
                                policyTarget={policyTarget}
                                fields={fields}
                                fieldsLoading={fieldsLoading}
                                depth={depth + 1}
                                disabled={disabled}
                                onChange={(updated) =>
                                    onChange({
                                        ...group,
                                        children: group.children.map((c) =>
                                            c.id === child.id ? updated : c,
                                        ),
                                    })
                                }
                                onRemove={() =>
                                    onChange({
                                        ...group,
                                        children: group.children.filter((c) => c.id !== child.id),
                                    })
                                }
                            />
                        ) : (
                            <ConditionRow
                                key={child.id}
                                condition={child}
                                policyTarget={policyTarget}
                                fields={fields}
                                fieldsLoading={fieldsLoading}
                                disabled={disabled}
                                onChange={(updated) =>
                                    onChange({
                                        ...group,
                                        children: group.children.map((c) =>
                                            c.id === child.id ? updated : c,
                                        ),
                                    })
                                }
                                onRemove={() =>
                                    onChange({
                                        ...group,
                                        children: group.children.filter((c) => c.id !== child.id),
                                    })
                                }
                            />
                        ),
                    )}
                </div>
            )}
        </div>
    );
}

function getEmptyFieldsMessageKey(policyTarget: string): string {
    if (policyTarget === POLICY_TARGET.ATTRIBUTE) {
        return 'no_attributes_for_filter_fields';
    }
    if (policyTarget === POLICY_TARGET.GEO) {
        return 'no_geo_levels_for_filter_fields';
    }
    return 'select_register_for_filter_fields';
}

export default function PolicyFilterExpressionBuilder({
    root,
    policyTarget,
    fields,
    fieldsLoading,
    onChange,
    disabled,
}: PolicyFilterExpressionBuilderProps) {
    const t = useTranslations();

    if (!fields.length && !fieldsLoading) {
        return (
            <p className="text-[16px] text-neutral-first/50">
                {t(getEmptyFieldsMessageKey(policyTarget))}
            </p>
        );
    }

    return (
        <GroupEditor
            group={root}
            policyTarget={policyTarget}
            fields={fields}
            fieldsLoading={fieldsLoading}
            depth={0}
            onChange={onChange}
            onReset={() => onChange(createDefaultFilterRoot())}
            disabled={disabled}
        />
    );
}

export function canShowFilterBuilder(
    policyTarget: string,
    registerId: string,
): boolean {
    if (isGlobalPolicyTarget(policyTarget)) {
        return true;
    }
    return Boolean(registerId);
}
