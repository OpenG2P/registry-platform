import { useFetch } from '@/shared/hooks';

export type TopicType = 'REGISTER' | 'PARTNER';

export function resolveTopicType(topicType?: string | null): TopicType {
    return topicType === 'PARTNER' ? 'PARTNER' : 'REGISTER';
}

export interface OutgestTopic {
    topic_id: string;
    topic_type: TopicType;
    register_id: string | null;
    register_mnemonic: string | null;
    data_model_id: string | null;
    data_model_mnemonic: string | null;
    partner_id: string | null;
    partner_name: string | null;
    websub_topic: string;
    description: string;
    is_active: boolean;
    websub_register_status: string;
    websub_register_datetime: string;
    websub_register_number_of_attempts: number;
    websub_register_latest_error_message: string | null;
}

export function useAllOutgestTopics(page?: number, pageSize?: number) {
    const { data, loading, error, execute } = useFetch<{
        topics: OutgestTopic[];
        pagination?: {
            number_of_items: number;
            number_of_pages: number;
        };
    }>({
        url: '/api/configuration/outgest/all-topics',
        options: {
            method: 'POST',
            body: JSON.stringify({
                current_page: page,
                page_size: pageSize
            })
        }
    });

    return {
        topics: data?.topics || [],
        pagination: data?.pagination,
        loading,
        error,
        refresh: execute,
    };
}