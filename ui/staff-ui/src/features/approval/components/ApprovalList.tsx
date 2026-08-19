import { ApprovalTask } from '@/features/approval/types/approval';
import ApprovalCard from '@/features/approval/components/ApprovalCard';
import { useTranslations } from 'next-intl';
import { VERIFICATION_CHANGE_REQUEST_ACTIONS } from '@/features/shared/permissions';
import Can from '@/components/shared/Can';

interface Props {
    tasks: ApprovalTask[];
    isPending: boolean;
    approvalDecisionBlocked?: boolean;
    onSubmitDecision: (taskId: string, action: 'approve' | 'reject', comment: string) => Promise<boolean>;
}

export default function ApprovalList({ tasks, isPending, approvalDecisionBlocked = false, onSubmitDecision }: Props) {
    const t = useTranslations();

    return (
        <Can action={VERIFICATION_CHANGE_REQUEST_ACTIONS.view}>
            <div className="flex flex-col gap-2 rounded-lg">
                <div className="flex items-center justify-center rounded-[10px] bg-primary-first px-6 py-2">
                    <h4 className="m-0 text-[16px] font-medium sm:text-[18px]">{t('approvals')}</h4>
                </div>

                {approvalDecisionBlocked && (
                    <div className="rounded-[10px] bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
                        {t('earlier_pending_cr_approval_blocked')}
                    </div>
                )}

                {tasks.length === 0 ? (
                    <div className="py-4 text-center text-sm text-neutral-first/50">
                        {t('no_approval_tasks')}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
                        {tasks.map((task) => (
                            <ApprovalCard
                                key={task.id}
                                task={task}
                                isPending={isPending}
                                approvalDecisionBlocked={approvalDecisionBlocked}
                                onSubmit={onSubmitDecision}
                            />
                        ))}
                    </div>
                )}
            </div>
        </Can>
    );
}
