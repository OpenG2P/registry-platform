import RequireAction from "@/components/shared/RequireAction";
import { CONFIGURATION_OUTGESTION_TEMPLATES_ACTIONS } from "@/features/shared/permissions";

export default function IngestTemplatesLayout({ children }: { children: React.ReactNode }) {
    return (
        <RequireAction action={CONFIGURATION_OUTGESTION_TEMPLATES_ACTIONS.view}>
            {children}
        </RequireAction>
    );
}
