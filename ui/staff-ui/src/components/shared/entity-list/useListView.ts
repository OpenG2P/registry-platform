'use client';

import { useState } from 'react';
import { ViewMode } from './types';

export function useListView(defaultView: ViewMode = 'card', storageKey?: string) {
    const [view, setViewState] = useState<ViewMode>(() => {
        if (storageKey && typeof window !== 'undefined') {
            const saved = localStorage.getItem(storageKey);
            if (saved === 'card' || saved === 'list') return saved as ViewMode;
        }
        return defaultView;
    });

    const setView = (mode: ViewMode) => {
        setViewState(mode);
        if (storageKey && typeof window !== 'undefined') {
            localStorage.setItem(storageKey, mode);
        }
    };

    return { view, setView };
}
