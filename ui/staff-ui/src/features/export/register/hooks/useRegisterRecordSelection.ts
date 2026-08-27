import { useCallback, useEffect, useMemo, useState } from 'react';

export function useRegisterRecordSelection(resetKey: string) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        setSelectedIds(new Set());
    }, [resetKey]);

    const toggle = useCallback((id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const togglePage = useCallback((ids: string[], selected: boolean) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => {
                if (selected) next.add(id);
                else next.delete(id);
            });
            return next;
        });
    }, []);

    const clear = useCallback(() => {
        setSelectedIds(new Set());
    }, []);

    const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

    const selectedCount = selectedIds.size;
    const selectedIdList = useMemo(() => Array.from(selectedIds), [selectedIds]);

    return {
        selectedIds,
        selectedIdList,
        selectedCount,
        toggle,
        togglePage,
        clear,
        isSelected,
    };
}
