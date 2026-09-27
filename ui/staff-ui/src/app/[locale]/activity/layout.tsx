import RequireAction from "@/components/shared/RequireAction";
import { ACTIVITY_ACTIONS } from "@/features/shared/permissions";

export default function ActivityLayout({ children }: { children: React.ReactNode }) {
    return <RequireAction action={ACTIVITY_ACTIONS.view}>{children}</RequireAction>;
}
