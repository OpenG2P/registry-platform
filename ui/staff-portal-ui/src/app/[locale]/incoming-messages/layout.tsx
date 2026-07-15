import RequireAction from "@/components/shared/RequireAction";
import { INCOMING_MESSAGE_ACTIONS } from "@/features/shared/permissions";

export default function IncomingMessagesLayout({ children }: { children: React.ReactNode }) {
    return (
        <RequireAction action={INCOMING_MESSAGE_ACTIONS.view}>
            {children}
        </RequireAction>
    );
}