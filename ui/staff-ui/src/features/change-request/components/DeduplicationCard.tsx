"use client";

import { useState } from "react";
import Image from "next/image";
import { KeyValue } from "@/components/ui/KeyValue";
import type { DeduplicationResult } from "@/features/change-request/types";

interface Props {
    results: DeduplicationResult[];
    loading: boolean;
    type: "change-request" | "register";
    t: (key: string) => string;
}

export default function DeduplicationCard({ results, loading, type, t }: Props) {
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

    if (loading) {
        return (
            <div className="rounded-[10px] border border-gray-200 bg-neutral-second px-4 py-6 sm:px-10 sm:py-8">
                <p className="text-neutral-first/50 text-sm">{t("loading")}</p>
            </div>
        );
    }

    if (!results.length) {
        return (
            <div className="rounded-[10px] border border-gray-200 bg-neutral-second px-4 py-6 sm:px-10 sm:py-8">
                <p className="text-neutral-first/50 text-sm">{t("no_duplicates_found")}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {results.map((result: DeduplicationResult, index: number) => {
                const expanded = expandedIndex === index;

                const candidateId =
                    type === "change-request"
                        ? result.candidate_change_request_id
                        : result.internal_record_id;

                const allMetaItems: { label: string; value: string }[] = [
                    { label: t("dedup_result_id"), value: result.dedup_result_id },
                ];
                if (candidateId) {
                    allMetaItems.push({
                        label: t(type === "change-request" ? "candidate_change_request_id" : "internal_record_id"),
                        value: candidateId,
                    });
                }
                allMetaItems.push(
                    { label: t("match_score"), value: `${result.match_score}%` },
                    { label: t("created_at"), value: new Date(result.created_at).toLocaleDateString("en-GB") }
                );

                const leftMeta = allMetaItems.slice(0, 3);
                const rightMeta = allMetaItems.slice(3);
                const fields = Object.entries(result.field_matches);

                return (
                    <div
                        key={result.dedup_result_id}
                        className={`relative px-4 pt-6 pb-5 transition-all duration-200 ease-in-out sm:px-10 sm:pt-8 sm:pb-6 ${
                            expanded
                                ? "z-10 rounded-t-[10px] border border-dashed border-primary-second bg-secondary-first"
                                : "z-0 rounded-[10px] border border-gray-200 bg-neutral-second"
                        }`}
                    >
                        <h3 className="text-[20px] font-medium text-neutral-first mb-4 leading-none truncate" title={t("match") + "  #" + String(index + 1).padStart(2, "0")}>
                            {t("match") + "  #" + String(index + 1).padStart(2, "0")}
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-0">
                                {leftMeta.map((item) => (
                                    <KeyValue variant="deduplication" key={item.label} label={item.label} value={item.value} />
                                ))}
                            </div>
                            {rightMeta.length > 0 && (
                                <div className="space-y-0">
                                    {rightMeta.map((item) => (
                                        <KeyValue variant="deduplication" key={item.label} label={item.label} value={item.value} />
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className={`mt-4 mb-2 border-t ${expanded ? "border-primary-first" : "border-secondary-second"}`} />

                        {!expanded && fields.length > 0 && (
                            <button
                                onClick={() => setExpandedIndex(index)}
                                className="flex items-center gap-1 text-[14px] text-neutral-first/60 cursor-pointer"
                            >
                                {t("view_more")} <Image src="/images/common/arrow_next_01.png" alt="more" width={14} height={14} className="rotate-90 opacity-[0.5]" />
                            </button>
                        )}

                        {expanded && fields.length > 0 && (
                            <div className="absolute top-full left-[-1px] right-[-1px] z-20 rounded-b-[10px] border border-t-0 border-dashed border-primary-second bg-secondary-first px-4 pb-6 sm:px-10 sm:pb-8">
                                <div className="grid grid-cols-1 md:grid-cols-3">
                                    {fields.map(([fieldKey, match], i) => (
                                        <div
                                            key={fieldKey}
                                            className={`space-y-0 py-2 ${i === 2 ? "" : "md:pr-10"} ${i > 0 ? "md:pl-10" : ""}`}
                                        >
                                            <div className={i > 0 ? "md:pl-6" : ""}>
                                                <h4 className="mb-1 truncate text-[18px] font-medium leading-none text-neutral-first sm:text-[20px]" title={t(fieldKey)}>
                                                    {t(fieldKey)}
                                                </h4>
                                            </div>
                                            <div className={`space-y-0 ${i > 0 ? "md:border-l md:border-primary-first md:pl-6" : ""}`}>
                                                <KeyValue variant="deduplication" label={t("incoming")} value={match.incoming} />
                                                <KeyValue variant="deduplication" label={t("candidate")} value={match.candidate} />
                                                <KeyValue
                                                    variant="deduplication"
                                                    label={t("similarity")}
                                                    value={`${(match.similarity * 100).toFixed(0)}% (${match.match_type})`}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <hr className="border-t border-primary-first mt-6 mb-4" />
                                <button
                                    onClick={() => setExpandedIndex(null)}
                                    className="flex items-center gap-1 text-[14px] text-neutral-first/60 cursor-pointer"
                                >
                                    {t("view_less")} <Image src="/images/common/arrow_next_01.png" alt="less" width={14} height={14} className="-rotate-90 opacity-[0.5]" />
                                </button>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
