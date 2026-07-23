import RequireAction from "@/components/shared/RequireAction";
import { REGISTER_ACTIONS } from "@/features/shared/permissions";

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
    return (
        <RequireAction action={REGISTER_ACTIONS.view}>
            {children}
        </RequireAction>
    );
}