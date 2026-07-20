import RequireAction from "@/components/shared/RequireAction";
import { CONFIGURATION_KEY_PATHS_ACTIONS } from "@/features/shared/permissions";

export default function KeyPathsLayout({ children }: { children: React.ReactNode }) {
    return (
        <RequireAction action={CONFIGURATION_KEY_PATHS_ACTIONS.view}>
            {children}
        </RequireAction>
    );
}
