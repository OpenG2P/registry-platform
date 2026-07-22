import { useState, useEffect, useCallback, useMemo } from 'react';
import { useFetch } from '@/shared/hooks/useFetch';
import { ApprovalTask } from '@/features/approval/types/approval';

export function useApprovalTasks(aweRequestId?: string | null) {
    const [tasks, setTasks] = useState<ApprovalTask[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(true);

    const fetchOptions = useMemo(
        () => ({
            method: 'POST' as const,
            body: JSON.stringify({
                request_id: aweRequestId,
            }),
        }),
        [aweRequestId],
    );

    const { data: tasksResp, loading: tasksLoading, execute } = useFetch<{
        tasks: ApprovalTask[];
        total: number;
    }>({
        url: '/api/awe/tasks-for-request',
        enabled: !!aweRequestId,
        options: fetchOptions,
    });

    useEffect(() => {
        setTasks([]);
        setLoadingTasks(!!aweRequestId);
    }, [aweRequestId]);

    useEffect(() => {
        if (!aweRequestId) {
            setLoadingTasks(false);
            return;
        }
        if (tasksResp?.tasks) {
            setTasks(tasksResp.tasks);
        }
        setLoadingTasks(tasksLoading);
    }, [tasksResp, tasksLoading, aweRequestId]);

    const refetchTasks = useCallback(async () => {
        if (!aweRequestId) return;
        const refreshed = await execute('/api/awe/tasks-for-request', fetchOptions);
        if (refreshed?.tasks) {
            setTasks(refreshed.tasks);
        }
    }, [aweRequestId, execute, fetchOptions]);

    const isInitialLoading = tasks.length === 0 && loadingTasks;

    return { tasks, loadingTasks: isInitialLoading, refetchTasks };
}
