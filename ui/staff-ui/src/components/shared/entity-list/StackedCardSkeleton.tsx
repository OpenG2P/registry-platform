'use client';

export default function StackedCardSkeleton() {
    return (
        <div className="animate-pulse rounded-[10px] bg-neutral-second px-4 py-5 pb-5 sm:px-6 lg:px-10">
            <div className="mb-4 h-6 w-1/3 max-w-48 rounded bg-secondary-third" />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
                <div className="space-y-3">
                    <div className="h-4 w-1/2 rounded bg-secondary-third" />
                    <div className="h-4 w-1/3 rounded bg-secondary-third" />
                    <div className="h-4 w-1/4 rounded bg-secondary-third" />
                </div>

                {[...Array(3)].map((_, i) => (
                    <div key={i} className="space-y-3">
                        <div className={`space-y-2 ${i % 2 === 0 ? 'sm:border-l-3 sm:border-secondary-second sm:pl-6' : ''} ${'xl:border-l-3 xl:border-secondary-second xl:pl-6'}`}>
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
