'use client';

import DataPoliciesListPage from '@/features/configuration/data-policies/DataPoliciesListPage';

export default function AdministrativeAreasDataPoliciesPage() {
    return (
        <DataPoliciesListPage
            policyTarget="GEO"
            menuLabelKey="policy_menu_administrative_areas"
            listPath="/configuration/data-policies/administrative-areas"
            newPath="/configuration/data-policies/administrative-areas/new"
        />
    );
}
