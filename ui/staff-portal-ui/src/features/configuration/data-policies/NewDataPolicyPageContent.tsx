'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'react-toastify';
import { useRouter } from '@/i18n/navigation';
import { TopBar } from '@/components/shared';
import { useFetch } from '@/shared/hooks';
import {
    useAllRegister,
    useAllAttributes,
    useG2pGeoLevels,
} from '@/features/configuration/shared';
import { useRegisterFields } from '@/features/configuration/shared/hooks/useRegisterFields';
import {
    CustomDropdown,
    InputField,
    TextAreaField,
} from '@/features/configuration/shared/components';
import PolicyFilterExpressionBuilder, {
    canShowFilterBuilder,
} from '@/features/configuration/data-policies/PolicyFilterExpressionBuilder';
import AdministrativeAreasPolicyBuilder from '@/features/configuration/data-policies/AdministrativeAreasPolicyBuilder';
import GeoPolicyPreview from '@/features/configuration/data-policies/GeoPolicyPreview';
import PolicyFilterPreview from '@/features/configuration/data-policies/PolicyFilterPreview';
import { orderGeoLevelsByHierarchy } from '@/features/configuration/data-policies/geoLevelUtils';
import { toGeoPolicyFilterExpression } from '@/features/configuration/data-policies/geoLocationSerialization';
import type { GeoLocationSelection } from '@/features/configuration/data-policies/geoLocationTypes';
import {
    fromAttributes,
    fromRegisterFields,
} from '@/features/configuration/data-policies/policyFilterFields';
import {
    createDefaultFilterRoot,
    serializeFilterExpression,
    validateFilterExpression,
    type FilterRootState,
} from '@/features/configuration/data-policies/policyFilterExpression';

const POLICY_TYPES = ['ALLOW', 'DENY'] as const;

interface NewDataPolicyPageContentProps {
    policyTarget: string;
    menuLabelKey: string;
    addPolicyLabelKey: string;
    listPath: string;
}

