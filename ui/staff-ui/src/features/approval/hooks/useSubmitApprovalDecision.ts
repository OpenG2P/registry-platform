import { useCallback } from 'react';
import { useFetch } from '@/shared/hooks/useFetch';
import { toast } from 'react-toastify';
import { useTranslations } from 'next-intl';

export interface ApprovalArtifactContext {
    artifactId: string;
    artifactType: string;
    currentStage: number;
}

export function useSubmitApprovalDecision(
    artifactContext?: ApprovalArtifactContext | null,
    onRefresh?: () => void | Promise<void>,
) {
    const t = useTranslations();

    const { execute: executeDecision } = useFetch<{ decision: unknown }>({
        url: '/api/awe/submit-task-decision',
        enabled: false,
    });

    const submitDecision = useCallback(
        async (taskId: string, action: 'approve' | 'reject', comment: string) => {
            if (!artifactContext) {
                toast.error(t('toast_approval_submit_failed'), { autoClose: 5000 });
                return false;
            }

            const result = (await executeDecision('/api/awe/submit-task-decision', {
                method: 'POST',
                body: JSON.stringify({
                    task_id: taskId,
                    action,
                    comment: comment || null,
                    artifact_id: artifactContext.artifactId,
                    artifact_type: artifactContext.artifactType,
                    current_stage: artifactContext.currentStage,
                }),
            })) as { decision?: unknown } | null;

            if (result?.decision) {
                toast.success(t('toast_approval_submitted'), {
                    position: 'top-right',
                    autoClose: 4000,
                });
                await onRefresh?.();
                return true;
            }

            await onRefresh?.();
            return false;
        },
        [executeDecision, artifactContext, onRefresh, t],
    );

    return { submitDecision };
}
