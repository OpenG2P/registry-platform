import RequireAction from "@/components/shared/RequireAction";
import { CONFIGURATION_REGISTERS_ACTIONS } from "@/features/shared/permissions";

export default function RegistersConfigLayout({ children }: { children: React.ReactNode }) {
    return (
        <RequireAction action={CONFIGURATION_REGISTERS_ACTIONS.view}>
            {children}
        </RequireAction>
    );
}