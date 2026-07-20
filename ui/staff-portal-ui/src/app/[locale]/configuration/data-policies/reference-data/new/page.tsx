'use client';

import NewDataPolicyPageContent from '@/features/configuration/data-policies/NewDataPolicyPageContent';

export default function NewReferenceDataPolicyPage() {
    return (
        <NewDataPolicyPageContent
            policyTarget="ATTRIBUTE"
            menuLabelKey="policy_menu_reference_data"
            addPolicyLabelKey="add_reference_data_policy"
            listPath="/configuration/data-policies/reference-data"
        />
    );
}
