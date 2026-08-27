'use client';

import NewDataPolicyPageContent from '@/features/configuration/data-policies/NewDataPolicyPageContent';

export default function NewRegisterDataPolicyPage() {
    return (
        <NewDataPolicyPageContent
            policyTarget="REGISTER_RECORD"
            menuLabelKey="policy_menu_register"
            addPolicyLabelKey="add_register_policy"
            listPath="/configuration/data-policies/register"
        />
    );
}
