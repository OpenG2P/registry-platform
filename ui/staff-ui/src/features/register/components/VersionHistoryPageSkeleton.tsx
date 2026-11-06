'use client';

interface Props {
    tabs?: any[];
}

export default function VersionHistoryPageSkeleton({ tabs = [] }: Props) {
    return (
        <div className="animate-pulse">
            {tabs.length === 0 && (
                <div className="flex gap-2">
                    {[1, 2, 3].map(i => (
                        <div
                            key={i}
                            className="h-10 w-24 rounded-t-[10px] bg-primary-first/50 sm:w-32"
                        />
                    ))}
                </div>
            )}

            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                <div className="flex w-full min-w-0 flex-col gap-6 lg:flex-1">
                    <div className="flex flex-col gap-4 rounded-[10px] bg-neutral-second px-4 py-5 sm:flex-row sm:flex-wrap sm:px-6">
                        <div className="flex w-full flex-col gap-1 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
                            <div className="h-5 w-full rounded bg-secondary-third sm:w-25" />
                            <div className="h-8.5 w-full rounded-[10px] bg-secondary-second sm:w-35" />
                        </div>

                        <div className="flex w-full flex-col gap-1 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
                            <div className="h-5 w-full rounded bg-secondary-third sm:w-25" />
                            <div className="h-8.5 w-full rounded-[10px] bg-secondary-second sm:w-35" />
                        </div>
                    </div>

                    <div className="space-y-5 rounded-[30px] bg-neutral-second p-4 sm:p-6 lg:p-9.5">
                        <div className="h-6 w-48 max-w-full rounded bg-secondary-third" />

                        <div className="space-y-3">
                            <div className="h-5 w-full rounded bg-secondary-second" />
                            <div className="h-5 w-5/6 rounded bg-secondary-second" />
                            <div className="h-5 w-4/6 rounded bg-secondary-second" />
                        </div>

                        <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2">
                            <div className="h-10 rounded-full bg-secondary-second" />
                            <div className="h-10 rounded-full bg-secondary-second" />
                        </div>
                    </div>
                </div>

                <div className="w-full space-y-4 lg:w-[320px] lg:shrink-0">
                    {Array.from({ length: 2 }).map((_, i) => (
                        <VerificationCardSkeleton key={i} />
                    ))}
                </div>
            </div>
        </div>
    );
}


const VerificationCardSkeleton = () => {
    return (
        <div className="bg-secondary-second/60 rounded-[10px] p-6 space-y-4 animate-pulse">
            <div className="h-4 w-24 bg-neutral-first/20 rounded" />

            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-secondary-second rounded-full" />
                <div className="space-y-2">
                    <div className="h-5 w-40 bg-secondary-second rounded" />
                    <div className="h-3.5 w-32 bg-secondary-first rounded" />
                </div>
            </div>

            <div className="space-y-2">
                <div className="h-4 w-full bg-secondary-first rounded" />
                <div className="h-4 w-[85%] bg-secondary-first rounded" />
            </div>

            <div className="flex gap-6 pt-2">
                {[1, 2].map(i => (
                    <div key={i} className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-neutral-second border rounded" />
                        <div className="h-4 w-14 bg-secondary-first rounded" />
                    </div>
                ))}
            </div>
        </div>
    );
};
