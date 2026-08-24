'use client';

import { JsonEditor } from 'json-edit-react';
import { TranslationMap } from '../utils/language.helpers';

interface TranslationJsonEditorPanelProps {
    editorKey: string;
    rootName: string;
    data: TranslationMap;
    setData: (next: TranslationMap) => void;
    searchQuery: string;
    onSearchChange: (value: string) => void;
    searchLabel: string;
    searchPlaceholder: string;
    searchInputHeightClass?: string;
}

export default function TranslationJsonEditorPanel({
    editorKey,
    rootName,
    data,
    setData,
    searchQuery,
    onSearchChange,
    searchLabel,
    searchPlaceholder,
    searchInputHeightClass = 'h-10',
}: TranslationJsonEditorPanelProps) {
    return (
        <>
            <div className="flex items-center gap-3 w-full lg:w-[520px] p-3">
                <label className="text-[16px] font-semibold text-neutral-first whitespace-nowrap">
                    {searchLabel}:
                </label>
                <input
                    value={searchQuery}
                    onChange={event => onSearchChange(event.target.value)}
                    placeholder={searchPlaceholder}
                    className={`${searchInputHeightClass} w-full px-3 rounded-[10px] border border-primary-second outline-none text-sm`}
                />
            </div>
            <div className="p-3 max-h-[560px] overflow-y-auto">
                <JsonEditor
                    key={editorKey}
                    data={data}
                    setData={next => setData(next as TranslationMap)}
                    rootName={rootName}
                    collapse={false}
                    indent={2}
                    maxWidth="100%"
                    searchText={searchQuery}
                    searchFilter="all"
                />
            </div>
        </>
    );
}