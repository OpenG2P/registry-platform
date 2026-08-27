import RequireAction from "@/components/shared/RequireAction";
import { INTAKE_FORM_ACTIONS } from "@/features/shared/permissions";

export default function NewIntakeFormLayout({ children }: { children: React.ReactNode }) {
    return (
        <RequireAction action={INTAKE_FORM_ACTIONS.edit}>
            {children}
        </RequireAction>
    );
}