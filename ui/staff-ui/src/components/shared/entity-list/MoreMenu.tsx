'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LayoutGrid, List, EllipsisVertical } from 'lucide-react';
import { useClickOutside } from '@/shared/hooks/useClickOutside';
import { ViewMode } from './types';

interface MoreMenuProps {
    view: ViewMode;
    onViewChange: (mode: ViewMode) => void;
}

export default function MoreMenu({
    view,
    onViewChange,
}: MoreMenuProps) {
    const t = useTranslations();
    const [kebabOpen, setKebabOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useClickOutside(containerRef, () => setKebabOpen(false), kebabOpen);

    const handleViewChange = (mode: ViewMode) => {
        onViewChange(mode);
        setKebabOpen(false);
    };

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                aria-label="More options"
                aria-haspopup="true"
                aria-expanded={kebabOpen}
                onClick={() => setKebabOpen((prev) => !prev)}
                className="w-10 h-8.5 flex items-center justify-center rounded-[10px] bg-primary-first"
            >
                <EllipsisVertical size={18} />
            </button>

            {kebabOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] z-50 min-w-[180px] bg-neutral-second rounded-[10px] shadow-[0_8px_24px_rgba(42,42,42,0.16)] py-1.5">
                    <button
                        type="button"
                        onClick={() => handleViewChange('card')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-[15px] rounded-[8px] mx-1.5 ${
                            view === 'card'
                                ? 'bg-primary-first font-medium text-neutral-first'
                                : 'text-neutral-first'
                        }`}
                        style={{ width: 'calc(100% - 12px)' }}
                    >
                        <LayoutGrid size={16} />
                        {t.has('card_view') ? t('card_view') : 'Card view'}
                    </button>

                    <button
                        type="button"
                        onClick={() => handleViewChange('list')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-[15px] rounded-[8px] mx-1.5 ${
                            view === 'list'
                                ? 'bg-primary-first font-medium text-neutral-first'
                                : 'text-neutral-first'
                        }`}
                        style={{ width: 'calc(100% - 12px)' }}
                    >
                        <List size={16} />
                        {t.has('list_view') ? t('list_view') : 'List view'}
                    </button>
                </div>
            )}
        </div>
    );
}
