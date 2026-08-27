'use client';

import NewDataPolicyPageContent from '@/features/configuration/data-policies/NewDataPolicyPageContent';

export default function NewAdministrativeAreasPolicyPage() {
    return (
        <NewDataPolicyPageContent
            policyTarget="GEO"
            menuLabelKey="policy_menu_administrative_areas"
            addPolicyLabelKey="add_administrative_areas_policy"
            listPath="/configuration/data-policies/administrative-areas"
        />
    );
}
