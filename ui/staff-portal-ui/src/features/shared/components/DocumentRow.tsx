export interface DocumentItem {
    document_id?: string;
    document_store_id?: string;
    label?: string;
    document_label?: string;
    source_filename?: string;
    presigned_url?: string;
}

export function DocumentRow({ doc }: { doc: DocumentItem }) {
    const label = doc.label || doc.document_label || '—';
    const filename = doc.source_filename || '—';

    return (
        <div className="flex w-full overflow-hidden leading-relaxed text-neutral-first">
            <span
                className="w-1/2 min-w-0 truncate text-[16px] font-normal text-neutral-first/50"
                title={label}
            >
                {label}:{' '}
            </span>
            <span className="w-1/2 min-w-0 truncate text-[14px] font-normal">
                {doc.presigned_url ? (
                    <a
                        href={doc.presigned_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate font-normal text-toast-info hover:underline"
                        title={filename}
                    >
                        {filename}
                    </a>
                ) : (
                    <span className="truncate text-neutral-first" title={filename}>
                        {filename}
                    </span>
                )}
            </span>
        </div>
    );
}
