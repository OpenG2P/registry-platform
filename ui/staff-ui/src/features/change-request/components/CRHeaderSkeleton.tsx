const COLUMN_DIVIDER = 'sm:border-l sm:border-secondary-third/70';

const ChangeRequestHeaderSkeleton = () => {
    return (
        <div className="rounded-[10px] border border-dashed border-primary-second bg-primary-first/20 px-4 py-4 animate-pulse sm:px-6 md:px-10 md:py-5">
            <div className="grid grid-cols-1 items-stretch gap-y-4 sm:grid-cols-2 sm:gap-y-6 xl:grid-cols-4 xl:gap-y-0">
                <KeyValueColumnSkeleton className="xl:pr-6" />
                <KeyValueColumnSkeleton className={`${COLUMN_DIVIDER} sm:px-6`} />
                <KeyValueColumnSkeleton className="xl:border-l xl:border-secondary-third/70 xl:px-6" />
                <AttachedDocumentsSkeleton />
            </div>
        </div>
    );
};

export default ChangeRequestHeaderSkeleton;

const KeyValueColumnSkeleton = ({ className = '' }: { className?: string }) => {
    return (
        <div className={`flex h-full min-w-0 flex-col space-y-2 ${className}`}>
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex w-full gap-0">
                    <div className="h-4.5 w-1/2 pr-2">
                        <div className="h-4.5 w-full max-w-28 rounded bg-neutral-first/20" />
                    </div>
                    <div className="h-4.5 w-1/2">
                        <div className="h-4.5 w-full max-w-32 rounded bg-neutral-first/50" />
                    </div>
                </div>
            ))}
        </div>
    );
};

const AttachedDocumentsSkeleton = () => {
    return (
        <div className={`flex h-full min-w-0 flex-col space-y-2 ${COLUMN_DIVIDER} sm:pl-6`}>
            <div className="flex items-center gap-1">
                <div className="h-4.5 w-40 rounded bg-neutral-first/50" />
                <div className="h-3.5 w-3.5 rounded bg-neutral-first/30" />
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-4.5 w-36 rounded bg-neutral-first/20" />
            ))}
        </div>
    );
};
