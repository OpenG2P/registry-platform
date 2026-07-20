import RequireAction from "@/components/shared/RequireAction";
import { CONFIGURATION_ATTRIBUTES_ACTIONS } from "@/features/shared/permissions";

export default function AttributesConfigLayout({ children }: { children: React.ReactNode }) {
    return (
        <RequireAction action={CONFIGURATION_ATTRIBUTES_ACTIONS.view}>
            {children}
        </RequireAction>
    );
}
