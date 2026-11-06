'use client';

export default function CompactCardSkeleton({ isEven = false }: { isEven?: boolean }) {
    const bar = 'h-4 rounded bg-secondary-third animate-pulse';
    const tone = isEven ? 'bg-secondary-second/25' : 'bg-neutral-second';

    return (
        <div className={`flex w-full flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:gap-6 lg:px-8 ${tone}`}>
            <div className="flex min-w-0 items-center gap-4 sm:gap-6 lg:flex-1">
                <div className="h-12 w-12 shrink-0 animate-pulse rounded-md bg-secondary-third sm:h-14 sm:w-14 lg:h-16 lg:w-16" />
                <div className="min-w-0 flex-1 space-y-2">
                    <div className={`${bar} w-2/3`} />
                    <div className={`${bar} w-1/2`} />
                </div>
            </div>
            <div className="grid w-full grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:contents">
                {[0, 1, 2].map((column) => (
                    <div key={column} className="min-w-0 space-y-2 lg:flex-1">
                        <div className={`${bar} w-3/4`} />
                        <div className={`${bar} w-1/2`} />
                    </div>
                ))}
            </div>
        </div>
    );
}
