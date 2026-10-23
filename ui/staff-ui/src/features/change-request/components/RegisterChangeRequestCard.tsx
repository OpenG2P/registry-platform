import ViewAll from "@/components/shared/ViewAll";
import { useFetch } from "@/shared/hooks/useFetch";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

interface Props {
    registerId: string;
    internalRecordId: string;
    type: string;
    activeTabId?: string;
    recordName?: string | null;
    count?: number;
    onCountLoaded?: (count: number) => void;
}

export default function RegisterChangeRequestCard({
    type,
    registerId,
    internalRecordId,
    activeTabId,
    recordName,
    count: externalCount,
    onCountLoaded,
}: Props) {
    const locale = useLocale();
    const t = useTranslations();
    const hasLoadedInitialCount = useRef(false);

    const { data, loading } = useFetch<any>({
        url: `/api/change-request/pending`,
        enabled: !!registerId && !!internalRecordId && !!activeTabId,
        options: {
            method: "POST",
            body: JSON.stringify({
                subject_register_id: registerId,
                subject_record_id: internalRecordId,
                tab_id: activeTabId,
            }),
        },
    });

    // Initialize parent state with API data on first load
    useEffect(() => {
        if (!hasLoadedInitialCount.current && data?.number_of_pending_change_requests !== undefined && onCountLoaded) {
            onCountLoaded(data.number_of_pending_change_requests);
            hasLoadedInitialCount.current = true;
        }
    }, [data, onCountLoaded]);

    // Use external count if provided, otherwise use API data
    const count = externalCount ?? data?.number_of_pending_change_requests ?? 0;

    const isDisabled = count === 0;

    const params = new URLSearchParams();
    if (activeTabId) params.set("tab", activeTabId);
    if (recordName?.trim()) params.set("record_name", recordName.trim());

    const href = `/${locale}/register/${type}/${internalRecordId}/change-request${params.toString() ? `?${params.toString()}` : ""
        }`;

    if (loading) {
        return (
            <div className="relative overflow-hidden rounded-[10px] bg-primary-first px-4 pt-4 pb-5 animate-pulse sm:px-7.25 sm:pb-7.25">
                <div className="flex items-center justify-between gap-3">
                    <div className="h-6 w-40 max-w-[60%] rounded bg-neutral-first/20" />
                    <div className="h-11 w-14 shrink-0 rounded-[10px] bg-neutral-first/20 sm:h-15 sm:w-20" />
                </div>

                <div className="mt-3 h-3 w-56 max-w-full rounded bg-neutral-first/20" />

                <div className="mt-8 h-10 w-32 rounded-full bg-neutral-first/20 sm:mt-25" />

                <div className="absolute bottom-0 right-2 h-20 w-20 rounded-full bg-neutral-first/20 sm:h-[164px] sm:w-[164px]" />
            </div>
        );
    }

    return (
        <div className="relative overflow-hidden rounded-[10px] bg-primary-first px-4 pt-4 pb-5 sm:px-7.25 sm:pt-5 sm:pb-7.25">
            <div className="flex items-center justify-between gap-3">
                <h3 className="min-w-0 truncate text-xl font-semibold leading-none text-neutral-first sm:text-[24px]">
                    {t("change_request")}
                </h3>
                <div className="flex h-11 w-14 shrink-0 items-center justify-center rounded-[10px] border-3 border-white bg-primary-first text-2xl font-bold text-neutral-first sm:h-15 sm:w-20 sm:text-[34px]">
                    {count.toString().padStart(2, '0')}
                </div>
            </div>

            <p className="mt-3 text-[16px] font-normal text-neutral-first">
                {count > 0
                    ? t("pending_changes")
                    : t("no_pending_changes")}
            </p>

            <div className="relative z-10 mt-8 pr-24 sm:mt-25 sm:pr-36">
                <div
                    className={`w-fit max-w-full ${isDisabled ? "invisible cursor-not-allowed pointer-events-none" : ""}`}
                >
                    <ViewAll
                        href={href}
                        bgColor="var(--color-secondary-second)"
                        label={t("know_more")}
                    />
                </div>
            </div>
            <Image
                src="/images/changerequest/cr.png"
                alt="Change Request"
                width={164}
                height={164}
                className="pointer-events-none absolute bottom-0 right-2 h-20 w-20 sm:h-[164px] sm:w-[164px]"
            />
        </div>
    );
}
