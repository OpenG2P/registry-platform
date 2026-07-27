import { useState } from 'react';
import { useFetch } from '@/shared/hooks';
import { SubscriptionActivityLog } from './useAllSubscriptionActivityLogs';

export function useSubscriptionActivityLog() {
    const [selectedActivityLog, setSelectedActivityLog] = useState<SubscriptionActivityLog | undefined>(undefined);
    const { execute, loading, error } = useFetch<SubscriptionActivityLog>();

    const fetchActivityLog = async (id: string) => {
        const result = await execute('/api/configuration/ingest/get-subscription-activity-log-for-partner', {
            method: 'POST',
            body: JSON.stringify({ subscription_activity_log_id: id })
        });
        if (result) {
            setSelectedActivityLog(result);
        }
        return result;
    };

    return {
        selectedActivityLog,
        setSelectedActivityLog,
        fetchActivityLog,
        loading,
        error
    };
}
