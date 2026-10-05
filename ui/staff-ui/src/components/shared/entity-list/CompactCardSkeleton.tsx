'use client';

export default function CompactCardSkeleton({ isEven = false }: { isEven?: boolean }) {
    const bar = 'h-4 bg-secondary-third rounded animate-pulse';

    return (
        <div
            className={`flex items-center gap-4 sm:gap-6 px-4 sm:px-6 lg:px-8 p-4 w-full overflow-hidden ${
                isEven ? 'bg-secondary-second/25' : 'bg-neutral-second'
            }`}
        >
            <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-secondary-third rounded-md shrink-0 animate-pulse" />
            <div className="flex-1 min-w-0 space-y-2">
                <div className={`${bar} w-2/3`} />
                <div className={`${bar} w-1/2`} />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
                <div className={`${bar} w-3/4`} />
                <div className={`${bar} w-2/3`} />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
                <div className={`${bar} w-1/2`} />
                <div className={`${bar} w-3/5`} />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
                <div className={`${bar} w-2/3`} />
                <div className={`${bar} w-1/2`} />
            </div>
        </div>
    );
}
