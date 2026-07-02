import { useMemo } from 'react';
import { useFetch } from '@/shared/hooks';
import {
    isGlobalPolicyTarget,
    POLICY_TARGET,
} from '@/features/configuration/data-policies/constants';

export interface DataPolicy {
    policy_id: string;
    policy_mnemonic: string;
    policy_description: string;
    register_id: string;
    policy_target: string;
    policy_type: string;
    policy_filter_expression: Record<string, unknown>;
}

function filterPolicies(
    policies: DataPolicy[],
    policyTarget: string,
    registerId: string,
): DataPolicy[] {
    return policies.filter((policy) => {
        const target = policy.policy_target || POLICY_TARGET.REGISTER_RECORD;
        if (target !== policyTarget) {
            return false;
        }
        if (isGlobalPolicyTarget(policyTarget)) {
            return true;
        }
        return Boolean(registerId) && policy.register_id === registerId;
    });
}

export function usePolicies(
    registerId: string,
    policyTarget: string,
    currentPage: number = 1,
    pageSize: number = 10,
) {
    const enabled = isGlobalPolicyTarget(policyTarget) || !!registerId;

    const { data, loading, error, execute } = useFetch<{
        policies: DataPolicy[];
        pagination?: {
            number_of_items: number;
            number_of_pages: number;
        };
    }>({
        url: '/api/configuration/data-policy/get-policies',
        enabled,
        options: {
            method: 'POST',
            body: JSON.stringify({
                current_page: currentPage,
                page_size: pageSize,
                sort_by: '',
                search_text: '',
                filter_by: '',
            }),
        },
    });

    const policies = useMemo(
        () => filterPolicies(data?.policies ?? [], policyTarget, registerId),
        [data?.policies, policyTarget, registerId],
    );

    return {
        policies,
        pagination: data?.pagination,
        loading,
        error,
        refresh: execute,
    };
}
