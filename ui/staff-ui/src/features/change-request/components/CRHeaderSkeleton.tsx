const ChangeRequestHeaderSkeleton = () => {
    return (
        <div className="flex flex-col rounded-[10px] border border-dashed border-primary-second bg-primary-first/20 px-4 py-4 animate-pulse sm:px-6 md:px-10 md:py-5">
            <div className="mb-2 h-8 w-40 rounded bg-neutral-first/30 sm:w-60" />

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
                <InfoSectionSkeleton />
                <ColumnSkeleton />
                <ColumnSkeleton />
                <AttachedDocumentsSkeleton />
            </div>
        </div>
    );
};

export default ChangeRequestHeaderSkeleton


const InfoSectionSkeleton = () => {
    return (
        <div className="space-y-2 text-[16px]">
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-2">
                    <div className="h-4.5 w-30 bg-neutral-first/20 rounded" />
                    <div className="h-4.5 w-35 bg-neutral-first/50 rounded" />
                </div>
            ))}
        </div>
    );
};


const ColumnSkeleton = () => {
    return (
        <div className="space-y-2 text-[16px]">
            <div className="border-l-2 border-primary-first pl-6 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex gap-2">
                        <div className="h-4.5 w-50 bg-neutral-first/20 rounded" />
                    </div>
                ))}
            </div>
        </div>
    );
};


const AttachedDocumentsSkeleton = () => {
    return (
        <div className="space-y-2 text-[16px]">
            <div className="pl-6 flex items-center gap-2">
                <div className="h-6 w-35 bg-neutral-first/30 rounded" />
            </div>

            <div className="border-l-2 border-primary-first pl-6 flex flex-col gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <div className="h-4.5 w-40 bg-neutral-first/20 rounded" />
                    </div>
                ))}
            </div>
        </div>
    );
};
