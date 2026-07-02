'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { TopBar } from '@/components/shared';
import { usePagination } from '@/shared/hooks';
import { useFetch } from '@/shared/hooks/useFetch';
import { useRuntimeConfig } from '@/context/RuntimeConfigContext';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import {
    useAllRegister,
    usePolicies,
    type DataPolicy,
} from '@/features/configuration/shared';
import {
    DataTable,
    DeleteButton,
    ViewButton,
    CustomDropdown,
} from '@/features/configuration/shared/components';
import ConfirmRemovePopup from '@/features/configuration/shared/components/ConfirmRemovePopup';
import { ViewPolicyModal } from '@/features/configuration/data-policies';
import {
    POLICY_TARGET,
    POLICY_TARGET_OPTIONS,
    getPolicyTargetLabelKey,
    isGlobalPolicyTarget,
    isValidPolicyTarget,
} from '@/features/configuration/data-policies/constants';

const DataPoliciesPage = () => {
    const t = useTranslations();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [currentPage, setCurrentPage] = useState(1);
    const [modalType, setModalType] = useState<'view' | null>(null);
    const [showPopup, setShowPopup] = useState(false);
    const [selectedPolicy, setSelectedPolicy] = useState<DataPolicy | null>(null);

    const { config } = useRuntimeConfig();
    const { execute: removePolicy } = useFetch();
    const { registers, loading: registersLoading } = useAllRegister(1, 100);
    const [selectedRegisterId, setSelectedRegisterId] = useState('');
    const firstRegisterId = registers[0]?.register_id ?? '';

    const initialPolicyTargetParam = searchParams.get('policyTarget')?.trim() ?? '';
    const [selectedPolicyTarget, setSelectedPolicyTarget] = useState<string>(
        isValidPolicyTarget(initialPolicyTargetParam)
            ? initialPolicyTargetParam
            : POLICY_TARGET.REGISTER_RECORD,
    );

    const isRegisterTarget = selectedPolicyTarget === POLICY_TARGET.REGISTER_RECORD;
    const canListPolicies = isGlobalPolicyTarget(selectedPolicyTarget) || !!selectedRegisterId;

    const { policies, pagination, loading, refresh } = usePolicies(
        selectedRegisterId,
        selectedPolicyTarget,
        currentPage,
        config.pageSize || 10,
    );

    useEffect(() => {
        if (!isRegisterTarget || registersLoading || !firstRegisterId) return;

        const urlRegisterId = searchParams.get('registerId')?.trim() ?? '';
        const urlRegisterIsValid =
            Boolean(urlRegisterId) &&
            registers.some((register) => register.register_id === urlRegisterId);

        setSelectedRegisterId((prev) => {
            if (urlRegisterIsValid) return urlRegisterId;
            if (prev && registers.some((register) => register.register_id === prev)) return prev;
            return firstRegisterId;
        });
    }, [isRegisterTarget, registersLoading, firstRegisterId, searchParams, registers]);

    useEffect(() => {
        const urlPolicyTarget = searchParams.get('policyTarget')?.trim() ?? '';
        if (!isValidPolicyTarget(urlPolicyTarget)) return;
        setSelectedPolicyTarget(urlPolicyTarget);
    }, [searchParams]);

    useEffect(() => {
        if (searchParams.get('created') === '1') {
            refresh();
        }
    }, [searchParams, refresh]);

    const policyTargetOptions = useMemo(
        () =>
            POLICY_TARGET_OPTIONS.map((option) => ({
                label: t(option.labelKey),
                value: option.value,
            })),
        [t],
    );

    const registerOptions = useMemo(
        () =>
            (registers || []).map((register) => ({
                label: register.register_mnemonic || register.register_id,
                value: register.register_id,
            })),
        [registers],
    );

    const { pageStart, pageEnd, total } = usePagination({
        totalItems: pagination?.number_of_items || policies.length,
        currentPage,
        pageSize: config.pageSize || 10,
        currentCount: policies.length,
    });

    const handlePrev = () => setCurrentPage((prev) => Math.max(1, prev - 1));
    const handleNext = () => setCurrentPage((prev) => prev + 1);

    const handleRegisterChange = (registerId: string) => {
        setSelectedRegisterId(registerId);
        setCurrentPage(1);
    };

    const handlePolicyTargetChange = (policyTarget: string) => {
        setSelectedPolicyTarget(policyTarget);
        setCurrentPage(1);
    };

    const proceedDelete = async (policyId: string) => {
        const result = await removePolicy('/api/configuration/data-policy/remove-policy', {
            method: 'POST',
            body: JSON.stringify({ policy_id: policyId }),
        });

        if (result?.policy_id) {
            toast.success(t('toast_policy_removed'));
            refresh();
        } else {
            toast.error(t('toast_policy_remove_failed'));
        }
    };

    const handleDelete = (policy: DataPolicy) => {
        setSelectedPolicy(policy);
        setShowPopup(true);
    };

    const confirmDelete = async () => {
        if (!selectedPolicy) return;
        await proceedDelete(selectedPolicy.policy_id);
        setShowPopup(false);
        setSelectedPolicy(null);
    };

    const columns = [
        { key: 'policy_mnemonic', label: t('policy_mnemonic') },
        { key: 'policy_description', label: t('policy_description') },
        {
            key: 'policy_target',
            label: t('policy_target'),
            render: (item: DataPolicy) => {
                const labelKey = getPolicyTargetLabelKey(item.policy_target);
                return labelKey ? t(labelKey) : item.policy_target || '—';
            },
        },
        { key: 'policy_type', label: t('policy_type') },
    ];

    const buildNewPolicyHref = () => {
        const params = new URLSearchParams();
        params.set('policyTarget', selectedPolicyTarget);
        if (isRegisterTarget && selectedRegisterId) {
            params.set('registerId', selectedRegisterId);
        }
        return `/configuration/data-policies/new?${params.toString()}`;
    };

    return (
        <>
            <TopBar
                breadcrumb={[{ label: t('data_policies') }]}
                showFilters={false}
                showPagination={canListPolicies}
                showAddNewButton={canListPolicies}
                addNewButtonText={t('add_new_policy')}
                onAddNewButton={() => router.push(buildNewPolicyHref())}
                pageStart={pageStart}
                pageEnd={pageEnd}
                total={total}
                onPrev={handlePrev}
                onNext={handleNext}
            />

            <div className="px-7.5 pb-4 flex flex-row flex-wrap items-end gap-4">
                <div className="w-56">
                    <CustomDropdown
                        label={t('policy_target')}
                        options={policyTargetOptions}
                        value={selectedPolicyTarget}
                        onChange={handlePolicyTargetChange}
                    />
                </div>
                {isRegisterTarget ? (
                    <div className="w-56">
                        <CustomDropdown
                            label={t('register')}
                            options={registerOptions}
                            value={selectedRegisterId}
                            onChange={handleRegisterChange}
                            loading={registersLoading}
                            placeholder={t('select_register')}
                        />
                    </div>
                ) : null}
            </div>

            {!canListPolicies ? (
                <div className="px-7.5 text-sm text-secondary-third text-center py-8">
                    {t('select_register_to_view_policies')}
                </div>
            ) : (
                <DataTable
                    columns={columns}
                    data={policies}
                    loading={loading}
                    rowKey={(item) => item.policy_id}
                    actions={(item) => (
                        <>
                            <ViewButton
                                label={t('view')}
                                onClick={() => {
                                    setSelectedPolicy(item);
                                    setModalType('view');
                                }}
                            />
                            <DeleteButton
                                label={t('remove')}
                                onClick={() => handleDelete(item)}
                            />
                        </>
                    )}
                />
            )}

            {showPopup && (
                <ConfirmRemovePopup
                    onClose={() => {
                        setShowPopup(false);
                        setSelectedPolicy(null);
                    }}
                    onConfirm={confirmDelete}
                    messageKey="confirm_remove_policy"
                />
            )}

            {modalType === 'view' && (
                <ViewPolicyModal
                    data={selectedPolicy}
                    onClose={() => {
                        setModalType(null);
                        setSelectedPolicy(null);
                    }}
                />
            )}
        </>
    );
};

export default DataPoliciesPage;
