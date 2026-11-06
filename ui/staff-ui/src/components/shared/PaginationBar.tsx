"use client";

import Image from "next/image";

interface PaginationBarProps {
    pageStart: number;
    pageEnd: number;
    total: number;
    onPrev: () => void;
    onNext: () => void;
}

const formatNumber = (num: number) => {
    if (num < 1000) return num.toString();
    if (num >= 1000000000) {
        const val = num / 1000000000;
        return `${val < 10 ? val.toFixed(1).replace(/\.0$/, "") : Math.floor(val)}B`;
    }
    if (num >= 1000000) {
        const val = num / 1000000;
        return `${val < 10 ? val.toFixed(1).replace(/\.0$/, "") : Math.floor(val)}M`;
    }
    const val = num / 1000;
    return `${val < 10 ? val.toFixed(1).replace(/\.0$/, "") : Math.floor(val)}k`;
};

export default function PaginationBar({
    pageStart,
    pageEnd,
    total,
    onPrev,
    onNext,
}: PaginationBarProps) {
    const isPrevDisabled = pageStart <= 1;
    const isNextDisabled = pageEnd >= total;

    return (
        <div className="flex items-center gap-2">
            <span className="whitespace-nowrap px-1 text-center text-sm font-normal text-neutral-first sm:px-2 sm:text-[16px]">
                {formatNumber(pageStart)} - {formatNumber(pageEnd)} of {formatNumber(total)}
            </span>


            <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                    onClick={onPrev}
                    disabled={isPrevDisabled}
                    className={`flex h-7 w-8 items-center justify-center rounded-[8px] bg-primary-first sm:h-8.5 sm:w-10 sm:rounded-[10px] ${
                        isPrevDisabled ? "cursor-not-allowed" : ""
                    }`}
                >
                    <Image
                        src="/images/common/arrow_back_01.png"
                        width={12}
                        height={12}
                        alt="prev"
                        className="h-2.5 w-2.5 sm:h-3 sm:w-3"
                    />
                </button>

                <button
                    onClick={onNext}
                    disabled={isNextDisabled}
                    className={`flex h-7 w-8 items-center justify-center rounded-[8px] bg-primary-first sm:h-8.5 sm:w-10 sm:rounded-[10px] ${
                        isNextDisabled ? "cursor-not-allowed" : ""
                    }`}
                >
                    <Image
                        src="/images/common/arrow_next_01.png"
                        width={12}
                        height={12}
                        alt="next"
                        className="h-2.5 w-2.5 sm:h-3 sm:w-3"
                    />
                </button>
            </div>
        </div>
    );
}