export default function NewDataPolicyPageContent({
    policyTarget,
    menuLabelKey,
    addPolicyLabelKey,
    listPath,
}: NewDataPolicyPageContentProps) {
    const t = useTranslations();
    const router = useRouter();
    const searchParams = useSearchParams();

    const { execute: addPolicy } = useFetch();
    const { registers, loading: registersLoading } = useAllRegister(1, 100);

    const initialRegisterId = searchParams.get('registerId')?.trim() ?? '';

    const [registerId, setRegisterId] = useState(initialRegisterId);
    const [policyMnemonic, setPolicyMnemonic] = useState('');
    const [policyDescription, setPolicyDescription] = useState('');
    const [policyType, setPolicyType] = useState<string>('ALLOW');
    const [filterRoot, setFilterRoot] = useState<FilterRootState>(createDefaultFilterRoot());
    const [geoLocations, setGeoLocations] = useState<GeoLocationSelection[]>([]);
    const [saving, setSaving] = useState(false);

    const lockRegister = Boolean(initialRegisterId);
    const isRegisterTarget = policyTarget === 'REGISTER_RECORD';
    const isGeoTarget = policyTarget === 'GEO';

    const { fields: registerFields, loading: registerFieldsLoading } = useRegisterFields(
        isRegisterTarget ? registerId : '',
    );
    const { attributes, loading: attributesLoading } = useAllAttributes(1, 500);
    const { geoLevels: g2pGeoLevels, loading: g2pGeoLevelsLoading } = useG2pGeoLevels();
    const orderedGeoLevels = useMemo(
        () => orderGeoLevelsByHierarchy(g2pGeoLevels),
        [g2pGeoLevels],
    );

    useEffect(() => {
        setRegisterId(initialRegisterId);
    }, [initialRegisterId]);

    useEffect(() => {
        if (!isRegisterTarget || initialRegisterId || registersLoading || !registers?.length) {
            return;
        }
        setRegisterId((current) => current || registers[0].register_id);
    }, [isRegisterTarget, initialRegisterId, registers, registersLoading]);

    useEffect(() => {
        if (isGeoTarget) {
            setGeoLocations([]);
            return;
        }
        setFilterRoot(createDefaultFilterRoot());
    }, [registerId, policyTarget, isGeoTarget]);

    const registerOptions = useMemo(
        () =>
            (registers || []).map((register) => ({
                label: register.register_mnemonic || register.register_id,
                value: register.register_id,
            })),
        [registers],
    );

    const policyTypeOptions = useMemo(
        () => POLICY_TYPES.map((type) => ({ label: type, value: type })),
        [],
    );

    const filterFields = useMemo(() => {
        if (policyTarget === 'ATTRIBUTE') {
            return fromAttributes(attributes);
        }
        return fromRegisterFields(registerFields);
    }, [policyTarget, attributes, registerFields]);

    const fieldsLoading = useMemo(() => {
        if (policyTarget === 'ATTRIBUTE') return attributesLoading;
        return registerFieldsLoading;
    }, [policyTarget, attributesLoading, registerFieldsLoading]);

    const listHref = useMemo(() => {
        if (!isRegisterTarget || !registerId) {
            return listPath;
        }

        const params = new URLSearchParams();
        params.set('registerId', registerId);
        return `${listPath}?${params.toString()}`;
    }, [isRegisterTarget, registerId, listPath]);

    const handleCancel = () => {
        router.push(listHref);
    };

    const handleSubmit = async () => {
        if (isRegisterTarget && !registerId) {
            toast.warn(t('register_required'));
            return;
        }
        if (!policyMnemonic.trim()) {
            toast.warn(t('policy_mnemonic_required'));
            return;
        }
        if (isGeoTarget) {
            if (geoLocations.length === 0) {
                toast.warn(t('policy_filter_expression_required'));
                return;
            }
        } else if (!validateFilterExpression(filterRoot)) {
            toast.warn(t('policy_filter_expression_required'));
            return;
        }

        setSaving(true);
        try {
            const policyFilterExpression = isGeoTarget
                ? toGeoPolicyFilterExpression(geoLocations)
                : serializeFilterExpression(filterRoot, filterFields);

            const result = await addPolicy('/api/configuration/data-policy/add-policy', {
                method: 'POST',
                body: JSON.stringify({
                    register_id: policyTarget === 'REGISTER_RECORD' ? registerId : '',
                    policy_target: policyTarget,
                    policy_mnemonic: policyMnemonic.trim(),
                    policy_description: policyDescription.trim(),
                    policy_type: policyType,
                    policy_filter_expression: policyFilterExpression,
                }),
            });

            if (result?.policy_id) {
                toast.success(t('toast_policy_created'));
                router.push(`${listHref}${listHref.includes('?') ? '&' : '?'}created=1`);
            }
        } finally {
            setSaving(false);
        }
    };

    const showFilterBuilder = canShowFilterBuilder(policyTarget, registerId);

    return (
        <>
            <TopBar
                breadcrumb={[
                    { label: t('data_policies'), href: listPath },
                    { label: t(menuLabelKey), href: listHref },
                    { label: t(addPolicyLabelKey) },
                ]}
                showFilters={false}
                showPagination={false}
                showAddNewButton={false}
            />

            <div className="mx-7.5 flex flex-col gap-5 pb-10 font-roboto">
                <div className="bg-neutral-second rounded-[10px] p-6 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="w-9 h-9 rounded-[10px] bg-secondary-first hover:bg-secondary-second flex items-center justify-center transition-colors"
                            aria-label={t('cancel')}
                        >
                            <ArrowLeft size={20} className="text-neutral-first" />
                        </button>
                        <h1 className="text-lg font-semibold text-neutral-first m-0">
                            {t(addPolicyLabelKey)}
                        </h1>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={saving}
                            className="px-5 h-8.5 rounded-[10px] bg-secondary-second text-neutral-first/70 text-sm font-semibold hover:bg-secondary-third transition-colors disabled:opacity-50"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={saving}
                            className="px-5 h-8.5 rounded-[10px] bg-neutral-first text-neutral-second text-sm font-semibold transition-colors shadow-lg disabled:opacity-50"
                        >
                            {t('save')}
                        </button>
                    </div>
                </div>

                <div className="bg-neutral-second rounded-[10px] p-6">
                    <h2 className="text-base font-semibold text-neutral-first mb-4">
                        {t('policy_details')}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
                        {isRegisterTarget ? (
                            <CustomDropdown
                                label={t('register')}
                                options={registerOptions}
                                value={registerId}
                                onChange={setRegisterId}
                                loading={registersLoading}
                                placeholder={t('select_register')}
                                disabled={lockRegister}
                            />
                        ) : null}
                        <CustomDropdown
                            label={t('policy_type')}
                            options={policyTypeOptions}
                            value={policyType}
                            onChange={setPolicyType}
                        />
                        <div className="md:col-span-2">
                            <InputField
                                label={t('policy_mnemonic')}
                                value={policyMnemonic}
                                onChange={setPolicyMnemonic}
                                placeholder={t('enter_policy_mnemonic')}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <TextAreaField
                                label={t('policy_description')}
                                value={policyDescription}
                                onChange={setPolicyDescription}
                                placeholder={t('enter_policy_description')}
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-neutral-second rounded-[10px] p-6">
                    <h2 className="text-base font-semibold text-neutral-first mb-4">
                        {t('filter_rules')}
                    </h2>
                    {!showFilterBuilder ? (
                        <p className="text-[16px] text-neutral-first/50">
                            {t('select_register_for_filter_fields')}
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] gap-6 items-stretch">
                            {isGeoTarget ? (
                                <AdministrativeAreasPolicyBuilder
                                    geoLevels={orderedGeoLevels}
                                    geoLevelsLoading={g2pGeoLevelsLoading}
                                    locations={geoLocations}
                                    onChange={setGeoLocations}
                                />
                            ) : (
                                <PolicyFilterExpressionBuilder
                                    root={filterRoot}
                                    policyTarget={policyTarget}
                                    fields={filterFields}
                                    fieldsLoading={fieldsLoading}
                                    onChange={setFilterRoot}
                                />
                            )}
                            <div className="xl:sticky xl:top-4 flex flex-col min-h-full">
                                {isGeoTarget ? (
                                    <GeoPolicyPreview locations={geoLocations} />
                                ) : (
                                    <PolicyFilterPreview
                                        root={filterRoot}
                                        fields={filterFields}
                                    />
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
