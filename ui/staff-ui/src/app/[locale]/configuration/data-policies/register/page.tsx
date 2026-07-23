'use client';

import DataPoliciesListPage from '@/features/configuration/data-policies/DataPoliciesListPage';

export default function RegisterDataPoliciesPage() {
    return (
        <DataPoliciesListPage
            policyTarget="REGISTER_RECORD"
            menuLabelKey="policy_menu_register"
            listPath="/configuration/data-policies/register"
            newPath="/configuration/data-policies/register/new"
        />
    );
}
