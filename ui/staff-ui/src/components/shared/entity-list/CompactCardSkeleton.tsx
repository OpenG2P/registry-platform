'use client';

export default function CompactCardSkeleton() {
    return (
        <div className="flex items-center gap-4 sm:gap-6 px-4 sm:px-6 lg:px-8 p-4 w-full overflow-hidden bg-secondary-second animate-pulse">
            <div className="w-16 h-16 rounded-md bg-secondary-third shrink-0" />
            <div className="flex-1 space-y-2 min-w-0">
                <div className="h-4 bg-secondary-third rounded w-1/3" />
                <div className="h-3 bg-secondary-third rounded w-1/2" />
            </div>
            <div className="flex-1 space-y-2 min-w-0">
                <div className="h-3 bg-secondary-third rounded w-2/3" />
                <div className="h-3 bg-secondary-third rounded w-1/2" />
            </div>
            <div className="flex-1 space-y-2 min-w-0">
                <div className="h-3 bg-secondary-third rounded w-1/3" />
                <div className="h-3 bg-secondary-third rounded w-2/3" />
            </div>
        </div>
    );
}
