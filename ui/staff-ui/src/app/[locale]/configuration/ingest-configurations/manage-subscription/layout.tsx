import RequireAction from "@/components/shared/RequireAction";
import { CONFIGURATION_SUBSCRIPTION_ACTIONS } from "@/features/shared/permissions";

export default function ManageSubscriptionLayout({ children }: { children: React.ReactNode }) {
    return (
        <RequireAction action={CONFIGURATION_SUBSCRIPTION_ACTIONS.view}>
            {children}
        </RequireAction>
    );
}
