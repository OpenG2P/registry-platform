import RequireAction from "@/components/shared/RequireAction";
import { CHANGE_REQUEST_ACTIONS } from "@/features/shared/permissions";

export default function ChangeRequestLayout({ children }: { children: React.ReactNode }) {
    return (
        <RequireAction action={CHANGE_REQUEST_ACTIONS.view}>
            {children}
        </RequireAction>
    );
}