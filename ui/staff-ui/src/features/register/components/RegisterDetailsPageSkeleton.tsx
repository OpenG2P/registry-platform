"use client";

interface Props {
    tabs?: any[];
}

export default function RegisterDetailsPageSkeleton({ tabs = [] }: Props) {
    return (
        <div className="animate-pulse">
            {(tabs.length === 0 && <div className="flex gap-2 px-0 sm:px-4 lg:px-10">
                {[1, 2, 3].map(i => (
                    <div
                        key={i}
                        className="h-9 w-24 rounded-t-[10px] bg-primary-first/50 sm:h-11 sm:w-32"
                    />
                ))}
            </div>)}

            <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 lg:col-span-9 space-y-6">
                    <div className="rounded-[10px] bg-neutral-second p-4 space-y-4 shadow-sm sm:p-9.5">
                        <div className="flex items-center gap-3">
                            <div className="h-6 w-48 rounded bg-secondary-third animate-pulse" />
                        </div>

                        <div className="space-y-2">
                            <div className="h-5 w-full rounded bg-secondary-third animate-pulse" />
                            <div className="h-5 w-5/6 rounded bg-secondary-third animate-pulse" />
                            <div className="h-5 w-4/6 rounded bg-secondary-third animate-pulse" />
                        </div>

                        <div className="grid grid-cols-1 gap-4 pt-3 sm:grid-cols-2">
                            <div className="h-10 rounded-full bg-secondary-third animate-pulse" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                        <div className="rounded-[10px] bg-neutral-second p-4 space-y-4 shadow-sm sm:col-span-2 sm:p-9.5">
                            <div className="h-6 w-40 rounded bg-secondary-third animate-pulse" />
                            <div className="space-y-2">
                                <div className="h-5 w-full rounded bg-secondary-third animate-pulse" />
                                <div className="h-5 w-5/6 rounded bg-secondary-third animate-pulse" />
                                <div className="h-5 w-4/6 rounded bg-secondary-third animate-pulse" />
                            </div>
                            <div className="h-10 w-40 rounded-full bg-secondary-third animate-pulse" />
                        </div>

                        <div className="rounded-[10px] bg-neutral-second p-4 space-y-4 shadow-sm sm:p-9.5">
                            <div className="h-6 w-28 rounded bg-secondary-third animate-pulse" />
                            <div className="space-y-2">
                                <div className="h-5 w-full rounded bg-secondary-third animate-pulse" />
                                <div className="h-5 w-4/5 rounded bg-secondary-third animate-pulse" />
                            </div>
                            <div className="h-10 rounded-full bg-secondary-third animate-pulse" />
                        </div>
                    </div>
                </div>


                <div className="col-span-12 flex flex-col gap-6 lg:col-span-3">
                    <div className="relative overflow-hidden rounded-[10px] bg-primary-first px-4 pt-4 pb-5 animate-pulse sm:px-8 sm:pb-7">
                        <div className="flex items-center justify-between gap-3">
                            <div className="h-6 w-40 max-w-[60%] rounded bg-neutral-first/20" />
                            <div className="h-11 w-14 shrink-0 rounded-[10px] bg-neutral-first/20 sm:h-15 sm:w-20" />
                        </div>

                        <div className="mt-3 h-3 w-56 max-w-full rounded bg-neutral-first/20" />

                        <div className="mt-8 h-10 w-32 rounded-full bg-neutral-first/20 sm:mt-25" />

                        <div className="absolute bottom-4 right-4 h-20 w-20 rounded-full bg-neutral-first/20 sm:h-[164px] sm:w-[164px]" />
                    </div>
                    <div className="relative overflow-hidden rounded-[10px] bg-secondary-second px-4 pt-4 pb-5 animate-pulse sm:px-8 sm:pb-7">
                        <div className="mb-5 flex items-center justify-between gap-3">
                            <div className="h-6 w-40 max-w-[60%] rounded bg-neutral-first/20" />
                            <div className="h-11 w-14 shrink-0 rounded-[10px] bg-neutral-first/20 sm:h-15 sm:w-20" />
                        </div>

                        <div className="space-y-3">
                            <div className="h-4 w-32 rounded bg-neutral-first/20" />
                            <div className="h-4 w-full max-w-64 rounded bg-neutral-first/20" />
                        </div>

                        <div className="mt-4 space-y-3">
                            <div className="h-4 w-32 rounded bg-neutral-first/20" />
                            <div className="h-4 w-full max-w-64 rounded bg-neutral-first/20" />
                        </div>

                        <div className="mt-6 h-10 w-32 rounded-full bg-neutral-first/20" />
                    </div>
                </div>
            </div>
        </div>
    )
}
