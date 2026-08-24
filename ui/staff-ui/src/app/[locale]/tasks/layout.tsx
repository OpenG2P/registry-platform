import RequireAction from '@/components/shared/RequireAction';
import { VERIFICATION_CHANGE_REQUEST_ACTIONS } from '@/features/shared/permissions';
import { VERIFICATION_INTAKE_FORM_ACTIONS } from '@/features/shared/permissions';

export default function TasksLayout({ children }: { children: React.ReactNode }) {
    return (
        <RequireAction
            anyOf={[
                VERIFICATION_CHANGE_REQUEST_ACTIONS.create,
                VERIFICATION_INTAKE_FORM_ACTIONS.create,
            ]}
        >
            {children}
        </RequireAction>
    );
}
