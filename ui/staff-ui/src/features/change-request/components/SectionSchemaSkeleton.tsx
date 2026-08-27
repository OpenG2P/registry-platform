const ChangeRequestValuesTabsSkeleton = () => {
    return (
        <div>
            <div className="flex flex-wrap gap-2 sm:ml-7.5">
                <div className="h-10 w-36 animate-pulse rounded-t-[10px] bg-primary-first/50 sm:h-11 sm:w-50" />
                <div className="h-10 w-32 animate-pulse rounded-t-[10px] bg-secondary-second sm:h-11 sm:w-44" />
                <div className="h-10 w-36 animate-pulse rounded-t-[10px] bg-secondary-second sm:h-11 sm:w-48" />
            </div>

            <div className="flex flex-col gap-4">
                <div className="rounded-[10px] border border-black/10 bg-neutral-second animate-pulse h-40" />
                <div className="rounded-[10px] border border-black/10 bg-neutral-second animate-pulse h-30" />
            </div>
        </div>
    );
};

export default ChangeRequestValuesTabsSkeleton;