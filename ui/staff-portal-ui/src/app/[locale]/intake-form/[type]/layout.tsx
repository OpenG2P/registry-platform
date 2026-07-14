import RequireAction from "@/components/shared/RequireAction";
import { INTAKE_FORM_ACTIONS } from "@/features/shared/permissions";

export default function IntakeFormLayout({ children }: { children: React.ReactNode }) {
    return (
        <RequireAction action={INTAKE_FORM_ACTIONS.view}>
            {children}
        </RequireAction>
    );
}