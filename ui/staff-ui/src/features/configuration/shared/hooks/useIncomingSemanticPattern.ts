import { useState } from 'react';
import { useFetch } from '@/shared/hooks';
import { IncomingSemanticPattern } from './useAllSemanticPatterns';

export function useIncomingSemanticPattern() {
    const [selectedSemanticPattern, setSelectedSemanticPattern] = useState<IncomingSemanticPattern | undefined>(undefined);
    const { execute, loading, error } = useFetch<IncomingSemanticPattern>();

    const fetchSemanticPattern = async (id: string) => {
        const result = await execute('/api/configuration/ingest/get-semantic-pattern', {
            method: 'POST',
            body: JSON.stringify({ semantic_pattern_id: id })
        });
        if (result) {
            setSelectedSemanticPattern(result);
        }
        return result;
    };

    return {
        selectedSemanticPattern,
        setSelectedSemanticPattern,
        fetchSemanticPattern,
        loading,
        error
    };
}
