'use client';

import DataPoliciesListPage from '@/features/configuration/data-policies/DataPoliciesListPage';

export default function ReferenceDataPoliciesPage() {
    return (
        <DataPoliciesListPage
            policyTarget="ATTRIBUTE"
            menuLabelKey="policy_menu_reference_data"
            listPath="/configuration/data-policies/reference-data"
            newPath="/configuration/data-policies/reference-data/new"
        />
    );
}
