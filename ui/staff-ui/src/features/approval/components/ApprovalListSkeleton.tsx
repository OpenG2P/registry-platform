const ApprovalListSkeleton = () => {
    return (
        <div className="flex flex-col gap-4 rounded-[10px] animate-pulse">
            <div className="flex items-center justify-center rounded-[10px] bg-primary-first/40 px-6 py-2">
                <div className="h-5 w-45 rounded bg-neutral-first/30" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
                {Array.from({ length: 2 }).map((_, i) => (
                    <ApprovalCardSkeleton key={i} />
                ))}
            </div>
        </div>
    );
};

export default ApprovalListSkeleton;

const ApprovalCardSkeleton = () => {
    return (
        <div className="flex min-h-[220px] w-full flex-col rounded-[10px] bg-secondary-second/60 p-4 animate-pulse">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 rounded-full bg-secondary-second" />
                <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-4 w-36 rounded bg-secondary-second" />
                    <div className="h-3 w-28 rounded bg-secondary-first" />
                </div>
            </div>
            <div className="mt-4 grid flex-1 grid-cols-2 content-evenly gap-x-4">
                <div className="h-8 w-16 rounded bg-secondary-first" />
                <div className="h-8 w-24 rounded bg-secondary-first" />
                <div className="h-8 w-20 rounded bg-secondary-first" />
                <div className="h-8 w-16 rounded bg-secondary-first" />
            </div>
        </div>
    );
};
