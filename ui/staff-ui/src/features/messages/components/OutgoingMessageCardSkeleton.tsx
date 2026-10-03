'use client';

export default function OutgoingMessageCardSkeleton() {
    return (
        <div className="rounded-[10px] bg-neutral-second px-10 py-8 animate-pulse">
            <div className="grid gap-6 grid-cols-1 md:grid-cols-4 text-[16px]">
                {[0, 1, 2, 3].map((column) => (
                    <div
                        key={column}
                        className={`space-y-3 ${column > 0 ? 'border-l-2 border-secondary-second pl-6' : ''}`}
                    >
                        <div className="h-6 w-28 bg-secondary-second rounded" />
                        {[...Array(column === 1 ? 6 : 4)].map((_, i) => (
                            <div key={i} className="h-5 w-full max-w-56 bg-secondary-second rounded" />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
