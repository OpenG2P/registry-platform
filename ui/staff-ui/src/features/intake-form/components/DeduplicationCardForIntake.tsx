"use client";

import { useState } from "react";
import Image from "next/image";
import { KeyValue } from "@/components/ui/KeyValue";

interface Props {
    results: any[];
    loading: boolean;
    type: "intake-form" | "register";
    t: (key: string) => string;
}

function fieldSpacing(index: number) {
    const smStart = index % 2 === 0;
    const smEnd = (index + 1) % 2 === 0;
    const lgStart = index % 3 === 0;
    const lgEnd = (index + 1) % 3 === 0;
    const xlStart = index % 4 === 0;
    const xlEnd = (index + 1) % 4 === 0;

    const inset = [
        smStart ? "sm:pl-0" : "sm:pl-6",
        lgStart ? "lg:pl-0" : "lg:pl-6",
        xlStart ? "xl:pl-0" : "xl:pl-6",
    ].join(" ");

    const trail = [
        smEnd ? "sm:pr-0" : "sm:pr-6",
        lgEnd ? "lg:pr-0" : "lg:pr-6",
        xlEnd ? "xl:pr-0" : "xl:pr-6",
    ].join(" ");

    const rule = [
        smStart ? "sm:border-l-0" : "sm:border-l sm:border-primary-first",
        lgStart ? "lg:border-l-0" : "lg:border-l lg:border-primary-first",
        xlStart ? "xl:border-l-0" : "xl:border-l xl:border-primary-first",
    ].join(" ");

    return { inset, trail, rule };
}

export default function DeduplicationCardForIntake({ results, loading, type, t }: Props) {
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
            {results.map((result: any, index: number) => {
                const expanded = expandedIndex === index;

                const candidateId =
                    type === "intake-form"
                        ? result.candidate_intake_form_submission_id
                        : result.internal_record_id;

                const allMetaItems: { label: string; value: string }[] = [
                    { label: t("dedup_result_id"), value: result.dedup_result_id },
                ];
                if (candidateId) {
                    allMetaItems.push({
                        label: t(type === "intake-form" ? "candidate_intake_form_submission_id" : "internal_record_id"),
                        value: candidateId,
                    });
                }
                allMetaItems.push(
                    { label: t("match_score"), value: `${result.match_score}%` },
                    { label: t("created_at"), value: new Date(result.created_at).toLocaleDateString("en-GB") }
                );

                const leftMeta = allMetaItems.slice(0, 3);
                const rightMeta = allMetaItems.slice(3);
                const fields = Object.entries(result.field_matches || {});

                return (
                    <div
                        key={result.dedup_result_id}
                        className={`relative px-4 pt-6 pb-5 transition-all duration-200 ease-in-out sm:px-10 sm:pt-8 sm:pb-6 ${
                            expanded
                                ? "z-10 rounded-[10px] border border-dashed border-primary-second bg-primary-first/20"
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
                            <div className="pb-2 sm:pb-4">
                                <div className="grid grid-cols-1 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                    {fields.map(([fieldKey, match]: [string, any], i) => {
                                        const { inset, trail, rule } = fieldSpacing(i);
                                        return (
                                        <div
                                            key={fieldKey}
                                            className={`min-w-0 space-y-0 overflow-hidden py-2 ${trail}`}
                                        >
                                            <div className={inset}>
                                                <h4 className="mb-1 truncate text-[18px] font-medium leading-none text-neutral-first sm:text-[20px]" title={t(fieldKey)}>
                                                    {t(fieldKey)}
                                                </h4>
                                            </div>
                                            <div className={`min-w-0 space-y-0 ${inset} ${rule}`}>
                                                <KeyValue variant="deduplication" className="min-w-0" label={t("incoming")} value={match.incoming} />
                                                <KeyValue variant="deduplication" className="min-w-0" label={t("candidate")} value={match.candidate} />
                                                <KeyValue
                                                    variant="deduplication"
                                                    className="min-w-0"
                                                    label={t("similarity")}
                                                    value={`${(match.similarity * 100).toFixed(0)}% (${t(match.match_type)})`}
                                                />
                                            </div>
                                        </div>
                                        );
                                    })}
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
