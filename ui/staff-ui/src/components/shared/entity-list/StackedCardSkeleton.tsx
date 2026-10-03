'use client';

export default function StackedCardSkeleton() {
    return (
        <div className="rounded-[10px] bg-neutral-second px-10 py-10 pb-5 animate-pulse">
            <div className="mb-4 h-6 bg-secondary-third rounded w-1/3" />

            <div className="grid gap-6 grid-cols-4">
                <div className="space-y-3">
                    <div className="h-4 bg-secondary-third rounded w-1/2" />
                    <div className="h-4 bg-secondary-third rounded w-1/3" />
                    <div className="h-4 bg-secondary-third rounded w-1/4" />
                </div>

                {[...Array(3)].map((_, i) => (
                    <div key={i} className="space-y-3">
                        <div className="space-y-2 border-l-3 border-secondary-second pl-6">
                            <div className="h-4 bg-secondary-third rounded w-2/3" />
                            <div className="h-4 bg-secondary-third rounded w-1/2" />
                            <div className="h-4 bg-secondary-third rounded w-1/3" />
                        </div>
                    </div>
                ))}
            </div>

            <div className="my-4 border-t-3 border-secondary-second" />

            <div className="flex items-center justify-between">
                <div className="h-6 bg-secondary-third rounded w-24 opacity-50" />
            </div>
        </div>
    );
}
