import RequireAction from '@/components/shared/RequireAction';
import { CONFIGURATION_AWE_POLICY_ACTIONS } from '@/features/shared/permissions';

export default function AwePolicyConfigurationLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <RequireAction action={CONFIGURATION_AWE_POLICY_ACTIONS.view}>
            {children}
        </RequireAction>
    );
}
